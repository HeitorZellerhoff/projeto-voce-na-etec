import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import http from 'node:http';

describe('DEM-023: Investigação, Hardening e Validação Resiliente do Rate Limiter', () => {
  const originalEnvUrl = process.env.UPSTASH_REDIS_REST_URL;
  const originalEnvToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (originalEnvUrl) process.env.UPSTASH_REDIS_REST_URL = originalEnvUrl;
    else delete process.env.UPSTASH_REDIS_REST_URL;

    if (originalEnvToken) process.env.UPSTASH_REDIS_REST_TOKEN = originalEnvToken;
    else delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  // =========================================================================
  // PARTE 1: SUÍTE DE TESTES UNITÁRIOS COM MOCKS CONTROLADOS
  // =========================================================================
  describe('PARTE 1: Testes Unitários de Controle e Políticas com Mocks', () => {

    describe('1. Upstash Ausente (Modo Desenvolvimento / Testes)', () => {
      it('[Classificação: Unitário/Mock de Ambiente] opera em Fail-Open transparente quando credenciais Upstash não estão configuradas', async () => {
        delete process.env.UPSTASH_REDIS_REST_URL;
        delete process.env.UPSTASH_REDIS_REST_TOKEN;

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
      });
    });

    describe('2. Upstash Operacional (Comportamento Normal Sob Carga)', () => {
      it('[Classificação: Unitário/Mock] permite as primeiras 5 requisições e bloqueia a 6ª com HTTP 429 sanitizado', async () => {
        let callCount = 0;
        const mockLimit = vi.fn().mockImplementation(async () => {
          callCount++;
          if (callCount <= 5) {
            return { success: true, limit: 5, remaining: 5 - callCount, reset: Date.now() + 60000 };
          }
          return { success: false, limit: 5, remaining: 0, reset: Date.now() + 60000 };
        });

        vi.resetModules();
        vi.doMock('@upstash/ratelimit', () => ({
          Ratelimit: class {
            static slidingWindow = vi.fn();
            limit = mockLimit;
          },
        }));

        vi.doMock('@upstash/redis', () => ({
          Redis: vi.fn(),
        }));

        process.env.UPSTASH_REDIS_REST_URL = 'https://fake-upstash-redis.upstash.io';
        process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token-12345';

        const { proxy, resetInMemoryRateLimitStore } = await import('../src/proxy');
        resetInMemoryRateLimitStore();

        const targetPath = '/api/auth/login';

        // Primeiras 5 requisições devem passar normalmente
        for (let i = 1; i <= 5; i++) {
          const req = new NextRequest(`http://localhost:3000${targetPath}`, {
            method: 'POST',
            headers: { 'x-forwarded-for': '203.0.113.10' },
          });

          const res = await proxy(req);
          expect(res.status).toBe(200);
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

        // Confirma ausência de vazamento de dados internos
        expect(body.stack).toBeUndefined();
        expect(JSON.stringify(body)).not.toContain('UPSTASH');
        expect(JSON.stringify(body)).not.toContain('fake-token');
      });

      it('[Classificação: Unitário/Mock] aplica rate limiting em submissões diretas ao formulário POST /login', async () => {
        let callCount = 0;
        const mockLimit = vi.fn().mockImplementation(async () => {
          callCount++;
          if (callCount <= 5) return { success: true };
          return { success: false };
        });

        vi.resetModules();
        vi.doMock('@upstash/ratelimit', () => ({
          Ratelimit: class {
            static slidingWindow = vi.fn();
            limit = mockLimit;
          },
        }));
        vi.doMock('@upstash/redis', () => ({ Redis: vi.fn() }));

        process.env.UPSTASH_REDIS_REST_URL = 'https://fake-upstash-redis.upstash.io';
        process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token-12345';

        const { proxy, resetInMemoryRateLimitStore } = await import('../src/proxy');
        resetInMemoryRateLimitStore();

        // 5 chamadas permitidas via rewrite para /api/auth/login
        for (let i = 0; i < 5; i++) {
          const req = new NextRequest('http://localhost:3000/login', {
            method: 'POST',
            headers: { 'x-forwarded-for': '198.51.100.77' },
          });
          const res = await proxy(req);
          expect(res.headers.get('x-middleware-rewrite')).toContain('/api/auth/login');
        }

        // 6ª chamada para /login deve ser bloqueada com 429 sem efetuar o rewrite
        const blockedReq = new NextRequest('http://localhost:3000/login', {
          method: 'POST',
          headers: { 'x-forwarded-for': '198.51.100.77' },
        });
        const blockedRes = await proxy(blockedReq);
        expect(blockedRes.status).toBe(429);
        expect(blockedRes.headers.get('x-middleware-rewrite')).toBeNull();
      });
    });

    describe('3. Redis Indisponível / Resiliência e Contingência', () => {
      it('[Classificação: Unitário/Mock] trata exceção de conexão do Redis sem rejeição não tratada e permite tráfego legítimo em fallback', async () => {
        const mockLimitError = vi.fn().mockRejectedValue(new Error('Connection timeout to Upstash Redis REST endpoint'));

        vi.resetModules();
        vi.doMock('@upstash/ratelimit', () => ({
          Ratelimit: class {
            static slidingWindow = vi.fn();
            limit = mockLimitError;
          },
        }));

        vi.doMock('@upstash/redis', () => ({
          Redis: vi.fn(),
        }));

        process.env.UPSTASH_REDIS_REST_URL = 'https://broken-upstash.upstash.io';
        process.env.UPSTASH_REDIS_REST_TOKEN = 'broken-token';

        const { proxy, resetInMemoryRateLimitStore } = await import('../src/proxy');
        resetInMemoryRateLimitStore();

        const req = new NextRequest('http://localhost:3000/api/auth/login', {
          method: 'POST',
          headers: { 'x-forwarded-for': '198.51.100.5' },
        });

        // Com o hardening defensivo implementado no proxy.ts, a exceção é capturada,
        // a promise NÃO é rejeitada e a requisição legítima do hospital é permitida (status 200)
        let response: any;
        await expect((async () => {
          response = await proxy(req);
          return response.status;
        })()).resolves.toBe(200);

        expect(response.status).toBe(200);
      });

      it('[Classificação: Unitário/Mock] aciona proteção contra força bruta no fallback em memória durante apagão do Redis', async () => {
        // Simula Redis permanentemente offline
        const mockLimitError = vi.fn().mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1:6379'));

        vi.resetModules();
        vi.doMock('@upstash/ratelimit', () => ({
          Ratelimit: class {
            static slidingWindow = vi.fn();
            limit = mockLimitError;
          },
        }));
        vi.doMock('@upstash/redis', () => ({ Redis: vi.fn() }));

        process.env.UPSTASH_REDIS_REST_URL = 'https://down-upstash.upstash.io';
        process.env.UPSTASH_REDIS_REST_TOKEN = 'down-token';

        const { proxy, resetInMemoryRateLimitStore } = await import('../src/proxy');
        resetInMemoryRateLimitStore();

        const attackerIp = '198.51.100.99';

        // Primeiras 5 requisições do IP passam pelo fallback em memória (Fail-Open Controlado para emergência)
        for (let i = 1; i <= 5; i++) {
          const req = new NextRequest('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'x-forwarded-for': attackerIp },
          });
          const res = await proxy(req);
          expect(res.status).toBe(200);
        }

        // A 6ª requisição consecutiva de força bruta no mesmo IP deve ser interceptada pelo fallback local com 429
        const floodReq = new NextRequest('http://localhost:3000/api/auth/login', {
          method: 'POST',
          headers: { 'x-forwarded-for': attackerIp },
        });
        const floodRes = await proxy(floodReq);
        expect(floodRes.status).toBe(429);
        const body = await floodRes.json();
        expect(body.statusCode).toBe(429);
        expect(body.message).toMatch(/Muitas tentativas de acesso/i);
      });
    });

    describe('4. Tratamento de Timeouts e Erros de Rede', () => {
      it('[Classificação: Unitário/Mock] protege contra lentidão excessiva via timeout defensivo sem travar a thread', async () => {
        // Simula um timeout onde a Promise do Upstash fica pendente indefinidamente ou demora 10s
        const mockHangingLimit = vi.fn().mockImplementation(() => {
          return new Promise((resolve) => {
            setTimeout(() => resolve({ success: true }), 10000);
          });
        });

        vi.resetModules();
        vi.doMock('@upstash/ratelimit', () => ({
          Ratelimit: class {
            static slidingWindow = vi.fn();
            limit = mockHangingLimit;
          },
        }));
        vi.doMock('@upstash/redis', () => ({ Redis: vi.fn() }));

        process.env.UPSTASH_REDIS_REST_URL = 'https://slow-upstash.upstash.io';
        process.env.UPSTASH_REDIS_REST_TOKEN = 'slow-token';

        const { proxy, resetInMemoryRateLimitStore } = await import('../src/proxy');
        resetInMemoryRateLimitStore();

        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const req = new NextRequest('http://localhost:3000/api/auth/login', {
          method: 'POST',
          headers: { 'x-forwarded-for': '198.51.100.22' },
        });

        // O timeout de 2000ms configurado no proxy corta a espera e aciona o fallback
        const res = await proxy(req);
        expect(res.status).toBe(200);
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[RATE_LIMIT WARN] Timeout de conexão com Upstash Redis'));

        warnSpy.mockRestore();
      });

      it('[Classificação: Unitário/Mock] trata erro de resolução DNS (ENOTFOUND) e sanitiza logs sem vazar URLs ou tokens', async () => {
        const sensitiveUrl = 'https://upstash-prod-secret.io:8080/rest';
        const sensitiveToken = 'A1B2C3D4E5F6G7H8';
        const mockDnsError = vi.fn().mockRejectedValue(
          new Error(`getaddrinfo ENOTFOUND ${sensitiveUrl} Bearer ${sensitiveToken}`)
        );

        vi.resetModules();
        vi.doMock('@upstash/ratelimit', () => ({
          Ratelimit: class {
            static slidingWindow = vi.fn();
            limit = mockDnsError;
          },
        }));
        vi.doMock('@upstash/redis', () => ({ Redis: vi.fn() }));

        process.env.UPSTASH_REDIS_REST_URL = sensitiveUrl;
        process.env.UPSTASH_REDIS_REST_TOKEN = sensitiveToken;

        const { proxy, resetInMemoryRateLimitStore } = await import('../src/proxy');
        resetInMemoryRateLimitStore();

        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const req = new NextRequest('http://localhost:3000/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'x-forwarded-for': '198.51.100.33' },
        });

        const res = await proxy(req);
        expect(res.status).toBe(200);

        // Verifica que o log foi sanitizado
        expect(warnSpy).toHaveBeenCalled();
        const loggedMsg = warnSpy.mock.calls[0][0];
        expect(loggedMsg).toContain('[REDACTED_URL]');
        expect(loggedMsg).toContain('[REDACTED_TOKEN]');
        expect(loggedMsg).not.toContain(sensitiveUrl);
        expect(loggedMsg).not.toContain(sensitiveToken);

        warnSpy.mockRestore();
      });

      it('[Classificação: Unitário/Mock] trata resposta HTTP 500 do provedor sem provocar HTTP 500 não tratado no proxy', async () => {
        const mockProvider500 = vi.fn().mockRejectedValue(
          new Error('UpstashError: HTTP 500 Internal Server Error: upstream cluster unavailable')
        );

        vi.resetModules();
        vi.doMock('@upstash/ratelimit', () => ({
          Ratelimit: class {
            static slidingWindow = vi.fn();
            limit = mockProvider500;
          },
        }));
        vi.doMock('@upstash/redis', () => ({ Redis: vi.fn() }));

        process.env.UPSTASH_REDIS_REST_URL = 'https://failing-upstash.upstash.io';
        process.env.UPSTASH_REDIS_REST_TOKEN = 'failing-token';

        const { proxy, resetInMemoryRateLimitStore } = await import('../src/proxy');
        resetInMemoryRateLimitStore();

        const req = new NextRequest('http://localhost:3000/api/auth/reset-password', {
          method: 'POST',
          headers: { 'x-forwarded-for': '198.51.100.44' },
        });

        const res = await proxy(req);
        expect(res.status).toBe(200);
      });
    });
  });

  // =========================================================================
  // PARTE 2: SUÍTE DE INTEGRAÇÃO REAL COM PROTOCOLO HTTP E SOCKETS TCP
  // (SEM MOCKS DE @upstash/redis E SEM MOCKS DE @upstash/ratelimit)
  // =========================================================================
  describe('PARTE 2: Testes de Integração Real com Sockets TCP e Protocolo HTTP', () => {

    it('[Classificação: Integração Real / Infraestrutura] lida fisicamente com ECONNREFUSED em porta TCP fechada usando @upstash/redis nativo', async () => {
      // Porta TCP 59991 deliberadamente fechada sem nenhum listener ativo
      const closedPort = 59991;
      process.env.UPSTASH_REDIS_REST_URL = `http://127.0.0.1:${closedPort}`;
      process.env.UPSTASH_REDIS_REST_TOKEN = 'real-test-token';

      // NENHUM mock de @upstash/redis ou @upstash/ratelimit: executa a stack nativa real
      vi.resetModules();
      vi.doUnmock('@upstash/ratelimit');
      vi.doUnmock('@upstash/redis');

      const { proxy, resetInMemoryRateLimitStore } = await import('../src/proxy');
      resetInMemoryRateLimitStore();

      const req = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'x-forwarded-for': '192.168.10.15' },
      });

      // A stack nativa tenta conexão TCP real contra a porta 59991, o kernel emite ECONNREFUSED,
      // o cliente nativo lança TypeError (fetch failed), o proxy captura e aciona o fallback em memória
      const res = await proxy(req);
      expect(res.status).toBe(200);
    });

    it('[Classificação: Integração Real / Infraestrutura] lida fisicamente com HTTP 500 do servidor REST Upstash real usando @upstash/redis nativo', async () => {
      // Cria um servidor HTTP real local na porta dinâmica para simular falha de upstream 500 do Upstash
      const server = http.createServer((req, res) => {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Upstash Gateway Error: 500 Internal Server Error');
      });

      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
      const address = server.address() as { port: number };

      try {
        process.env.UPSTASH_REDIS_REST_URL = `http://127.0.0.1:${address.port}`;
        process.env.UPSTASH_REDIS_REST_TOKEN = 'real-token-500';

        vi.resetModules();
        vi.doUnmock('@upstash/ratelimit');
        vi.doUnmock('@upstash/redis');

        const { proxy, resetInMemoryRateLimitStore } = await import('../src/proxy');
        resetInMemoryRateLimitStore();

        const req = new NextRequest('http://localhost:3000/api/auth/login', {
          method: 'POST',
          headers: { 'x-forwarded-for': '192.168.10.25' },
        });

        // O cliente nativo @upstash/redis recebe o HTTP 500 real da porta TCP local,
        // o proxy absorve a falha, preserva a disponibilidade hospitalar e responde 200
        const res = await proxy(req);
        expect(res.status).toBe(200);
      } finally {
        server.close();
      }
    });

    it('[Classificação: Integração Real / Infraestrutura] lida fisicamente com encerramento abrupto de socket TCP (Socket Hang Up / Reset)', async () => {
      // Servidor HTTP real que aceita a conexão TCP e destrói o socket imediatamente
      const server = http.createServer((req) => {
        req.socket.destroy();
      });

      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
      const address = server.address() as { port: number };

      try {
        process.env.UPSTASH_REDIS_REST_URL = `http://127.0.0.1:${address.port}`;
        process.env.UPSTASH_REDIS_REST_TOKEN = 'real-token-abort';

        vi.resetModules();
        vi.doUnmock('@upstash/ratelimit');
        vi.doUnmock('@upstash/redis');

        const { proxy, resetInMemoryRateLimitStore } = await import('../src/proxy');
        resetInMemoryRateLimitStore();

        const req = new NextRequest('http://localhost:3000/api/auth/login', {
          method: 'POST',
          headers: { 'x-forwarded-for': '192.168.10.35' },
        });

        // O socket é destruído fisicamente gerando ECONNRESET / socket hang up no driver nativo,
        // o proxy captura a falha e aciona o fallback com sucesso
        const res = await proxy(req);
        expect(res.status).toBe(200);
      } finally {
        server.close();
      }
    });
  });
});
