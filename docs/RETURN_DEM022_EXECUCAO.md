# RETURN PADRÃO — DEM-022

## 1. IDENTIFICAÇÃO

**Tarefa:**
DEM-022 — Execução Real da Validação PostgreSQL da DEM-021

**Tipo:**
VALIDAÇÃO | AUDITORIA | TESTE DE CONCORRÊNCIA | INTEGRAÇÃO REAL POSTGRESQL

**Status:**
CONCLUÍDO (VALIDADO)

**Data:**
2026-10-08

**IA/Agente:**
Antigravity (Google DeepMind) — Pair Programming & Security Auditor

---

## 2. OBJETIVO

Executar efetivamente a suíte PostgreSQL real da DEM-021 (`tests/integration_real_postgres.test.ts`) em ambiente funcional, produzindo evidências experimentais sem mocks de:

1. Conexão real com PostgreSQL 18;
2. Migrations aplicadas;
3. Presença física da constraint `stock_quantity_non_negative` no catálogo `pg_constraint`;
4. Rejeição real de saldo negativo em nível de engine SQL;
5. Concorrência real via requisições simultâneas com `Promise.all`;
6. Isolamento transacional atômico;
7. Conservação matemática estrita do estoque;
8. Ausência total de movimentos ou auditorias fantasmas;
9. Execução dos 6 testes reais sem nenhum teste pulado (`0 skipped`);
10. Execução e integridade das suítes de regressão (`npm test`, `tsc --noEmit`, `npm run lint`).

---

## 3. RESUMO EXECUTIVO

* **Ambiente Provisionado:** Servidor PostgreSQL 18.4 executado nativamente em `127.0.0.1:5432`, com bridge WebSocket/TCP bidirecional em Node.js (`neon_wsproxy.mjs`) escutando na porta `127.0.0.1:5433`, fornecendo comunicação transparente para o `@prisma/adapter-neon` sem modificações de código de produção.
* **Migrations e Catálogo:** Todas as 3 migrations aplicadas via `npx prisma migrate deploy`. A constraint `stock_quantity_non_negative` (`CHECK ((quantity >= 0))`) foi confirmada no catálogo `pg_constraint`. Tentativas de inserção direta com saldo negativo foram rejeitadas com o erro nativo PostgreSQL `23514` (`check_violation`).
* **Concorrência e Transações Atômicas:**
  * **Cenário A (100 / 25):** 10 requisições simultâneas resultaram em exatamente 4 aprovadas e 6 rejeitadas. Saldo final = 0. Conservação estrita: $100 = (4 \times 25) + 0$.
  * **Cenário B (50 / 15):** 10 requisições simultâneas resultaram em exatamente 3 aprovadas e 7 rejeitadas. Saldo final = 5. Conservação estrita: $50 = (3 \times 15) + 5$.
  * Zero registros órfãos ou fantasmas em `StockMovement` e `AuditLog`.
* **Resultado dos Testes Reais:** **6/6 testes passaram** em `tests/integration_real_postgres.test.ts` com **0 testes pulados** e **0 falhas**.
* **Regressão Completa:** **66/66 testes aprovados** em `npm test` (8 arquivos de teste), `npx tsc --noEmit` com 0 erros e `npm run lint` com 0 erros.
* **Classificação Final:** **VALIDADO**.

---

## 4. RELATÓRIO TÉCNICO FORMAL

### AMBIENTE

* **Sistema Operacional:** Windows 10/11 Enterprise x64
* **Versão do PostgreSQL:** `PostgreSQL 18.4 on x86_64-windows, compiled by msvc-19.44.35226, 64-bit`
* **Versão do Prisma:** `Prisma 7.10.0` (Client v7.10.0 com engine library nativo)
* **Driver / Adapter:** `@prisma/adapter-neon` via `@neondatabase/serverless` (v1.1.0)
* **Mecanismo Empregado:** 
  * Servidor nativo PostgreSQL 18.4 em `127.0.0.1:5432` com autenticação `password`.
  * Bridge WebSocket transparente em Node.js (`neon_wsproxy.mjs`) escutando na porta `127.0.0.1:5433` e efetuando proxy TCP full-duplex para a porta `5432`.
* **Banco de Dados:** `hospital_test`

### CONECTIVIDADE

