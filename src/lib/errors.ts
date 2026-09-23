import { NextResponse } from 'next/server';

export interface ApiErrorResponse {
  statusCode: number;
  message: string;
  timestamp: string;
  path: string;
}

export function handleApiError(error: any, request: Request, defaultMessage = 'Ocorreu um erro interno no servidor'): NextResponse<ApiErrorResponse> {
  const url = new URL(request.url);
  
  // Em produção, a aplicação silencia vazamentos de stack traces e detalhes de queries do banco de dados (CWE-209)
  const isProd = process.env.NODE_ENV === 'production';
  
  let statusCode = 500;
  let message = defaultMessage;

  // Normalização de erros conhecidos do Prisma ORM
  if (error?.code === 'P2002') {
    statusCode = 409;
    message = 'Conflito de dados: Um registro com esta identificação única já existe no sistema.';
  } else if (error?.code === 'P2025') {
    statusCode = 404;
    message = 'Recurso não encontrado.';
  } 
  // Normalização de validações Zod
  else if (error?.name === 'ZodError') {
    statusCode = 400;
    message = (error as any).errors[0]?.message || 'Dados de entrada inválidos.';
  }

  // Logs mantidos para observabilidade interna (Datadog/Vercel Logs)
  if (!isProd) {
    console.error(`[API ERROR] Rota: ${url.pathname} | Erro Original:`, error);
  }

  return NextResponse.json({
    statusCode,
    message,
    timestamp: new Date().toISOString(),
    path: url.pathname
  }, { status: statusCode });
}
