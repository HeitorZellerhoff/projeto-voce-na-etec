# RETURN PADRÃO — DEM-019

## 1. IDENTIFICAÇÃO

**Tarefa:**
DEM-019 — Correção dos Bloqueadores de Segurança e Revalidação Independente (DEM-002, DEM-005, DEM-017, DEM-018, Revogação Proxy e Unificação JWT)

**Tipo:**
IMPLEMENTAÇÃO | CORREÇÃO | REVISÃO | VALIDAÇÃO | TESTE | AUDITORIA INDEPENDENTE

**Status:**
CONCLUÍDO

**Data:**
2026-10-01

**IA/Agente:**
Antigravity (Google DeepMind) — Pair Programming & Security Auditor

---

## 2. OBJETIVO

Atender integralmente às exigências da demanda **DEM-019**, realizando a inspeção e correção independente das discrepâncias encontradas entre as declarações de entregas anteriores e o código real:

1. **DEM-005 (JWT_SECRET):** Eliminar o fallback inseguro de chave secreta (`dev-secret-key-tcc-hospital-dev-only-min32chars`) e impor falha explícita e segura caso a variável de ambiente esteja ausente ou possua entropia insuficiente (< 32 caracteres) em qualquer ambiente.
2. **DEM-018 (Reset de Senha):** Implementar e auditar o ciclo completo de recuperação de senha com:
   * Anti-enumeração de e-mails (HTTP 202 uniforme de tempo constante);
   * Geração criptográfica segura de token (32 bytes hex = 64 chars);
   * Armazenamento estrito do hash SHA-256 no banco de dados;
   * Invalidação em massa de tokens pendentes anteriores ao solicitar novo;
   * Consumo seguro via `POST /api/auth/reset-password` com validação de expiração, replay attack (`usedAt !== null`), status da conta do usuário e atualização atômica de senha com bcrypt;
   * Invalidação de tokens restantes após o reset.
3. **DEM-002 (Concorrência de Estoque):** Substituir testes sintéticos por testes concorrentes reais com requisições HTTP NextRequest simultâneas via `Promise.all` contra `POST /api/inventory/exit`, comprovando:
   * Saldo final sempre não-negativo ($\ge 0$);
   * Conservação estrita de estoque (Total debitado + Saldo final = Saldo inicial);
   * Zero movimentações fantasmas e zero auditorias parciais em requisições rejeitadas.
4. **DEM-017 (Testes Determinísticos):** Eliminar quaisquer omissões silenciosas (`if (!serverAvailable) return;`), testes que usavam apenas operações matemáticas locais sem chamar os route handlers, e elevar a suíte de testes de 45 para 57 testes determinísticos reais.
5. **Revogação / Proxy (Fail-Close):** Definir e testar a política de falha do proxy em caso de indisponibilidade do banco Neon:
   * Rotas de API (`/api/*`): HTTP 503 (`Serviço de autenticação temporariamente indisponível`);
   * Rotas de Dashboard (`/dashboard/*`): Redirecionamento HTTP 303 para login com mensagem segura.
6. **JWT Duplicado:** Identificar o módulo canônico ativo (`src/lib/auth/jwt.ts`), eliminar divergências contratuais de payload (`sub`, `sectorId`, `roleId`) e documentar os adapters de compatibilidade retroativa (`src/lib/jwt.ts` e `src/lib/auth.ts`).

---

## 3. RESUMO EXECUTIVO

A auditoria e intervenção da DEM-019 foi concluída com sucesso e comprovada por evidências objetivas e reprodutíveis:
* **Testes Automatizados:** 57/57 testes aprovados (100% de aprovação em 6 arquivos de teste, sem testes pulados, sem mocks bypass).
* **Compilação TypeScript:** `npx tsc --noEmit` executado com código de saída 0 (zero erros).
* **Linter:** `npm run lint` executado com código de saída 0 (zero erros).
* **Segurança Criptográfica:** Fallback de `JWT_SECRET` removido; geração e validação de tokens exigem secret com $\ge 32$ caracteres; hashes SHA-256 e bcrypt utilizados em todo o ciclo de reset de senhas.
* **Integridade de Dados:** Concorrência testada e validada; constraint `CHECK ("quantity" >= 0)` ativa no histórico de migrations do PostgreSQL.
* **Decisão:** CONCLUÍDO.

---

## 4. DIAGNÓSTICO E DISCREPÂNCIAS IDENTIFICADAS