* **PostgreSQL:** Ativo e ouvindo conexões TCP na porta `5432`.
* **WebSocket Bridge:** Ativa e ouvindo na porta `5433`.
* **Porta 5433 Acessível:** Sim (validada via socket TCP e handshake WebSocket).
* **`DATABASE_URL`:** `postgresql://postgres:***@127.0.0.1:5432/hospital_test` (credenciais preservadas e sanitizadas).
* **Confirmação de Conectividade:** Estabelecida e atestada via consulta de teste `SELECT 1 as result, version()`, com comunicação bidirecional completa atravessando o pipeline Neon Serverless WebSocket.

### MIGRATIONS

Migrations aplicadas via `npx prisma migrate deploy` contra o banco `hospital_test`:

| ID | Nome da Migration | Finished At | Rolled Back |
| :--- | :--- | :--- | :--- |
| `3fe38dfc-700b-4601-a0d7-59c7f461fc96` | `20260923175716_init` | `2026-10-08T17:00:51.166Z` | `null` |
| `519bf2a9-5fb5-448e-a881-14da1f184ea2` | `20260927000000_hospital_sectors_evolution` | `2026-10-08T17:00:51.218Z` | `null` |
| `1ff324db-bf58-405d-8e03-c3e799f2856f` | `20261001140000_stock_non_negative_check` | `2026-10-08T17:00:51.221Z` | `null` |

* **Migration da Constraint:** `20261001140000_stock_non_negative_check`
* **Tabela Afetada:** `Stock`
* **Status:** 3 migrations aplicadas com sucesso (0 pendências).

### CONSTRAINT

Consulta executada diretamente no catálogo PostgreSQL `pg_constraint`:

```json
[
  {
    "constraint_name": "stock_quantity_non_negative",
    "constraint_type": "c",
    "table_name": "\"Stock\"",
    "constraint_definition": "CHECK ((quantity >= 0))"
  }
]
```

#### Teste Físico de Rejeição de Saldo Negativo

Tentativa de inserção com `quantity = -10`:

```sql
INSERT INTO "Stock" ("id", "productId", "sectorId", "quantity", "createdAt", "updatedAt")
SELECT gen_random_uuid(), p.id, s.id, -10, NOW(), NOW()
FROM "Product" p, "Sector" s
WHERE p.code = 'MED-001' AND s.code = 'FARMACIA' LIMIT 1;
```

* **Resultado da Operação:** Operação **REJEITADA** fisicamente pelo motor PostgreSQL.
* **Código de Erro SQLSTATE:** `23514` (`check_violation`).
* **Constraint Acionada:** `stock_quantity_non_negative`.
* **Mensagem:** `new row for relation "Stock" violates check constraint "stock_quantity_non_negative"`.
* **Integridade do Registro:** Saldo original permaneceu íntegro e inalterado. Nenhuma operação parcial foi persistida. Registros com `quantity < 0` na base: **0**.

### CONCORRÊNCIA

A execução atravessou o pipeline completo de produção:
`NextRequest` → Route Handler (`POST /api/inventory/exit`) → `prisma.$transaction` → Driver `@prisma/adapter-neon` → WebSocket Bridge → PostgreSQL 18.4 → Commit/Rollback → Consultas de Auditoria.

* **Sem mocks de `$transaction`**
* **Sem banco de dados simulado em memória**
* **Sem substituição de banco por variáveis de estado**

#### Cenário Obrigatório A (Saldo 100 / 10 requisições simultâneas de 25)
* **Saldo inicial:** 100
* **Quantidade solicitada por requisição:** 25
* **Número de requisições simultâneas (`Promise.all`):** 10
* **Respostas aprovadas (HTTP 201):** 4
* **Respostas rejeitadas (HTTP 400 - Saldo insuficiente):** 6
* **Saldo final registrado no PostgreSQL:** 0
* **Movimentos criados em `StockMovement`:** 4 (cada um debitando 25, total debitado = 100)
* **Auditorias criadas em `AuditLog`:** 4 (ação `INVENTORY_EXIT`)
* **Registros órfãos/fantasmas para requisições rejeitadas:** 0
* **Existência de saldo negativo:** NÃO (`quantity = 0`)
* **Conservação matemática estrita:**
  $$\text{Saldo Final } (0) + \text{Saídas Confirmadas } (100) = \text{Saldo Inicial } (100) \quad \implies \quad 100 = 100 \quad \text{[VÁLIDO]}$$

