# 🏥 Relatório Geral de Implementações do Projeto — Sistema de Gestão e Logística Hospitalar (TCC)

**Projeto:** Sistema Integrado de Gestão de Estoque e Logística Hospitalar (Enterprise Hospital Inventory Management System)  
**Contexto:** Trabalho de Conclusão de Curso (TCC) / Projeto Você na ETEC  
**Status Atual:** Fase de Homologação, Testes de Segurança & Preparação para Produção  
**Versão:** 1.0.0  

---

## 📑 Sumário Executivo

O sistema foi projetado para resolver os desafios críticos da gestão de suprimentos e medicamentos no ambiente hospitalar:
1. **Isolamento Estrito de Estoques por Setor:** O mesmo medicamento ou material médico existe em múltiplos setores (Farmácia Central, Almoxarifado, Enfermaria, Centro Cirúrgico, UTIs), possuindo saldos, estoques mínimos e responsabilidades totalmente desacopladas.
2. **Segurança de Acesso e IAM (Identity & Access Management):** Controle de permissões granulares baseado em papéis (*Role-Based Access Control - RBAC*), autenticação *stateless* via JWT HttpOnly na Edge e bloqueio contra ataques de manipulação de parâmetros (*Parameter Tampering* e *Cross-Sector Spoofing*).
3. **Rastreabilidade e Trilha de Auditoria Imutável:** Registro completo de toda movimentação (Entrada, Saída, Transferência, Ajuste e Atendimento de Solicitações) com carimbo de tempo, usuário responsável, setor de origem/destino e lote/validade.
4. **Segregação de Funções (SoD - Segregation of Duties):** Garantia de que processos críticos (como aprovação de compras e ajustes manuais de estoque) sigam regras de integridade corporativa.

---

## 🛠️ 1. Arquitetura e Stack Tecnológica

| Camada | Tecnologia | Descrição / Função |
| :--- | :--- | :--- |
| **Frontend** | Next.js 16 (App Router) + React 19 | Interface moderna, server components, renderização rápida e design responsivo. |
| **Estilização** | Tailwind CSS v4 + Lucide Icons | Design corporativo com tema escuro (Dark Mode), contrastes médicos e microinterações. |
| **Linguagem** | TypeScript 5 | Tipagem estática em 100% do código (Front-end, Back-end e Testes). |
| **Banco de Dados** | Neon PostgreSQL (Serverless) | Banco relacional na nuvem com connection pooling otimizado para Vercel. |
| **ORM** | Prisma ORM v7 (`@prisma/adapter-neon`) | Modelagem de dados segura com queries tipadas e migrações estruturadas. |
| **Autenticação** | `jose` (JWT) + Cookies `HttpOnly` | Autenticação stateless de alta performance executada no Edge Runtime. |
| **Proteção & WAF** | Upstash Redis + `@upstash/ratelimit` | Limitação de taxa (*Rate Limiting*) para mitigar ataques de força bruta no login. |
| **Testes** | Vitest | Suíte de testes unitários e de integração de segurança e regras de negócio. |
| **CI/CD** | GitHub Actions | Pipeline automatizado de lint, checagem de tipos, testes e validação de build. |

---

## ✅ 2. O que JÁ FOI IMPLEMENTADO

### 2.1. Modelagem do Banco de Dados Relacional (Prisma Schema)
- [x] **Gestão de Usuários e Autenticação:**
  - `User`: Registro institucional, e-mail único, hash bcrypt, status (`ATIVO`, `BLOQUEADO`, `INATIVO`, `PENDENTE`), flag de primeiro acesso (`mustChangePassword`), vínculo estrito a um `Sector` e a uma `Role`.
  - `PasswordResetToken`: Controle de tokens seguros com expiração para recuperação de senha sem vazamento de dados.
- [x] **Estrutura Organizacional e Setores:**
  - `Sector`: Código único, nome, descrição, localização, responsável e status.
  - `Category` e `SectorCategory`: Categorização de produtos e tabela associativa de compatibilidade de categorias por setor.