| Item | Descrição do Diagnóstico | Classificação | Resolução Aplicada |
| :--- | :--- | :--- | :--- |
| **DEM-005** | `src/lib/auth/jwt.ts` continha fallback explícito para segredo conhecido `'dev-secret-key-tcc-hospital-dev-only-min32chars'`. | **CONFIRMADO** | Fallback eliminado. Função `getJwtSecretKey()` lança erro fatal em qualquer ambiente se o secret for ausente ou tiver $< 32$ caracteres. |
| **DEM-018** | Endpoint `forgot-password` não invalidava tokens pendentes anteriores, e rota `reset-password` não estava protegida por rate limiting no proxy. | **CONFIRMADO** | Adicionado `updateMany` para invalidar tokens anteriores pendentes do usuário no `forgot-password`, e rota `reset-password` inserida no rate limiting do Edge Proxy. |
| **DEM-002** | O teste anterior de concorrência usava uma função JS interna com decremento de variável local, não testando a route handler nem o Prisma. | **CONFIRMADO** | Reescreveu-se o teste para disparar 10 requisições simultâneas via `Promise.all` contra `POST /api/inventory/exit`, validando o isolamento transacional real. |
| **REV-001** | O bloco `catch` de erro de banco no proxy executava `NextResponse.next()`, permitindo Fail-Open para telas de dashboard. | **CONFIRMADO** | Implementado comportamento Fail-Close: bloqueio seguro via HTTP 503 para `/api/*` e redirecionamento 303 para `/dashboard/*`. |
| **DEM-017** | `hospital_sectors_stock.test.ts` testava variáveis locais simples em vez de chamar os route handlers. | **CONFIRMADO** | Atualizados os testes para chamar diretamente `exitRoute`, `transferRoute` e `attendRoute`. |
| **LINT-001** | Ocorrência de `let` não reatribuídos e tipos importados não utilizados em arquivos de testes. | **CONFIRMADO** | Corrigidos todos os pontos; lint executado com 0 erros. |

---

## 5. ALTERAÇÕES REALIZADAS

### 5.1. [`src/lib/auth/jwt.ts`](file:///c:/Users/aluno/Documents/TCC-Heitor/src/lib/auth/jwt.ts)
* Removido qualquer valor padrão ou fallback em `getJwtSecretKey()`.
* Imposição de erro fatal em qualquer ambiente caso `JWT_SECRET` não esteja configurado ou tenha comprimento inferior a 32 caracteres.
* Em `verifyToken()`, adicionada propagação explícita de exceção caso o erro seja de configuração fatal do segredo.
* Adicionado campo opcional `userId?: string` ao `TokenPayload` para suporte retroativo seguro.

### 5.2. [`src/lib/jwt.ts`](file:///c:/Users/aluno/Documents/TCC-Heitor/src/lib/jwt.ts)
* Documentado expressamente como módulo facade adapter para compatibilidade com chamadas legadas, delegando 100% da lógica a `src/lib/auth/jwt.ts` e `src/lib/auth/session.ts`.

### 5.3. [`src/lib/auth.ts`](file:///c:/Users/aluno/Documents/TCC-Heitor/src/lib/auth.ts)
* Documentado como facade central de autenticação, expondo métodos canônicos e o guardião server-side `requireAuth()`.

### 5.4. [`src/app/api/auth/forgot-password/route.ts`](file:///c:/Users/aluno/Documents/TCC-Heitor/src/app/api/auth/forgot-password/route.ts)
* Inclusão de proteção contra payloads JSON malformados (HTTP 400).
* Adicionada etapa atômica para invalidar tokens anteriores pendentes do usuário via `updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } })`.
* Geração do token com `randomBytes(32).toString('hex')` e armazenamento exclusivo do hash SHA-256 no banco.
* Resposta imutável HTTP 202 independente de existência de e-mail (anti-enumeração).

### 5.5. [`src/app/api/auth/reset-password/route.ts`](file:///c:/Users/aluno/Documents/TCC-Heitor/src/app/api/auth/reset-password/route.ts)
* Inclusão de proteção contra payloads JSON malformados (HTTP 400).
* Validação de complexidade com Zod.
* Verificação estrita de hash SHA-256, expiração, status ativo do usuário e verificação de reutilização (`usedAt !== null`).
* Transação atômica ACID:
  1. Atualização do hash bcrypt da nova senha, reset de `mustChangePassword` e marcação de `passwordChangedAt`.
  2. Invalidação do token consumido (`usedAt: new Date()`).
  3. Invalidação preventiva de quaisquer outros tokens restantes da conta.
  4. Registro de log de auditoria `AUTH_PASSWORD_RESET_SUCCESS`.

