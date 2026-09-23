# 🏥 Enterprise Hospital Inventory Management System

Um sistema logístico hospitalar de ponta desenvolvido do absoluto zero (Nativo Serverless). Arquitetado com separação estrita de setores, trilhas de auditoria imutáveis, blindagem contra adulteração de dados via Next.js Edge Runtime e bancos transacionais escaláveis.

## 🚀 Arquitetura (A Stack Tecnológica)
- **Frontend & APIs**: [Next.js App Router (React 19)](https://nextjs.org/)
- **Autenticação**: *Stateless JWT* ultra-rápido operando na Edge via [jose](https://github.com/panva/jose) e *HttpOnly Cookies*.
- **Database Serverless**: [Neon Tech PostgreSQL](https://neon.tech/) + *Pooler* TCP Seguro.
- **ORM**: [Prisma Serverless Driver](https://www.prisma.io/docs/orm/prisma-client/deployment/edge/deploy-to-vercel) para Edge Runtimes.
- **Estilização**: Tailwind CSS v4 + UI Components.
- **Proteção & WAF**: [Upstash Redis Rate Limiting](https://upstash.com/).

---

## 🔒 Variáveis de Ambiente (Configuração Necessária)

Para inicializar a aplicação, crie um arquivo `.env` na raiz do projeto com as seguintes chaves:

```env
# Banco de Dados de Produção / Homologação na Neon
# NOTA IMPORTANTE: Use a URL com "-pooler" fornecida pelo Neon para evitar esgotamento de conexões na Vercel
DATABASE_URL="postgresql://[USUARIO]:[SENHA]@ep-[nome]-[id]-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"

# Chave criptográfica global. Gere uma string longa e aleatória (Ex: 'openssl rand -hex 64')
JWT_SECRET="sua-chave-super-secreta-para-assinar-tokens"

# Configurações do Upstash Redis (Necessário para a Proteção de Força Bruta no Middleware)
UPSTASH_REDIS_REST_URL="https://[seu-endpoint].upstash.io"
UPSTASH_REDIS_REST_TOKEN="[seu-token-rest]"
```

---

## 🛠 Como Realizar o Deploy (Vercel)

1. Conecte sua conta do GitHub à [Vercel](https://vercel.com/).
2. Importe o repositório deste projeto.
3. Acesse **Settings > Environment Variables** e cadastre as chaves listadas acima.
4. **Deploy Automático**: O Next.js e a Vercel executarão nativamente os scripts definidos no nosso `package.json`.
   - O comando de build já está otimizado: `prisma generate && next build`.

## 📦 Banco de Dados (Neon PostgreSQL)

### 1. Migrações
Sempre que fizer o primeiro *Deploy* de produção, instancie o banco com as tabelas executando localmente (ou via GitHub Actions) o comando:
```bash
npx prisma migrate deploy
```
*Isto aplicará com segurança os scripts SQL contra o seu banco da Neon, sem perda acidental de dados.*

### 2. Carga Inicial (Seed)
Para criar os setores, as regras (Roles) e a conta primordial do Administrador (SysAdmin), execute o comando a seguir:
```bash
npx prisma db seed
```
*(Ou `npm run prisma db seed`, dependendo do seu setup).*

---

## 🔑 Credenciais Iniciais de Sistema (SysAdmin)

Após o `Seed`, o sistema estará configurado com uma conta Master que forçará a redefinição segura de senha no primeiro login:
- **Painel:** `https://[seu-dominio].vercel.app/login`
- **E-mail:** `admin@hospital.com`
- **Senha Inicial:** `Hospital@2026`

> **AVISO DE SEGURANÇA:** O sistema não possui *dropdowns* de setor no login. A segurança é derivada via injeção criptográfica (IAM & HOC Sector-Scoping). Um usuário jamais consegue forjar seu setor de operação. O sistema é auditado (CWE-209 evitado) ponta a ponta.

---
Desenvolvido via Engenharia AI - **Projeto Você na ETEC**.