- [x] **Controle de Acessos Granular (IAM & RBAC):**
  - `Role`: Papéis estruturados (`ADMINISTRADOR`, `FARMACEUTICO`, `ALMOXARIFE`, `ENFERMEIRO`, `MEDICO_CIRURGIAO`, `COMPRADOR`, `SUPERVISOR`).
  - `Permission`: Ações atômicas (`STOCK_VIEW`, `STOCK_MANAGE`, `STOCK_ADJUST`, `REQUEST_CREATE`, `REQUEST_ATTEND`, `PURCHASE_APPROVE`, `USER_MANAGE`, etc.).
  - `RolePermission`: Relacionamento n:n associando permissões aos perfis de acesso.
- [x] **Catálogo de Produtos, Lotes e Estoques:**
  - `Product`: Código de identificação, nome, unidade de medida, categoria, ponto de estoque mínimo e máximo.
  - `ProductBatch`: Controle de lotes (`batchNumber`), fabricante e data de validade (`expirationDate`).
  - `Stock`: Entidade isolada com chave única `[productId, sectorId, batchId]`, garantindo que cada setor tenha sua contabilidade de saldo independente.
- [x] **Movimentações e Rastreabilidade:**
  - `StockMovement`: Tipos de movimentação (`ENTRADA`, `SAIDA`, `AJUSTE`, `TRANSFERENCIA`, `DEVOLUCAO`, `PERDA`, `VENCIMENTO`), saldo anterior, novo saldo, setor de origem, setor de destino, usuário executor e vínculo à solicitação.
- [x] **Fluxo de Solicitações entre Setores:**
  - `SectorRequest`: Setor solicitante, setor fornecedor, solicitante, atendente, status (`PENDENTE`, `APROVADA`, `ATENDIDA`, `REJEITADA`, `CANCELADA`) e observação.
  - `SectorRequestItem`: Itens solicitados, quantidades pedidas, quantidades aprovadas e entregues.
- [x] **Compras e Cadeia de Fornecedores:**
  - `Supplier`: Cadastro de fornecedores homologados com CNPJ único e status.
  - `Purchase` e `PurchaseItem`: Ordens de compra, cotações, valor total, usuário solicitante, usuário aprovador e status de entrega.
- [x] **Auditoria Geral:**
  - `AuditLog`: Registro imutável de ações (`action`, `entity`, `entityId`, `metadata`, `ipAddress`, `userAgent`, `createdAt`).

---

### 2.2. Segurança Perimetral, Middlewares e Guards
- [x] **Proxy Edge com Validação de Identidade (`src/proxy.ts`):**
  - Interceptação de rotas protegidas (`/dashboard/*` e `/api/*`).
  - Bloqueio de acesso de usuários sem sessão válida (redirecionamento 303 para `/login`).
  - Consulta otimizada na borda via driver HTTP do Neon para validar status de bloqueio, primeiro acesso e setor do usuário.
  - Redirecionamento obrigatório para `/primeiro-acesso` caso a flag `mustChangePassword` esteja ativa.
  - Bloqueio de travessia setorial (*Cross-Sector Protection*): impede que colaboradores comuns acessem painéis de outros setores pela URL (exibição de página 403 amigável).
- [x] **Proteção Anti-Força Bruta (Rate Limiting via Upstash Redis):**
  - Janela deslizante (*Sliding Window*) limitando tentativas de login e esqueci minha senha por IP.
- [x] **Guardiões e HOCs de Segurança de API (`src/lib/security/guards.ts`):**
  - `withAuth`: Garante que a requisição possui JWT íntegro e decodificado.
  - `withPermission(permissionAction)`: Valida no banco se a `Role` do usuário tem permissão para a operação.
  - `withSectorScoping`: Sanitiza parâmetros no `body` e na `query string`, descartando qualquer tentativa de injeção manual de `sectorId` e impondo o `session.sectorId` criptográfico da sessão.
- [x] **Proteção contra Enumeração de Contas:**
  - Resposta unificada e com tempo constante na rota `/api/auth/forgot-password`, impedindo que invasores descubram e-mails cadastrados.
- [x] **Segregação de Funções (SoD) em Compras:**
  - A API bloqueia formalmente que o mesmo colaborador que criou uma ordem de compra possa aprová-la (`purchase.requestedByUserId !== session.sub`).