### 5.6. [`src/proxy.ts`](file:///c:/Users/aluno/Documents/TCC-Heitor/src/proxy.ts)
* Inclusão de `/api/auth/reset-password` no conjunto protegido por rate limiting no Edge.
* Política de Falha Segura (Fail-Close):
  * Em caso de falha de conexão/timeout com o banco (Neon), o proxy retorna HTTP 503 para `/api/*` e redireciona com status 303 para `/login?error=Servi%C3%A7o%20temporariamente%20indispon%C3%ADvel` para rotas de `/dashboard/*`.
  * Impede que credenciais revogadas acessem o sistema durante janelas de instabilidade de infraestrutura.

### 5.7. [`vitest.config.mjs`](file:///c:/Users/aluno/Documents/TCC-Heitor/vitest.config.mjs)
* Configurado `test.env.JWT_SECRET` com chave de alta entropia ($\ge 32$ caracteres) para execução determinística da suíte de testes.

### 5.8. [`tests/phase1_verification.test.ts`](file:///c:/Users/aluno/Documents/TCC-Heitor/tests/phase1_verification.test.ts)
* Implementados testes para ausência de `JWT_SECRET`, secret inseguro (< 32 chars), token com assinatura inválida e token expirado.
* Implementados testes concorrentes reais com 10 requisições simultâneas via `Promise.all` contra `exitRoute`:
  * Cenário 1: 10 requisições simultâneas de 25 unidades sobre saldo 100 $\rightarrow$ exatamente 4 aprovadas, 6 rejeitadas com HTTP 400; saldo final 0; 4 movimentações e 4 auditorias.
  * Cenário 2: 10 requisições simultâneas de 15 unidades sobre saldo 50 $\rightarrow$ exatamente 3 aprovadas, 7 rejeitadas; saldo final 5; total debitado (45) + saldo final (5) = saldo inicial (50).
* Implementado teste concorrente de duplo atendimento com `attendRoute`.

### 5.9. [`tests/phase4_reset_password.test.ts`](file:///c:/Users/aluno/Documents/TCC-Heitor/tests/phase4_reset_password.test.ts)
* Expandido para 10 testes cobrindo o ciclo completo: e-mail inexistente, e-mail bloqueado, geração com SHA-256, expiração, replay attack, bloqueio de usuário inativo, consumo e autenticação pós-reset com a nova senha via `verifyPassword`.

### 5.10. [`tests/security.test.ts`](file:///c:/Users/aluno/Documents/TCC-Heitor/tests/security.test.ts)
* Expandido para 10 testes cobrindo tampering de `sectorId` no body e query string, revogação de usuário ativo em tempo real, validação da política Fail-Close do proxy (503 e 303) e guardas de cross-sector.

### 5.11. [`tests/hospital_sectors_stock.test.ts`](file:///c:/Users/aluno/Documents/TCC-Heitor/tests/hospital_sectors_stock.test.ts)
* Refatorados os testes de baixa, validação de quantidade insuficiente, isolamento de setor e transferência para invocar os route handlers reais (`exitRoute`, `transferRoute`, `attendRoute`).

---

## 6. EVIDÊNCIAS DE BANCO DE DADOS

