import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { neon } from '@neondatabase/serverless';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Instanciar o Redis e Rate Limiter condicionalmente para não quebrar setups locais que não tenham configurado
let ratelimit: Ratelimit | null = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  try {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    // Limite: 5 requisições por minuto por IP (Sliding Window) com timeout defensivo
    ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '1 m'),
      analytics: false,
      timeout: 2000,
    });
  } catch (initErr: any) {
    console.warn('[RATE_LIMIT WARN] Falha ao inicializar Upstash Redis:', initErr?.message || initErr);
    ratelimit = null;
  }
}

// Armazenamento em memória para contingência/fallback quando Redis estiver indisponível ou sofrer timeout
interface InMemoryRateLimitRecord {
  count: number;
  resetAt: number;
}
const inMemoryFallbackStore = new Map<string, InMemoryRateLimitRecord>();

export function checkInMemoryRateLimit(
  ip: string,
  limit: number = 5,
  windowMs: number = 60000
): { success: boolean; remaining: number; reset: number } {
  const now = Date.now();
  
  // Limpeza preventiva de registros expirados para evitar vazamento de memória em execuções prolongadas
  if (inMemoryFallbackStore.size > 1000) {
    for (const [key, value] of inMemoryFallbackStore.entries()) {
      if (value.resetAt <= now) {
        inMemoryFallbackStore.delete(key);
      }
    }
  }

  const record = inMemoryFallbackStore.get(ip);
  if (!record || record.resetAt <= now) {
    const reset = now + windowMs;
    inMemoryFallbackStore.set(ip, { count: 1, resetAt: reset });
    return { success: true, remaining: limit - 1, reset };
  }

  if (record.count >= limit) {
    return { success: false, remaining: 0, reset: record.resetAt };
  }

  record.count += 1;
  return { success: true, remaining: limit - record.count, reset: record.resetAt };
}

export function resetInMemoryRateLimitStore(): void {
  inMemoryFallbackStore.clear();
}

function buildRateLimitResponse(path: string) {
  return NextResponse.json(
    { 
      statusCode: 429, 
      message: 'Muitas tentativas de acesso. Por favor, aguarde um minuto antes de tentar novamente.', 
      timestamp: new Date().toISOString(), 
      path,
    },
    { status: 429 }
  );
}