---

### 2.3. Endpoints de API Desenvolvidos
- [x] **Autenticação e Sessão:**
  - `POST /api/auth/login`: Autenticação por credenciais com emissão de JWT HttpOnly.
  - `POST /api/auth/logout`: Expiração de cookies de sessão.
  - `POST /api/auth/first-access`: Redefinição obrigatória da senha inicial e desativação da flag `mustChangePassword`.
  - `POST /api/auth/forgot-password`: Fluxo seguro de solicitação de recuperação de senha.
- [x] **Logística e Estoque:**
  - `POST /api/inventory/entry`: Entrada de estoque (compras recebidas, doações, reposições).
  - `POST /api/inventory/exit`: Baixa de estoque (dispensação a pacientes, perdas, descarte por validade) com bloqueio estrito de saldo negativo.
  - `POST /api/inventory/transfer`: Transferência direta e atômica entre dois setores hospitalares.
  - `POST /api/inventory/adjustment`: Ajuste físico de inventário (exige permissão `STOCK_ADJUST`).
- [x] **Solicitações entre Setores:**
  - `GET /api/inventory/requests`: Listagem de solicitações com filtro automático pelo setor da sessão.
  - `POST /api/inventory/requests`: Abertura de solicitação de insumos/medicamentos para outro setor.
  - `POST /api/inventory/requests/[id]/attend`: Atendimento da solicitação pelo setor fornecedor, com baixa atômica no estoque de origem e crédito no setor solicitante.
  - `POST /api/inventory/requests/[id]/reject`: Rejeição de solicitação com justificativa auditada.
- [x] **Compras e Suprimentos:**
  - `GET /api/purchases`: Listagem de ordens de compra.
  - `POST /api/purchases`: Criação de novo pedido de compras com múltiplos itens.
  - `POST /api/purchases/[id]/approve`: Aprovação executiva da ordem de compra com validação de SoD.
- [x] **Administração e Governança:**
  - `GET /api/admin/users`: Listagem de todos os colaboradores do hospital.
  - `POST /api/admin/users`: Criação de novo usuário com senha provisória e setor vinculado.
  - `POST /api/admin/users/[id]/block`: Bloqueio/desbloqueio imediato de contas de colaboradores.
  - `GET /api/admin/sectors` & `GET /api/sectors`: Listagem e detalhes dos setores ativos.

---

### 2.4. Interfaces, Telas e Componentes Desenvolvidos
- [x] **Tela de Autenticação (`/login`):**
  - Design executivo hospitalar, feedback de erros, segurança sem dropdown de setores.
- [x] **Tela de Primeiro Acesso (`/primeiro-acesso`):**
  - Formulário com validação de critérios de senha forte (mínimo de caracteres, números, símbolos).
- [x] **Página de Acesso Negado (`/403-acesso-negado`):**
  - Interface amigável informando restrição de permissão ou tentativa de acesso cross-sector.
- [x] **Layout Central do Dashboard (`/dashboard/layout.tsx`):**
  - Barra lateral com navegação dinâmica baseada no papel do usuário.
  - Cabeçalho exibindo badge com identificação do **Setor Atual** do usuário e status da conexão.
- [x] **Dashboard Dinâmico para Todos os Setores (`/dashboard/[sector]`):**
  - Rota genérica com carregamento automático dos estoques e pedidos de qualquer um dos 30+ setores do hospital.
- [x] **Dashboards Especializados:**
  - `FarmaciaDashboardClient` (`/dashboard/farmacia`): Controle de medicamentos, lotes e validades.
  - `AlmoxarifadoDashboardClient` (`/dashboard/almoxarifado`): Visão de armazém geral e transferências.
  - `ComprasDashboardClient` (`/dashboard/compras`): Ordens de compra, fornecedores e aprovações.
  - `AdministracaoDashboard` (`/dashboard/administracao`): Painel executivo com métricas consolidadas, total de usuários, compras pendentes e trilha de auditoria em tempo real.
  - `UsersManagementClient` (`/dashboard/admin/usuarios`): Tabela de colaboradores com busca, filtros de status, bloqueio/desbloqueio e criação de novos acessos.
