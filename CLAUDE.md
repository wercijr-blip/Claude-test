# Facilita PrEP — CLAUDE.md

> Arquivo de contexto para Claude Code. Lido automaticamente no início de cada sessão.

-----

## 🎯 O que é este projeto

**Facilita PrEP** é uma plataforma de saúde digital brasileira para prevenção do HIV via PrEP (Profilaxia Pré-Exposição). Permite que pacientes preencham formulários clínicos, façam upload de exames, assinem TCLE digitalmente e recebam prescrições com assinatura digital ICP-Brasil conforme CFM/ITI.

**Domínio de produção:** `claude-test-production-8672.up.railway.app`

-----

## 🏗️ Stack Técnica

|Camada            |Tecnologia                                            |
|------------------|------------------------------------------------------|
|Frontend          |React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui|
|Roteamento client |Wouter 3.x (patchado)                                 |
|API               |tRPC v11 + Express 4                                  |
|ORM               |Drizzle ORM (MySQL dialect)                           |
|Banco de dados    |TiDB / MySQL 8                                        |
|Autenticação      |OAuth via OAUTH_SERVER_URL + JWT (jose)               |
|Assinatura digital|pdf-lib + @signpdf + node-forge (ICP-Brasil)          |
|Upload de arquivos|AWS S3 + Multer                                       |
|Filas             |BullMQ (geração assíncrona de PDF)                    |
|E-mail            |Nodemailer (Gmail SMTP)                               |
|NFS-e             |FocusNFe API (homologação/produção)                   |
|Pagamentos        |Stripe                                                |
|Testes            |Vitest 2.x                                            |
|Package manager   |**pnpm** (obrigatório — não usar npm/yarn)            |

-----

## 📁 Estrutura de Diretórios

```
.
├── client/
│   └── src/
│       ├── App.tsx               # Roteamento principal
│       ├── _core/hooks/
│       │   └── useAuth.ts        # Hook de autenticação
│       └── components/
│           ├── steps/            # Etapas do formulário PrEP
│           │   ├── StepPaciente.tsx
│           │   ├── StepDemografico.tsx
│           │   ├── StepContato.tsx
│           │   ├── StepConduta.tsx
│           │   ├── StepPrescricao.tsx
│           │   ├── StepServico.tsx
│           │   └── StepAutorizados.tsx
│           ├── StepTcle.tsx      # Consentimento informado
│           ├── SignaturePad.tsx   # Captura de assinatura manual
│           ├── ExameUpload.tsx    # Upload de exames HIV
│           ├── AuditDashboard.tsx # Painel de auditoria
│           └── ui/               # Componentes shadcn/ui
│
├── server/
│   ├── _core/
│   │   ├── index.ts              # Entry point do servidor
│   │   ├── trpc.ts               # Procedures: public/protected/admin/medico/staff
│   │   ├── context.ts            # Contexto tRPC (req, user)
│   │   ├── env.ts                # Variáveis de ambiente tipadas
│   │   ├── encryption.ts         # Criptografia AES (LGPD)
│   │   ├── cpfValidator.ts       # Validação de CPF
│   │   ├── originValidator.ts    # Validação CORS/CSRF/OAuth state
│   │   ├── rateLimiters.ts       # Rate limiting por endpoint
│   │   └── security.ts           # Middlewares de segurança
│   ├── routers.ts                # Roteador principal tRPC
│   ├── db.ts                     # Instância Drizzle + queries
│   ├── pdfSigner.ts              # Assinatura digital ICP-Brasil
│   ├── pdfQueue.ts               # Fila BullMQ para PDFs
│   ├── examAnalysis.ts           # Análise de exames via LLM
│   ├── email.ts                  # Templates e envio de e-mails
│   ├── storage.ts                # Upload S3
│   ├── focusnfe.ts               # Emissão NFS-e
│   ├── stripe/
│   │   ├── products.ts
│   │   └── webhook.ts
│   └── certs/                    # Certificados ICP-Brasil (NÃO commitar)
│       ├── werciley-cert.pem
│       ├── werciley-key.pem
│       └── werciley.pfx
│
├── drizzle/
│   ├── schema.ts                 # Schema completo do banco
│   ├── relations.ts              # Relações Drizzle
│   └── 0000_*.sql ... 0009_*.sql # Migrations
│
├── shared/
│   ├── types.ts                  # Re-exports de tipos compartilhados
│   ├── const.ts                  # Constantes (mensagens de erro etc.)
│   └── security-constants.ts    # Constantes de segurança
│
├── CLAUDE.md                     # Este arquivo
├── package.json
├── pnpm-lock.yaml
├── drizzle.config.ts
├── vite.config.ts
├── vitest.config.ts
└── tsconfig.json
```

-----

## ⚡ Comandos Essenciais

### Desenvolvimento

```bash
# Instalar dependências (sempre pnpm)
pnpm install

# Rodar em modo dev (servidor + frontend com HMR)
pnpm dev

# Build de produção
pnpm build

# Iniciar servidor em produção
pnpm start

# Verificar tipagem TypeScript
pnpm check
```

### Testes

```bash
# Rodar todos os testes
pnpm test

# Rodar testes em modo watch
pnpm test --watch

# Rodar teste específico
pnpm test server/security.test.ts

# Rodar testes com cobertura
pnpm test --coverage
```

### Banco de Dados

```bash
# Gerar migration + aplicar no banco
pnpm db:push

# Ver migrations pendentes
npx drizzle-kit status

# Abrir Drizzle Studio (UI do banco)
npx drizzle-kit studio
```

### Formatação

```bash
pnpm format
```

-----

## 🔐 Variáveis de Ambiente Necessárias

Criar arquivo `.env` na raiz do projeto:

```env
# Banco de dados (TiDB/MySQL)
DATABASE_URL=mysql://usuario:senha@host:4000/facilita_prep?ssl={"rejectUnauthorized":true}

# Autenticação OAuth
JWT_SECRET=seu_jwt_secret_aqui_minimo_32_chars
OAUTH_SERVER_URL=https://seu-servidor-oauth.com
OWNER_OPEN_ID=id_do_admin_principal

# App ID
VITE_APP_ID=facilita-prep

# AWS S3
AWS_ACCESS_KEY_ID=sua_access_key
AWS_SECRET_ACCESS_KEY=sua_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=nome-do-bucket

# E-mail (Gmail SMTP)
GMAIL_USER=seu@gmail.com
GMAIL_APP_PASSWORD=senha_de_app_gmail

# FocusNFe (NFS-e)
FOCUSNFE_TOKEN_HOMOLOGACAO=token_homologacao
FOCUSNFE_TOKEN_PRODUCAO=token_producao
FOCUSNFE_ENVIRONMENT=homologacao  # ou producao

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# LLM para análise de exames
BUILT_IN_FORGE_API_URL=https://api.anthropic.com
BUILT_IN_FORGE_API_KEY=sk-ant-...
```

-----

## 🏥 Arquitetura do Sistema

### Fluxo do Paciente

```
1. Secretaria gera token de acesso (privado ou convênio)
2. Token enviado ao paciente por e-mail
3. Paciente acessa formulário multi-etapas:
   StepPaciente → StepDemografico → StepContato → 
   StepConduta → StepPrescricao → StepServico → 
   StepAutorizados → StepTcle (assinatura)
4. Upload de exames HIV (análise por IA)
5. Médico revisa no dashboard
6. PDF gerado com assinatura digital ICP-Brasil
7. NFS-e emitida via FocusNFe
```

### Sistema de Roles (tRPC procedures)

|Role        |Procedure                               |Acesso                  |
|------------|----------------------------------------|------------------------|
|`user`      |`publicProcedure` / `protectedProcedure`|Formulário do paciente  |
|`secretaria`|`staffProcedure`                        |Gerar tokens, ver exames|
|`medico`    |`medicoProcedure`                       |Revisar exames, aprovar |
|`admin`     |`adminProcedure`                        |Tudo + gerenciar equipe |

### Assinatura Digital ICP-Brasil

- Certificado: `server/certs/werciley.pfx` (A3 ICP-Brasil)
- Implementação: `server/pdfSigner.ts`
- Política: DocMDP (não repúdio) + carimbos de tempo ITI
- Compliance: CFM 2.299/2021, RT 01/2020 ITI

-----

## 🧪 Suíte de Testes

|Arquivo                     |O que testa                                     |
|----------------------------|------------------------------------------------|
|`server/security.test.ts`   |CPF injection, CSRF, Open Redirect, Payload Bomb|
|`server/roles.test.ts`      |Sistema de permissões por role                  |
|`server/pdfSigner.test.ts`  |Geração e validação de PDFs assinados           |
|`server/token.test.ts`      |Ciclo de vida de tokens de acesso               |
|`server/email.test.ts`      |Templates e envio de notificações               |
|`server/examReview.test.ts` |Análise de exames por IA                        |
|`server/focusnfe.test.ts`   |Emissão de NFS-e                                |
|`server/auth.logout.test.ts`|Logout e invalidação de sessão                  |

**Convenção de testes:** Vitest com `describe/it/expect`. Mocks com `vi.mock()`. Todos os testes ficam em `server/**/*.test.ts`.

-----

## 🔒 Segurança & LGPD

- **CPF/Nome:** encriptados em repouso via `server/_core/encryption.ts` (AES)
- **cpfHash:** campo separado para busca sem descriptografar
- **Rate limiting:** por IP em endpoints sensíveis (`rateLimiters.ts`)
- **CORS:** whitelist explícita em `originValidator.ts`
- **CSP:** headers via `cspNonceMiddleware.ts`
- **Retenção de dados:** `retentionUntil` nos registros (CFM: 20 anos para dados de saúde)
- **Security Logger:** todos os eventos de segurança em `securityLogger.ts`

-----

## 📝 Convenções do Código

### TypeScript

- `strict: true` — sem `any` implícito
- Paths: `@/*` → `client/src/*`, `@shared/*` → `shared/*`
- Importações com extensão `.ts` permitidas (`allowImportingTsExtensions`)

### Componentes React

- Componentes funcionais com hooks
- React Hook Form + Zod para formulários
- Shadcn/UI para componentes base
- Framer Motion para animações

### API (tRPC)

- Sempre usar a procedure correta por nível de acesso
- Validação de input com Zod schemas
- Errors com `TRPCError` e código correto (UNAUTHORIZED, FORBIDDEN, etc.)

### Banco de dados

- ORM: Drizzle (nunca SQL raw sem justificativa)
- Após mudar `drizzle/schema.ts`: rodar `pnpm db:push`
- Índices obrigatórios em colunas de busca frequente

-----

## ⚠️ Atenção ao Trabalhar no Projeto

1. **Nunca commitar** `server/certs/*.pem`, `server/certs/*.pfx` ou `.env`
1. **Sempre usar pnpm** — o projeto tem `packageManager: pnpm@10.4.1` no package.json
1. **Dados de saúde** são sensíveis — LGPD se aplica. CPF/Nome sempre via `encryption.ts`
1. **Assinatura digital** — testar em PDF real antes de alterar `pdfSigner.ts`
1. **FocusNFe** — usar `homologacao` em desenvolvimento, nunca `producao` para testes
1. **TiDB** — compatível com MySQL 8, mas sem suporte a todos os tipos Drizzle; usar `mysqlTable` e tipos do `drizzle-orm/mysql-core`