async function evaluateRateLimit(request: NextRequest, pathname: string): Promise<boolean> {
  if (!ratelimit) return true;

  const forwarded = request.headers.get('x-forwarded-for');
  const ip = (forwarded ? forwarded.split(',')[0].trim() : null) || '127.0.0.1';

  let timeoutTimer: NodeJS.Timeout | undefined;
  try {
    const timeoutPromise = new Promise<{ isTimeout: true }>((resolve) => {
      timeoutTimer = setTimeout(() => resolve({ isTimeout: true }), 2000);
    });

    const limitPromise = ratelimit.limit(ip).then((res) => ({ ...res, isTimeout: false as const }));
    const result = await Promise.race([limitPromise, timeoutPromise]);

    if (result.isTimeout) {
      console.warn(`[RATE_LIMIT WARN] Timeout de conexão com Upstash Redis em ${pathname} para IP ${ip}. Ativando contingência em memória.`);
      const fallback = checkInMemoryRateLimit(ip, 5, 60000);
      return fallback.success;
    }

    if (result.reason === 'timeout') {
      console.warn(`[RATE_LIMIT WARN] Timeout reportado pelo cliente Upstash em ${pathname} para IP ${ip}. Ativando contingência em memória.`);
      const fallback = checkInMemoryRateLimit(ip, 5, 60000);
      return fallback.success;
    }

    return result.success;
  } catch (error: any) {
    // Sanitização rigorosa: elimina URLs de conexão, tokens ou senhas dos logs de advertência
    const rawMsg = error?.message || String(error);
    const sanitizedMsg = rawMsg
      .replace(/https?:\/\/[^\s]+/gi, '[REDACTED_URL]')
      .replace(/Bearer\s+[^\s]+/gi, 'Bearer [REDACTED_TOKEN]');

    console.warn(`[RATE_LIMIT WARN] Falha de infraestrutura no Upstash Redis (${sanitizedMsg}) em ${pathname}. Ativando contingência em memória.`);
    
    // Degradação graciosa para fallback em memória (Fail-Open Controlado): permite usuários legítimos e bloqueia força bruta abusiva
    const fallback = checkInMemoryRateLimit(ip, 5, 60000);
    return fallback.success;
  } finally {
    if (timeoutTimer) {
      clearTimeout(timeoutTimer);
    }
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Tratamento para requisições POST em /login (reescreve internamente para a rota de API de autenticação)
  if (pathname === '/login') {
    if (request.method === 'POST') {
      if (ratelimit) {
        const rateLimitPassed = await evaluateRateLimit(request, pathname);
        if (!rateLimitPassed) {
          return buildRateLimitResponse(pathname);
        }
      }
      return NextResponse.rewrite(new URL('/api/auth/login', request.url));
    }
    return NextResponse.next();
  }

  // Ignorar rotas públicas, estáticos e endpoints de autenticação pública
  if (pathname.startsWith('/_next') || pathname.startsWith('/api/auth/')) {
    // Prevenção de Ataques de Força Bruta (Rate Limiting) via Vercel Edge e Upstash
    if (pathname === '/api/auth/login' || pathname === '/api/auth/forgot-password' || pathname === '/api/auth/reset-password') {
      if (ratelimit) {
        const rateLimitPassed = await evaluateRateLimit(request, pathname);
        if (!rateLimitPassed) {
          return buildRateLimitResponse(pathname);
        }
      }
    }
    return NextResponse.next();
  }

  // Interceptar apenas /api/* e /dashboard/*
  if (!pathname.startsWith('/api/') && !pathname.startsWith('/dashboard/')) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get('session')?.value;
  if (!sessionCookie) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url), 303);
  }

  const session = await verifyToken(sessionCookie);
  if (!session) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Sessão inválida ou expirada' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url), 303);
  }

  // Consulta ultrarrápida Edge-compatible via HTTP Driver para obter status de senha, código do setor, role e status da conta
  try {
    const sql = neon(process.env.DATABASE_URL!);
    const result = await sql`
      SELECT u."status", u."mustChangePassword", s."code" as "sectorCode", r."name" as "roleName"
      FROM "User" u
      JOIN "Sector" s ON u."sectorId" = s.id
      JOIN "Role" r ON u."roleId" = r.id
      WHERE u.id = ${session.sub}
    `;

    if (result.length === 0) {
      // Usuário não existe mais no banco
      if (pathname.startsWith('/api/')) {
        const response = NextResponse.json({ error: 'Usuário não encontrado' }, { status: 401 });
        response.cookies.delete('session');
        return response;
      }
      const response = NextResponse.redirect(new URL('/login', request.url), 303);
      response.cookies.delete('session');
      return response;
    }

    const user = result[0];

    // Validação de Conta Ativa (Bloqueio em tempo real de sessões ativas)
    if (user.status !== 'ATIVO') {
      if (pathname.startsWith('/api/')) {
        const response = NextResponse.json(
          { error: `Acesso negado: Conta de colaborador com status ${user.status}` },
          { status: 403 }
        );
        response.cookies.delete('session');
        return response;
      }
      const response = NextResponse.redirect(new URL('/login?error=Conta%20bloqueada%20ou%20inativa', request.url), 303);
      response.cookies.delete('session');
      return response;
    }

    // Restrição de Primeiro Acesso
    if (user.mustChangePassword) {
      if (pathname !== '/primeiro-acesso' && pathname !== '/api/auth/first-access') {
        if (pathname.startsWith('/api/')) {
          return NextResponse.json({ error: 'Alteração de senha obrigatória' }, { status: 403 });
        }
        return NextResponse.redirect(new URL('/primeiro-acesso', request.url), 303);
      }
    }

    // Prevenção de Cross-Sector (Guardião de Setor no Frontend)
    if (pathname.startsWith('/dashboard/')) {
      const requestedSector = pathname.split('/')[2]; // ex: /dashboard/compras -> compras
      
      if (requestedSector) {
        const userSectorCode = user.sectorCode.toLowerCase();
        const isAdmin = user.roleName === 'ADMINISTRADOR' || userSectorCode === 'administracao' || userSectorCode === 'admin';

        // Administradores possuem visão executiva e acesso transversal aos painéis
        if (!isAdmin) {
          const isAdministrationPath = requestedSector === 'administracao' || requestedSector === 'admin';
          const isUserInAdministration = userSectorCode === 'administracao' || userSectorCode === 'admin';
          const isAllowed = (isAdministrationPath && isUserInAdministration) || (requestedSector === userSectorCode);

          // O usuário comum pode acessar apenas o próprio setor
          if (!isAllowed) {
            return NextResponse.redirect(new URL('/403-acesso-negado', request.url), 303);
          }
        }
      }
    }
  } catch (error: any) {
    console.warn('[PROXY WARN] Falha de conexão/timeout com Neon no proxy:', error.message || error);
    // Decisão Arquitetural de Segurança: Falha Segura (Fail-Close)
    // Em um sistema hospitalar, permitir acesso (Fail-Open) durante falhas do banco
    // permitiria que colaboradores com contas revogadas, suspensas ou com desvio de setor
    // acessassem informações sensíveis de medicamentos e pacientes.
    // Portanto, o sistema nega o acesso de forma segura e determinística:
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Serviço de autenticação temporariamente indisponível' }, { status: 503 });
    }
    return NextResponse.redirect(new URL('/login?error=Servi%C3%A7o%20temporariamente%20indispon%C3%ADvel', request.url), 303);
  }

  const response = NextResponse.next();
  
  // Injeta de forma segura o setor validado para uso posterior nos headers
  response.headers.set('X-Sector-Id', session.sectorId);
  response.headers.set('X-User-Id', session.sub);
  response.headers.set('X-Role-Id', session.roleId);

  return response;
}

export const config = {
  matcher: ['/login', '/api/:path*', '/dashboard/:path*', '/primeiro-acesso'],
};
