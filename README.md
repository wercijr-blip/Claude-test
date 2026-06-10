# Facilita PrEP

Plataforma de saúde digital brasileira para prevenção do HIV via PrEP (Profilaxia Pré-Exposição). Permite que pacientes preencham formulários clínicos, façam upload de exames, assinem TCLE digitalmente e recebam prescrições com assinatura digital ICP-Brasil conforme CFM/ITI.

**Produção:** `https://facilitaprep.com.br`  
**Compliance:** SBIS Nível INTERMEDIÁRIO (BPIA + ECF + NGS1 + NGS2) · LGPD · CFM 2.299/2021

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui |
| Roteamento client | Wouter 3.x |
| API | tRPC v11 + Express 4 |
| ORM | Drizzle ORM (MySQL dialect) |
| Banco de dados | TiDB / MySQL 8 |
| Autenticação | OAuth + JWT (jose) |
| Assinatura digital | pdf-lib + @signpdf + node-forge (ICP-Brasil) |
| Upload de arquivos | AWS S3 + Multer |
| Filas | BullMQ (Redis) |
| E-mail | Resend API |
| Pagamentos | Asaas |
| IA para exames | Claude Haiku (Anthropic API) — SBIS NGS1.01 |
| Testes | Vitest 2.x |
| Package manager | **pnpm** (obrigatório) |

---

## Início rápido

```bash
# Instalar dependências
pnpm install

# Criar .env (ver seção de variáveis abaixo)
cp .env.example .env

# Iniciar banco local (Docker)
pnpm dev:services

# Aplicar schema no banco
pnpm db:push

# Seed de dados de desenvolvimento
pnpm db:seed

# Rodar em modo desenvolvimento
pnpm dev
```

O servidor estará em `http://localhost:3000` e o Vite HMR em `http://localhost:5173`.

---

## Comandos

```bash
pnpm dev            # servidor + frontend com HMR
pnpm build          # build de produção
pnpm start          # iniciar servidor em produção
pnpm check          # verificação TypeScript
pnpm test           # todos os testes
pnpm test --coverage # cobertura de testes
pnpm db:push        # aplicar schema no banco
pnpm db:seed        # seed de dados de desenvolvimento
pnpm db:studio      # Drizzle Studio (UI do banco)
pnpm format         # formatar código
```

---

## Variáveis de Ambiente

```env
# Banco de dados
DATABASE_URL=mysql://usuario:senha@host:4000/facilita_prep

# Autenticação OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
JWT_SECRET=...  # mínimo 32 caracteres
OWNER_OPEN_ID=...

# Identificador do app
VITE_APP_ID=facilita-prep

# Criptografia (LGPD)
ENCRYPTION_KEY=...  # 64 hex chars (openssl rand -hex 32)
CPF_HASH_SALT=...   # mínimo 32 caracteres

# AWS S3
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=sa-east-1
AWS_S3_BUCKET=...

# Redis (BullMQ)
REDIS_URL=redis://localhost:6379

# E-mail (Resend)
RESEND_API_KEY=...

# IA para análise de exames
BUILT_IN_FORGE_API_URL=https://api.anthropic.com
BUILT_IN_FORGE_API_KEY=sk-ant-...

# Pagamentos (Asaas)
ASAAS_API_KEY=...
ASAAS_ENV=sandbox

# Notificações de operação (opcional)
ADMIN_EMAIL=admin@exemplo.com
OPS_TOKEN=...  # mínimo 32 chars — protege /api/metrics
```

---

## Arquitetura

### Fluxo do Paciente

```
1. Secretaria gera token de acesso
2. Token enviado ao paciente por e-mail
3. Paciente preenche formulário multi-etapas:
   StepPaciente → StepDemografico → StepContato →
   StepConduta → StepPrescricao → StepServico →
   StepAutorizados → StepTcle (assinatura LGPD + IA)
4. Upload de exames (análise por IA — SBIS BPIA + ECF + NGS1)
5. Médico revisa no dashboard
6. PDF gerado com assinatura digital ICP-Brasil
7. Notificação automática ao paciente
```

### Roles

| Role | Procedure tRPC | Acesso |
|------|---------------|--------|
| `user` | `publicProcedure` / `protectedProcedure` | Formulário do paciente |
| `secretaria` | `staffProcedure` | Gerar tokens, ver exames |
| `medico` | `medicoProcedure` | Revisar exames, aprovar |
| `admin` | `adminProcedure` | Tudo + gerenciar equipe |

### Filas BullMQ

| Fila | Propósito | Concorrência |
|------|-----------|-------------|
| `pdf-generation` | Geração de PDFs assinados | 3 |
| `exam-analysis` | Análise de exames por IA | 3 |
| `lembrete-exame` | Lembretes diários por e-mail | 1 |
| `pesquisa-satisfacao` | Pesquisas 24h após consulta | 1 |
| `link-acesso` | Reenvio de links de acesso | 1 |
| `nutricao-lead` | Captação leads nutrição | 1 |
| `retention-lgpd` | Purga diária LGPD (03:00) | 1 |

---

## Endpoints de Operação

Todos requerem header `x-ops-token: <OPS_TOKEN>`:

- `GET /api/health` — saúde básica (DB + Redis)
- `GET /api/health/deep` — saúde completa (DB + Redis + S3)
- `GET /api/health/queues` — estado de todas as filas BullMQ
- `GET /api/metrics` — métricas de filas, memória e circuit breakers
- `GET /api/admin/usage` — consumo diário de LLM vs limite

---

## Segurança & LGPD

- **PII**: CPF/Nome encriptados em repouso (AES-256-GCM) · `server/_core/encryption.ts`
- **Busca por CPF**: via `cpfHash` (SHA-256 + salt) — nunca descriptografado para busca
- **Rate limiting**: por IP em endpoints sensíveis · `server/_core/rateLimiters.ts`
- **CORS**: whitelist explícita · `server/_core/originValidator.ts`
- **Auditoria**: todo acesso a dados pessoais registrado em `audit_logs`
- **Retenção**: purga automática após 20 anos (CFM) via `retentionWorker`
- **Injeção de prompt**: filtro NGS1.12 em todos os campos enviados à IA

### Conformidade SBIS Nível INTERMEDIÁRIO

| Código | Descrição |
|--------|-----------|
| BPIA.01–05 | Responsável técnico, confiança, qualidade, fundamentação, anomalias |
| ECF.02/16/17 | Rastreabilidade profissional, aviso obrigatório, metadados SHA-256 |
| NGS1.07/10/11/12 | Audit log, notificação RT, consentimento IA no TCLE, anti-injeção |
| NGS2.05 | PDF/A com XMP de conformidade SBIS |

---

## Testes

```bash
pnpm test                              # todos os testes
pnpm test server/security.test.ts      # arquivo específico
pnpm test --coverage                   # com relatório de cobertura
```

Cobertura atual: ~15% linhas · ~50% funções · ~77% branches  
(limite por infraestrutura: rotas DB/email/S3 requerem integração)

---

## Deploy (Railway)

O projeto faz deploy automático no Railway a partir do branch `main`. Variáveis de ambiente configuradas no painel Railway. O certificado ICP-Brasil é carregado via `ICP_PFX_BASE64` (base64 do .pfx).

**Nunca commitar:** `server/certs/*.pem`, `server/certs/*.pfx`, `.env`
