import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { TokenPayload } from '@/lib/auth/jwt';

type RouteHandler = (request: Request, context: any) => Promise<Response> | Response;

export type AuthenticatedRouteHandler = (
  request: Request,
  context: any,
  session: TokenPayload
) => Promise<Response> | Response;

/**
 * HOC: Força o contexto de autenticação válido
 */
export function withAuth(handler: AuthenticatedRouteHandler): RouteHandler {
  return async (request: Request, context: any) => {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Acesso bloqueado: Não autenticado' }, { status: 401 });
    }
    return handler(request, context, session);
  };
}

/**
 * HOC: Valida se a Role do usuário possui a permissão de ação exigida
 */
export function withPermission(permissionAction: string, handler: AuthenticatedRouteHandler): RouteHandler {
  return withAuth(async (request: Request, context: any, session: TokenPayload) => {
    // Validação em tempo real de status ativo e papel do usuário
    const user = await prisma.user.findUnique({
      where: { id: session.sub },
      select: { status: true, roleId: true }
    });

    if (!user || user.status !== 'ATIVO') {
      return NextResponse.json(
        { error: 'Acesso negado: Conta inativa ou bloqueada' },
        { status: 403 }
      );
    }

    const rolePermission = await prisma.rolePermission.findFirst({
      where: {
        roleId: user.roleId,
        permission: { action: permissionAction }
      }
    });

    if (!rolePermission) {
      return NextResponse.json(
        { error: `Acesso negado: Requer permissão estrita '${permissionAction}'` },
        { status: 403 }
      );
    }

    return handler(request, context, session);
  });
}

/**
 * HOC: Injeção estrita de Escopo de Setor (Sector-Scoping Guards)
 * Impede Tampering Attacks expurgando qualquer 'sectorId' arbitrário do cliente
 * e forçando o Request a carregar exclusivamente a identidade setorial da sessão HttpOnly.
 */
export function withSectorScoping(handler: AuthenticatedRouteHandler): RouteHandler {
  return withAuth(async (request: Request, context: any, session: TokenPayload) => {
    
    let safeRequest = request;
    const url = new URL(request.url);

    // 1. Expurgar sectorId adulterado de Queries (GET/DELETE)
    if (url.searchParams.has('sectorId')) {
      console.warn(`[SECURITY WARN] Tentativa de parameter tampering detectada (Query: sectorId) pelo usuário: ${session.sub}`);
      url.searchParams.delete('sectorId');
      
      safeRequest = new Request(url.toString(), {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });
    }

    // 2. Expurgar sectorId adulterado do Body (POST/PUT/PATCH)
    if (request.method !== 'GET' && request.method !== 'HEAD' && request.method !== 'DELETE') {
      try {
        // Precisamos clonar para ler o JSON e depois recriar a stream
        const clone = safeRequest.clone();
        const body = await clone.json();
        
        if (body && typeof body === 'object' && 'sectorId' in body) {
          console.warn(`[SECURITY WARN] Tentativa de parameter tampering detectada (Payload: sectorId) pelo usuário: ${session.sub}`);
          delete body.sectorId;
          
          safeRequest = new Request(url.toString(), {
            method: safeRequest.method,
            headers: safeRequest.headers,
            body: JSON.stringify(body),
          });
        }
      } catch (err) {
        // Em caso de requisição Multipart/FormData (arquivos), a validação
        // deve ocorrer no handler de destino extraindo a info diretamente do objeto "session".
      }
    }

    // A Action final sempre terá a garantia de que, se precisar do setor, 
    // ele deve ser extraído EXCLUSIVAMENTE do argumento `session.sectorId` passado abaixo.
    return handler(safeRequest, context, session);
  });
}
