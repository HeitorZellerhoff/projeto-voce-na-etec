/**
 * Facade de compatibilidade retroativa para módulos que importam '@/lib/jwt'.
 * Todas as operações criptográficas e de sessão são canonicamente delegadas para
 * `src/lib/auth/jwt.ts` e `src/lib/auth/session.ts`.
 */
export * from './auth/jwt';
export * from './auth/session';
