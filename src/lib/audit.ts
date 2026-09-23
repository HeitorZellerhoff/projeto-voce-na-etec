import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';

interface AuditParams {
  userId?: string;
  sectorId?: string;
  action: string;
  entity: string;
  entityId?: string;
  metadata?: Record<string, any>;
  req?: Request | NextRequest;
}

const SENSITIVE_KEYS = ['password', 'token', 'newpassword', 'passwordhash'];

function sanitizeMetadata(metadata?: Record<string, any>): Record<string, any> | undefined {
  if (!metadata) return undefined;
  
  const sanitized = { ...metadata };
  for (const key of Object.keys(sanitized)) {
    if (SENSITIVE_KEYS.includes(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeMetadata(sanitized[key]);
    }
  }
  return sanitized;
}

export async function logAuditAction(params: AuditParams) {
  try {
    let ipAddress: string | undefined;
    let userAgent: string | undefined;

    if (params.req) {
      ipAddress = params.req.headers.get('x-forwarded-for') || undefined;
      // Compatibilidade com NextRequest que extrai o IP real da Vercel
      if (!ipAddress && 'ip' in params.req) {
        ipAddress = (params.req as any).ip;
      }
      userAgent = params.req.headers.get('user-agent') || undefined;
    }

    const sanitizedMetadata = sanitizeMetadata(params.metadata);

    // Operação assíncrona que não precisa bloquear o request principal
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        sectorId: params.sectorId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        metadata: sanitizedMetadata ?? {},
        ipAddress,
        userAgent
      }
    });
  } catch (error) {
    // Falhas em logs de auditoria não devem quebrar o fluxo do usuário em produção, mas devem ser monitoradas
    console.error('Falha crítica ao registrar log de auditoria:', error);
  }
}
