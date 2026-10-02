import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

describe('DEM-021: Auditoria e Validação Arquitetural de Rate Limiting (Seção 8)', () => {

  describe('Cenário B — Upstash Ausente (Comportamento Atual no Repositório)', () => {
    it('opera em Fail-Open permitindo requisições quando variáveis de ambiente Upstash não estão configuradas', async () => {
      // Garante que o ambiente não possui as variáveis de ambiente
      const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
      const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;

      // Reseta os módulos para testar inicialização sem Upstash
      vi.resetModules();
      const { proxy } = await import('../src/proxy');

      const endpoints = [
        '/api/auth/login',
        '/api/auth/forgot-password',
        '/api/auth/reset-password',
      ];

      for (const endpoint of endpoints) {
        // Dispara 10 requisições consecutivas (acima do limite teórico de 5)
        for (let i = 0; i < 10; i++) {
          const req = new NextRequest(`http://localhost:3000${endpoint}`, {
            method: 'POST',
            headers: {
              'x-forwarded-for': '192.168.1.100',
            },
          });

          const res = await proxy(req);
          // Sem Upstash configurado, o proxy não bloqueia: status 200 (NextResponse.next())
          expect(res.status).toBe(200);
          expect(res.headers.get('x-middleware-rewrite')).toBeNull();
        }
      }

      // Restaura variáveis
      if (originalUrl) process.env.UPSTASH_REDIS_REST_URL = originalUrl;
      if (originalToken) process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
    });
  });

  describe('Cenário A — Upstash Operacional (Comportamento Sob Carga e Disparo de 429)', () => {
    it('permite as primeiras 5 requisições e bloqueia a 6ª com HTTP 429 sanitizado', async () => {
      let callCount = 0;
      const mockLimit = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount <= 5) {
          return { success: true, limit: 5, remaining: 5 - callCount, reset: Date.now() + 60000 };
        }
        return { success: false, limit: 5, remaining: 0, reset: Date.now() + 60000 };
      });

      vi.resetModules();
      vi.doMock('@upstash/ratelimit', () => {
        return {
          Ratelimit: class {
            static slidingWindow = vi.fn();
            limit = mockLimit;
          },
        };
      });

      vi.doMock('@upstash/redis', () => {
        return {
          Redis: vi.fn(),
        };
      });

      process.env.UPSTASH_REDIS_REST_URL = 'https://fake-upstash-redis.upstash.io';
      process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token-12345';

      const { proxy } = await import('../src/proxy');

      const targetPath = '/api/auth/login';

      // Primeiras 5 requisições devem passar normalmente
      for (let i = 1; i <= 5; i++) {
        const req = new NextRequest(`http://localhost:3000${targetPath}`, {
          method: 'POST',
          headers: { 'x-forwarded-for': '203.0.113.10' },
        });

        const res = await proxy(req);
        expect(res.status).toBe(200); // Permitido (NextResponse.next())
      }

      // A 6ª requisição com o mesmo IP deve ser rejeitada com HTTP 429
      const sixthReq = new NextRequest(`http://localhost:3000${targetPath}`, {
        method: 'POST',
        headers: { 'x-forwarded-for': '203.0.113.10' },
      });

      const blockedRes = await proxy(sixthReq);
      expect(blockedRes.status).toBe(429);

      const body = await blockedRes.json();
      expect(body.statusCode).toBe(429);
      expect(body.message).toMatch(/Muitas tentativas de acesso/i);
      expect(body.path).toBe(targetPath);
      expect(body.timestamp).toBeDefined();

      // Confirma que não há vazamento de credenciais, chave de token ou stack trace
      expect(body.stack).toBeUndefined();
      expect(JSON.stringify(body)).not.toContain('UPSTASH');
      expect(JSON.stringify(body)).not.toContain('fake-token');
    });
  });

  describe('Cenário C — Redis Indisponível / Falha de Rede', () => {
    it('demonstra que exceção não tratada no Redis rejeita a promise no proxy (Defeito de Robustez)', async () => {
      const mockLimitError = vi.fn().mockRejectedValue(new Error('Connection timeout to Upstash Redis REST endpoint'));

      vi.resetModules();
      vi.doMock('@upstash/ratelimit', () => {
        return {
          Ratelimit: class {
            static slidingWindow = vi.fn();
            limit = mockLimitError;
          },
        };
      });

      vi.doMock('@upstash/redis', () => {
        return {
          Redis: vi.fn(),
        };
      });

      process.env.UPSTASH_REDIS_REST_URL = 'https://broken-upstash.upstash.io';
      process.env.UPSTASH_REDIS_REST_TOKEN = 'broken-token';

      const { proxy } = await import('../src/proxy');

      const req = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'x-forwarded-for': '198.51.100.5' },
      });

      // Como não há bloco try/catch envolvendo ratelimit.limit(ip) na linha 40 do proxy.ts,
      // a exceção do Redis se propaga diretamente, resultando em Promise rejection não tratada
      await expect(proxy(req)).rejects.toThrow('Connection timeout to Upstash Redis REST endpoint');
    });
  });
});