#### Cenário Obrigatório B (Saldo 50 / 10 requisições simultâneas de 15)
* **Saldo inicial:** 50
* **Quantidade solicitada por requisição:** 15
* **Número de requisições simultâneas (`Promise.all`):** 10
* **Respostas aprovadas (HTTP 201):** 3 (capacidade exata: $3 \times 15 = 45 \le 50$)
* **Respostas rejeitadas (HTTP 400 - Saldo insuficiente):** 7
* **Saldo final registrado no PostgreSQL:** 5
* **Movimentos criados em `StockMovement`:** 3 (total debitado = 45)
* **Auditorias criadas em `AuditLog`:** 3
* **Registros órfãos/fantasmas para requisições rejeitadas:** 0
* **Existência de saldo negativo:** NÃO (`quantity = 5`)
* **Conservação matemática estrita:**
  $$\text{Saldo Final } (5) + \text{Saídas Confirmadas } (45) = \text{Saldo Inicial } (50) \quad \implies \quad 50 = 50 \quad \text{[VÁLIDO]}$$

### RESULTADO DOS 6 TESTES REAIS

Execução via `npx vitest run tests/integration_real_postgres.test.ts --reporter=verbose`:

```text
 ✓ tests/integration_real_postgres.test.ts > DEM-021: Validação de Integração Real com PostgreSQL (Sem Mocks de Persistência) > 1. Verificação da Constraint stock_quantity_non_negative no PostgreSQL Real > deve confirmar a presença da constraint CHECK no catálogo pg_constraint (20ms)
 ✓ tests/integration_real_postgres.test.ts > DEM-021: Validação de Integração Real com PostgreSQL (Sem Mocks de Persistência) > 1. Verificação da Constraint stock_quantity_non_negative no PostgreSQL Real > deve rejeitar fisicamente uma tentativa de definir quantidade negativa via UPDATE (88ms)
 ✓ tests/integration_real_postgres.test.ts > DEM-021: Validação de Integração Real com PostgreSQL (Sem Mocks de Persistência) > 1. Verificação da Constraint stock_quantity_non_negative no PostgreSQL Real > deve rejeitar fisicamente uma tentativa de inserir novo registro com quantidade negativa via INSERT (15ms)
 ✓ tests/integration_real_postgres.test.ts > DEM-021: Validação de Integração Real com PostgreSQL (Sem Mocks de Persistência) > 2. Concorrência Real no PostgreSQL — Cenário Obrigatório A (100 / 25) > executa 10 requisições simultâneas de 25 sobre saldo 100 resultando em exatamente 4 aprovadas e 6 rejeitadas (440ms)
 ✓ tests/integration_real_postgres.test.ts > DEM-021: Validação de Integração Real com PostgreSQL (Sem Mocks de Persistência) > 3. Concorrência Real no PostgreSQL — Cenário Obrigatório B (Saldo 50 / 10 x 15) > executa 10 requisições simultâneas de 15 sobre saldo 50 resultando em exatamente 3 aprovadas e saldo remanescente 5 (428ms)
 ✓ tests/integration_real_postgres.test.ts > DEM-021: Validação de Integração Real com PostgreSQL (Sem Mocks de Persistência) > 4. Reset de Senha de Ponta a Ponta com PostgreSQL Real (DEM-018) > executa o ciclo completo de solicitação, persistência de hash SHA-256, consumo atômico e prevenção de replay (1155ms)

Test Files  1 passed (1)
     Tests  6 passed (6)
   Skipped  0 skipped (0)
    Failed  0 failed (0)
  Duration  3.06s
```

* **Testes executados:** 6
* **Testes aprovados:** 6
* **Testes pulados:** 0
* **Testes falhados:** 0

### RATE LIMITING

Suíte `tests/rate_limiting.test.ts`:

* **Resultado da Execução:** 3 testes executados, 3 aprovados (0 falhas).
* **Mapeamento de Infraestrutura vs Mocks:**
  * **Cenário B (Upstash Ausente / Fail-Open):** Executa o middleware real `proxy.ts` sem as variáveis de ambiente `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`. Testa comportamento de infraestrutura nativo em modo Fail-Open (retorna 200).
  * **Cenário A (Upstash Ativo / 429):** Utiliza mocks unitários do Vitest (`vi.doMock('@upstash/ratelimit')` e `vi.doMock('@upstash/redis')`) para simular a resposta de cota esgotada do Redis remoto e validar a geração do cabeçalho `Retry-After` e HTTP 429. Não conecta a uma instância remota ao vivo de Redis.
  * **Cenário C (Redis Indisponível):** Utiliza mock de falha/rejeição de Promise para diagnosticar o comportamento do proxy na ausência de bloco `try/catch` defensivo.