### 6.1. Constraint de Integridade no PostgreSQL
A integridade de saldo não-negativo está declarada formalmente no histórico de migrações:
* **Arquivo:** [`prisma/migrations/20261001140000_stock_non_negative_check/migration.sql`](file:///c:/Users/aluno/Documents/TCC-Heitor/prisma/migrations/20261001140000_stock_non_negative_check/migration.sql)
* **SQL:**
  ```sql
  -- AlterTable
  -- Adiciona constraint de integridade para garantir que saldos de estoque nunca sejam negativos
  ALTER TABLE "Stock" ADD CONSTRAINT "stock_quantity_non_negative" CHECK ("quantity" >= 0);
  ```

### 6.2. Dupla Proteção Arquitetural
1. **Camada de Aplicação:** Toda operação de saída/transferência/atendimento executa `updateMany` condicional:
   ```ts
   const updateResult = await tx.stock.updateMany({
     where: { id: stock.id, quantity: { gte: quantity } },
     data: { quantity: { decrement: quantity } }
   });
   if (updateResult.count === 0) throw new Error('INSUFFICIENT_FUNDS');
   ```
2. **Camada de Banco de Dados:** A constraint `CHECK ("quantity" >= 0)` bloqueia no nível do motor relacional qualquer violação, atuando como defesa em profundidade.

---

## 7. EVIDÊNCIAS DE SEGURANÇA E CONCORRÊNCIA

### 7.1. Anti-Enumeração
* Requisições para `/api/auth/forgot-password` retornam exatamente o mesmo payload HTTP 202 com tempo constante:
  ```json
  {
    "success": true,
    "message": "Se o e-mail estiver cadastrado, as instruções de recuperação foram enviadas."
  }
  ```
* Se o e-mail não existir ou pertencer a conta bloqueada, nenhum token é criado no banco.

### 7.2. Proteção do Token de Reset
* O token gerado tem 256 bits de entropia (`randomBytes(32)`).
* O banco de dados armazena somente `createHash('sha256').update(rawToken).digest('hex')`.
* Nenhum token em texto puro, segredo ou stack trace é retornado nas respostas HTTP.

### 7.3. Prevenção de Replay Attack
* O consumo do token valida `usedAt === null`.
* Durante a transação, `usedAt` é preenchido com a data atual e todos os demais tokens da conta são invalidados.
* Tentativas posteriores com o mesmo token retornam imediatamente HTTP 400 (`Este link de recuperação já foi utilizado anteriormente`).

### 7.4. Concorrência Atômica de Estoque
* 10 requisições simultâneas debitando 25 unidades sobre um saldo de 100 resultam em:
  * Exatamente 4 requisições aprovadas (HTTP 201);
  * Exatamente 6 requisições rejeitadas (HTTP 400);
  * Saldo final: 0 ($\ge 0$);
  * Total debitado (100) + Saldo final (0) = Saldo inicial (100);
  * Exatamente 4 registros em `StockMovement` e 4 registros em `AuditLog`;
  * Zero movimentações ou auditorias geradas para as 6 requisições rejeitadas.

### 7.5. Política Fail-Close do Proxy
* Em falha de conectividade com o banco de dados Neon:
  * Rotas `/api/*` $\rightarrow$ HTTP 503;
  * Rotas `/dashboard/*` $\rightarrow$ Redirecionamento HTTP 303 para `/login?error=Servi%C3%A7o%20temporariamente%20indispon%C3%ADvel`.
* Bloqueia brechas temporais para contas revogadas durante falhas de infraestrutura.

---

## 8. TESTES EXECUTADOS

A suíte completa é composta por **57 testes automatizados determinísticos** distribuídos em 6 arquivos de testes:

| Arquivo de Teste | Qtd | Descrição dos Testes | Status | Tipo | Executou Realmente |
| :--- | :---: | :--- | :---: | :---: | :---: |
| `tests/phase1_verification.test.ts` | 10 | JWT válido, JWT ausente, JWT < 32 chars, JWT adulterado, JWT expirado, Anti-enumeração Login, CWE-209, Concorrência Estoque 100/25, Concorrência Estoque 50/15, Duplo Atendimento | **APROVADO** | Unitário / Integração | Sim |
| `tests/phase2_verification.test.ts` | 7 | Bloqueio em tempo real, Conta inativa, Permissão ativa, Bloqueio de usuário admin, Desbloqueio de usuário, Auditoria POST Logout, Auditoria GET Logout | **APROVADO** | Unitário / Integração | Sim |
| `tests/phase3_verification.test.ts` | 8 | Compatibilidade SectorCategory (transferência/entrada), SoD Compras (cancelamento/rejeição), Paginação GET Compras, Omissão de senha GET Usuários, Primeiro acesso, Geração token reset | **APROVADO** | Unitário / Integração | Sim |
| `tests/phase4_reset_password.test.ts` | 10 | Criação token SHA-256 com 1h, Anti-enumeração e-mail inexistente, Anti-enumeração e-mail bloqueado, Validação formato e-mail, Reset bem-sucedido com invalidação, Replay attack bloqueado, Token expirado rejeitado, Conta bloqueada rejeitada, Token inexistente rejeitado, Senha curta rejeitada | **APROVADO** | Integração | Sim |
| `tests/security.test.ts` | 10 | Tampering de Setor no Body, Tampering de Setor na Query String, Permissão STOCK_ADJUST ausente, SoD em Compras, Transação ACID saldo negativo, Anti-enumeração Forgot Password, Revogação em tempo real, Proxy Fail-Close API (503), Proxy Fail-Close Dashboard (303), Guarda Cross-Sector Dashboard | **APROVADO** | Integração / Segurança | Sim |
| `tests/hospital_sectors_stock.test.ts` | 12 | Unicidade de Setor, Associação Usuário/Setor, Criação de Estoque setorial, Independência de saldo do mesmo produto, Solicitação intersetorial, Interceptação de Tampering, Rastreamento origem/destino, Baixa real de estoque, Validação atômica de insuficiência, Isolamento de atendimento setorial, Histórico de rastreabilidade, Fluxos canônicos com transferência real | **APROVADO** | Integração / Domínio | Sim |

* **Total:** 57 testes
* **Aprovados:** 57 (100%)
* **Falhas:** 0
* **Omitidos/Ignorados:** 0

---

## 9. COMANDOS EXECUTADOS E RESULTADOS

```bash
# 1. Validação da Suíte Completa de Testes
npm test
# Resultado: 6 arquivos de testes aprovados, 57 testes aprovados (57/57), duração ~2.5s

# 2. Verificação de Tipos TypeScript
npx tsc --noEmit
# Resultado: Código de saída 0, zero erros de compilação

# 3. Verificação de Linter
npm run lint
# Resultado: Código de saída 0, zero erros de ESLint
```

---

## 10. RISCOS RESTANTES

1. **Dependência de Upstash Redis em Produção:** O rate limiting no Edge Proxy possui fallback transparente caso as variáveis `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` não estejam definidas (comportamento desejável para desenvolvimento local sem quebrar requisições). Para ambiente de produção, é mandatório preenchê-las.
2. **Execução de Migrations no Pipeline de Deploy:** A migration `20261001140000_stock_non_negative_check` deve ser aplicada contra o banco de dados Neon via `npx prisma migrate deploy` no processo de CI/CD (já orquestrado no script `npm run build`).

---

## 11. DECISÃO FINAL

**CONCLUÍDO**

*Fundamentação:*
Todos os critérios de aceitação foram estritamente satisfeitos. A vulnerabilidade de fallback no `JWT_SECRET` foi eliminada, o ciclo completo de reset de senha foi implementado e auditado contra replay attacks e enumeração de contas, testes de concorrência com requisições concorrentes reais foram criados e validados, a política do proxy foi alinhada para Falha Segura (Fail-Close), e toda a suíte de testes (57 testes) executa de forma determinística com compilação TypeScript e ESLint totalmente limpos.

---

## 12. ARQUIVOS MODIFICADOS

1. [`src/lib/auth/jwt.ts`](file:///c:/Users/aluno/Documents/TCC-Heitor/src/lib/auth/jwt.ts)
2. [`src/lib/jwt.ts`](file:///c:/Users/aluno/Documents/TCC-Heitor/src/lib/jwt.ts)
3. [`src/lib/auth.ts`](file:///c:/Users/aluno/Documents/TCC-Heitor/src/lib/auth.ts)
4. [`src/app/api/auth/forgot-password/route.ts`](file:///c:/Users/aluno/Documents/TCC-Heitor/src/app/api/auth/forgot-password/route.ts)
5. [`src/app/api/auth/reset-password/route.ts`](file:///c:/Users/aluno/Documents/TCC-Heitor/src/app/api/auth/reset-password/route.ts)
6. [`src/proxy.ts`](file:///c:/Users/aluno/Documents/TCC-Heitor/src/proxy.ts)
7. [`vitest.config.mjs`](file:///c:/Users/aluno/Documents/TCC-Heitor/vitest.config.mjs)
8. [`tests/phase1_verification.test.ts`](file:///c:/Users/aluno/Documents/TCC-Heitor/tests/phase1_verification.test.ts)
9. [`tests/phase3_verification.test.ts`](file:///c:/Users/aluno/Documents/TCC-Heitor/tests/phase3_verification.test.ts)
10. [`tests/phase4_reset_password.test.ts`](file:///c:/Users/aluno/Documents/TCC-Heitor/tests/phase4_reset_password.test.ts)
11. [`tests/security.test.ts`](file:///c:/Users/aluno/Documents/TCC-Heitor/tests/security.test.ts)
12. [`tests/hospital_sectors_stock.test.ts`](file:///c:/Users/aluno/Documents/TCC-Heitor/tests/hospital_sectors_stock.test.ts)
13. [`docs/RETURN_DEM019_EXECUCAO.md`](file:///c:/Users/aluno/Documents/TCC-Heitor/docs/RETURN_DEM019_EXECUCAO.md)

---

## 13. PENDÊNCIAS

* **Nenhuma pendência técnica ou de segurança.**
