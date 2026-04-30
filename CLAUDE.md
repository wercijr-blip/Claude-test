# MedScrita — CLAUDE.md

> Arquivo de contexto para Claude Code. Lido automaticamente no início de cada sessão.

---

## 🎯 O que é este projeto

**MedScrita** é uma plataforma SaaS brasileira para clínicas médicas que automatiza a documentação clínica via transcrição de áudio e geração de SOAP com IA. Permite que médicos gravem consultas, obtenham transcrições automáticas e notas SOAP estruturadas, além de módulos de gestão de conhecimento e boletins mensais.

---

## 🏗️ Stack Técnica

| Camada | Tecnologia |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4 |
| Roteamento client | Wouter 3.x |
| API | tRPC v11 + Express 4 |
| ORM | Drizzle ORM (MySQL dialect) |
| Banco de dados | TiDB / MySQL 8 |
| Autenticação | JWT (jose) + bcrypt, cookie `ms_session` |
| Upload de áudio | AWS S3 + Multer |
| Transcrição | OpenAI Whisper API |
| SOAP / IA | OpenAI GPT-4o / Anthropic Claude |
| E-mail | SendGrid |
| Testes | Vitest 2.x |
| Package manager | **pnpm** (obrigatório) |

---

## 📁 Estrutura de Diretórios

```
.
├── client/
│   └── src/
│       ├── App.tsx               # Roteamento principal (React.lazy + Suspense)
│       ├── main.tsx
│       ├── index.css             # @import "tailwindcss" (Tailwind v4)
│       ├── lib/
│       │   └── trpc.ts             # createTRPCReact<AppRouter>()
│       ├── components/
│       │   ├── DashboardLayout.tsx # Sidebar + nav
│       │   └── DoctorProfileModal.tsx
│       └── pages/
│           ├── Landing.tsx
│           ├── Login.tsx
│           ├── ChangePassword.tsx
│           ├── Perfil.tsx
│           ├── AdminDashboard.tsx
│           ├── AdminDoctors.tsx
│           ├── AdminBulletin.tsx
│           └── Knowledge.tsx
├── server/
│   ├── _core/
│   │   ├── auth.ts             # bcrypt + jose JWT
│   │   ├── context.ts          # MedscritaUser, createContext
│   │   ├── email.ts            # SendGrid templates
│   │   ├── env.ts              # Zod env schema
│   │   ├── index.ts            # Express entry point
│   │   └── trpc.ts             # publicProcedure / protectedProcedure / adminProcedure
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── users.ts
│   │   ├── admin.ts
│   │   ├── admin-stats.ts
│   │   ├── knowledge.ts
│   │   └── bulletin.ts
│   ├── db.ts               # Drizzle pool + CRUD helpers
│   ├── features.ts         # OpenAI SOAP, Whisper, knowledge extraction
│   ├── routers.ts          # appRouter
│   ├── storage.ts          # AWS S3
│   └── roles.test.ts
├── drizzle/
│   ├── schema.ts           # 5 tabelas: users, consultations, knowledge_topics,
│   │                       #   consultation_clinical_data, bulletin_history
│   ├── relations.ts        # export {} (necessário para import em db.ts)
│   └── migrations/
│       └── 0001_init.sql
├── shared/
│   ├── types.ts            # Role, UserProfile
│   └── security-constants.ts
├── CLAUDE.md
├── DEPLOY.md
├── package.json
├── pnpm-lock.yaml
├── drizzle.config.ts
├── vite.config.ts
├── vitest.config.ts
├── tsconfig.json
└── seed.ts
```

---

## ⚡ Comandos Essenciais

```bash
# Instalar dependências (sempre pnpm)
pnpm install

# Dev (servidor + frontend com HMR)
pnpm dev

# Build de produção
pnpm build

# Iniciar servidor em produção
pnpm start

# Verificar tipagem TypeScript
pnpm check

# Rodar testes
pnpm test

# Gerar + aplicar migrations
pnpm db:push

# Criar primeiro admin
node seed.ts
```

---

## 🔐 Variáveis de Ambiente

```env
# Banco de dados
DATABASE_URL=mysql://usuario:senha@host:4000/medscrita?ssl={"rejectUnauthorized":true}

# JWT
JWT_SECRET=minimo_32_chars_aqui

# OpenAI (transcrição + SOAP)
OPENAI_API_KEY=sk-...

# Anthropic (opcional, para EvidenceChat e DoctorProfileModal)
VITE_ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_API_KEY=sk-ant-...

# SendGrid
SENDGRID_API_KEY=SG....
SENDGRID_FROM=noreply@medscrita.com.br

# AWS S3
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_S3_BUCKET=medscrita-audio

# App
NODE_ENV=production
PORT=3000
```

---

## 🏥 Arquitetura

### Sistema de Roles (tRPC procedures)

| Role | Procedure | Acesso |
|---|---|---|
| qualquer | `publicProcedure` | login, página pública |
| `doctor` ou `admin` | `protectedProcedure` | dashboard, consultas, perfil |
| `admin` | `adminProcedure` | gestão de médicos, stats, boletins |

### Fluxo de Consulta

```
1. Médico faz upload de áudio (S3)
2. Whisper transcreve
3. GPT-4o gera SOAP estruturado
4. Dados clínicos extraídos (diagnóstico, exames, medicações)
5. Tópicos de conhecimento gerados automaticamente
6. Admin visualiza stats no painel
```

### Segurança multi-clínica

- Cada usuário tem `clinicId`
- `assertSameClinic()` — garante que admin só acessa dados da própria clínica
- `assertTopicBelongsToClinic()` — verifica ownership de knowledge topics
- Cookie `ms_session` com HttpOnly + SameSite=Lax

---

## 🧪 Testes

| Arquivo | O que testa |
|---|---|
| `server/roles.test.ts` | protectedProcedure (3) e adminProcedure (3) |

**Convenção:** Vitest com `describe/it/expect`. Todos os testes em `server/**/*.test.ts`.

---

## ⚠️ Atenção

1. **Sempre usar pnpm** — `packageManager: pnpm@10.x` no package.json
2. **Tailwind v4** — usar `@import "tailwindcss";` em `index.css`, não `@tailwind base/components/utilities`
3. **Drizzle relations.ts** — manter `export {}` pois `db.ts` faz `import * as relations`
4. **`sirv`** — necessário em produção para servir os arquivos estáticos do Vite
5. **Não commitar** `.env` ou credenciais AWS/OpenAI
6. **TiDB** — compatível com MySQL 8; usar `mysqlTable` do `drizzle-orm/mysql-core`