- [x] **Componentes Modais Interativos:**
  - `CreateRequestModal`: Abertura de requisições de material com seleção de itens e setor fornecedor.
  - `MovementModal`: Entradas e saídas rápidas de estoque com motivos operacionais.
  - `TransferModal`: Transferência de itens entre setores com seleção de lote.
  - `AdjustmentModal`: Ajuste de contagem com motivo e observações de auditoria.
  - `CreatePurchaseModal` & `ApprovePurchaseModal`: Criação e aprovação de ordens de compra.
  - `CreateUserModal`: Cadastro de novos colaboradores no IAM.
  - `ConfirmActionModal`: Diálogo de confirmação para ações de alto impacto.

---

### 2.5. Base de Dados Inicial (Seed Estruturado Completo)
- [x] **30+ Setores Hospitalares Cadastrados:**
  - Assistência (Pronto-Socorro, Enfermarias, UTIs Adulto/Pediátrica/Neonatal, Centro Cirúrgico, Centro Obstétrico).
  - Diagnóstico (Laboratório, Radiologia, Ultrassom, Tomografia, Ressonância, Endoscopia).
  - Medicamentos e Materiais (Farmácia Central, Farmácia Satélite, Almoxarifado Geral, CME).
  - Atendimento e Apoio (Recepção, Ambulatório, Internação, Nutrição, Fisioterapia, Manutenção, etc.).
- [x] **12 Categorias de Produtos:** Medicamentos, Materiais Médicos, Cirúrgicos, Higiene, EPI, Equipamentos, etc.
- [x] **Tabela de Compatibilidade Setorial:** Regras definindo quais categorias cada setor pode armazenar.
- [x] **Usuários e Credenciais de Demonstração:** Contas pré-configuradas para cada setor (Administrador, Farmacêutico, Almoxarife, Enfermeiro, Cirurgião, Comprador).
- [x] **Estoques Independentes:** Itens como *Dipirona Sódica*, *Seringa 10ml*, *Cateter 20G* e *Luvas de Procedimento* instanciados em múltiplos setores com quantidades e limites específicos.

---

### 2.6. Testes Automatizados e Integração Contínua (CI/CD)
- [x] `tests/hospital_sectors_stock.test.ts`:
  - 12 testes validando unicidade de setores, token JWT com setor, independência do mesmo produto em setores diferentes, prevenção de tampering em requisições, transferências atômicas, atendimento de pedidos e prevenção de saldo negativo.
- [x] `tests/security.test.ts`:
  - Testes de integridade de segurança, segregação de funções, permissões de ajuste e mitigação de enumeração de contas.
- [x] Pipeline `.github/workflows/ci.yml`:
  - Execução automática de `prisma generate`, migrações de banco, checagem de tipos (`tsc --noEmit`), lint (`eslint`), testes (`vitest`) e compilação do Next.js.

---

## 🔮 3. O que AINDA SERÁ IMPLEMENTADO (Backlog & Roadmap Futuro)

Para as próximas etapas de evolução e expansão do sistema, as seguintes funcionalidades estão planejadas:

### 3.1. Notificações em Tempo Real (WebSockets / SSE)
- [ ] Alertas instantâneos na interface quando uma nova solicitação urgente de materiais for recebida pelo Almoxarifado ou Farmácia.
- [ ] Notificações de *Estoque Crítico* quando o saldo de um medicamento atingir o nível mínimo configurado.
- [ ] Notificação para o setor solicitante assim que seu pedido for atendido e despachado.

### 3.2. Leitura e Emissão de Código de Barras / QR Code / Datamatrix
- [ ] Scanner via câmera web ou leitor óptico USB para bipagem rápida de lotes no momento do recebimento e da dispensação.
- [ ] Padrão GS1 / Datamatrix compatível com as normas da Anvisa para rastreabilidade de medicamentos.
- [ ] Geração e impressão de etiquetas com QR Code para caixas e prateleiras de estoque.

### 3.3. Relatórios Gerenciais e Exportação de Dados (PDF / Excel / CSV)
- [ ] Exportação do Livro de Movimentação de Estoque em PDF e planilha Excel.
- [ ] Curva ABC de consumo hospitalar por setor e por categoria de produto.
- [ ] Relatório de Perdas e Vencimentos para controle de descarte ético e financeiro.
- [ ] Módulo de exportação de dados para relatórios regulatórios (padrão SNGPC / Vigilância Sanitária).