* **Nota de Conformidade:** Conforme estipulado na Seção 11 da DEM-022, o rate limiting permaneceu separado e sua infraestrutura não foi alterada.

### REGRESSÃO

Validação completa de regressão da aplicação:

1. **Suíte Geral de Testes (`npm test`):**
   ```text
   Test Files  8 passed (8)
        Tests  66 passed (66)
      Skipped  0 skipped (0)
       Failed  0 failed (0)
     Duration  3.47s
   ```
   * `tests/phase1_verification.test.ts`: 10 passed
   * `tests/phase2_verification.test.ts`: 7 passed
   * `tests/phase3_verification.test.ts`: 8 passed
   * `tests/phase4_reset_password.test.ts`: 10 passed
   * `tests/hospital_sectors_stock.test.ts`: 12 passed
   * `tests/security.test.ts`: 10 passed
   * `tests/rate_limiting.test.ts`: 3 passed
   * `tests/integration_real_postgres.test.ts`: 6 passed

2. **Compilação TypeScript (`npx tsc --noEmit`):** Exit code 0 (0 erros de tipagem).
3. **Linter ESLint (`npm run lint`):** Exit code 0 (0 erros, 26 avisos cosméticos pré-existentes de variáveis não utilizadas).

### ALTERAÇÕES REALIZADAS

* **Código de Produção (`src/`):** NENHUMA alteração realizada (0 arquivos modificados).
* **Código de Testes (`tests/`):** NENHUMA alteração realizada nos testes existentes (0 arquivos modificados).
* **Repositório Git:** Árvore de trabalho limpa (`working tree clean`), branch `main` sincronizada com `origin/main`.
* **Ações Operacionais de Infraestrutura Executadas:**
  1. Provisionamento de cluster PostgreSQL 18.4 Windows x64 na porta `5432`.
  2. Execução da bridge WebSocket (`neon_wsproxy.mjs`) escutando na porta `127.0.0.1:5433` e encaminhando para `127.0.0.1:5432`.
  3. Aplicação das 3 migrations via `npx prisma migrate deploy` contra o banco `hospital_test`.
  4. Carga inicial de setores, categorias, permissões, usuários e lotes via seed oficial.

### EVIDÊNCIAS

1. **Catálogo `pg_constraint`:** Constraint `stock_quantity_non_negative` ativa e do tipo `c` (CHECK) na relação `"Stock"`.
2. **Rejeição SQL Real:** Violação da constraint capturada com código nativo `23514` (`check_violation`).
3. **Concorrência Real Atravessando o Banco:**
   * Cenário A: 4 aprovadas, 6 rejeitadas, saldo final 0, movimentações 4, auditorias 4.
   * Cenário B: 3 aprovadas, 7 rejeitadas, saldo final 5, movimentações 3, auditorias 3.
   * Zero registros órfãos ou fantasmas criados nas requisições rejeitadas.
4. **Execução Completa Sem Skips:**
   * `npx vitest run tests/integration_real_postgres.test.ts`: 6 passed, 0 skipped, 0 failed.
   * `npm test`: 66 passed, 0 skipped, 0 failed.
5. **Compilação e Linter:** TypeScript e ESLint aprovados com código de saída 0.

### RISCOS

* **Mapeamento de Lote Nulo em Chave Composta do Prisma 7:** Permanece documentado que o `findUnique` do Prisma 7 rejeita `batchId: null` em constraints compostas com colunas anuláveis. Para produtos sem lote, a aplicação deverá migrar para `findFirst` em demanda de refatoração futura.
* **Resiliência do Rate Limiter sob Indisponibilidade Externa:** Permanece documentado que a ausência de bloco `try/catch` envolvendo `ratelimit.limit()` em `src/proxy.ts` gera Unhandled Rejection (HTTP 500 no Edge) caso o serviço Upstash Redis sofra timeout ou indisponibilidade de rede.

---

## 5. RESULTADO FINAL

**VALIDADO**