### 3.4. Rastreamento e Dispensação Beira-Leito (Módulo Paciente)
- [ ] Registro da prescrição médica e checagem de dose unitária administrada no leito do paciente.
- [ ] Vinculação do consumo de materiais/medicamentos ao prontuário e leito do paciente internado.
- [ ] Fechamento de conta de insumos utilizados em procedimentos cirúrgicos.

### 3.5. Autenticação Multifator (MFA / 2FA)
- [ ] Implementação de autenticação em duas etapas via aplicativo autenticador (TOTP como Google Authenticator) para cargos de alta sensibilidade (SysAdmin, Farmacêutico Responsável e Diretor de Compras).

### 3.6. Inteligência Preditiva de Suprimentos (AI / Previsão de Demanda)
- [ ] Cálculo automático do Ponto de Reposição (ROP) e Lote Econômico de Compra (LEC) baseado na sazonalidade e histórico de consumo hospitalar.
- [ ] Assistente com inteligência artificial para sugerir ordens de compra antecipadas evitando desabastecimento em períodos de surtos sazonais (ex: dengue, gripe).

### 3.7. Interoperabilidade Hospitalar (HL7 / FHIR)
- [ ] Camada de integração com outros sistemas hospitalares (Tasy, MV Soul, Philips) através dos padrões internacionais HL7 e FHIR.
- [ ] Documentação interativa da API via OpenAPI / Swagger para integração de parceiros e laboratórios conveniados.

### 3.8. Modo Offline / PWA (Progressive Web App)
- [ ] Otimização para coletores de dados e tablets de conferência com suporte a sincronização em segundo plano caso a rede Wi-Fi hospitalar oscile.

---

## 📊 4. Matriz de Resumo das Implementações

| Funcionalidade | Módulo | Status |
| :--- | :--- | :---: |
| Modelagem Relacional e Banco Serverless | Backend / Banco | 🟢 **Concluído** |
| Autenticação JWT Stateless com Cookies HttpOnly | Segurança | 🟢 **Concluído** |
| Proxy Edge com Proteção Cross-Sector e Rate Limiting | Segurança | 🟢 **Concluído** |
| Fluxo de Primeiro Acesso e Troca de Senha | IAM | 🟢 **Concluído** |
| Isolamento Estrito de Estoques Setoriais | Logística | 🟢 **Concluído** |
| Movimentações de Entrada, Saída e Transferência | Logística | 🟢 **Concluído** |
| Fluxo de Solicitações e Atendimento entre Setores | Logística | 🟢 **Concluído** |
| Módulo de Compras e Aprovação com Regra de SoD | Suprimentos | 🟢 **Concluído** |
| Gestão de Usuários e Permissões Granulares (RBAC) | IAM / Admin | 🟢 **Concluído** |
| Dashboards Específicos (Admin, Farmácia, Almoxarifado, Compras) | Frontend | 🟢 **Concluído** |
| Dashboard Dinâmico para mais de 30 Setores Hospitalares | Frontend | 🟢 **Concluído** |
| Suíte de Testes Unitários, de Integração e de Segurança | Qualidade | 🟢 **Concluído** |
| Pipeline de Integração Contínua (GitHub Actions) | DevOps | 🟢 **Concluído** |
| Notificações em Tempo Real (WebSockets) | Comunicação | 🟡 *Planejado* |
| Leitor de Código de Barras / QR Code (GS1) | Logística | 🟡 *Planejado* |
| Exportação de Relatórios em PDF e Excel | Relatórios | 🟡 *Planejado* |
| Dispensação Beira-Leito e Vinculação ao Paciente | Assistencial | 🟡 *Planejado* |
| Autenticação Multifator (MFA / 2FA) | Segurança | 🟡 *Planejado* |
| Previsão de Demanda e IA Preditiva | Inteligência | 🟡 *Planejado* |

---

*Documento gerado automaticamente para o repositório **HeitorZellerhoff/projeto-voce-na-etec**.*
