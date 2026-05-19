# CIS — Clinical Intelligence System — CLAUDE.md

> Arquivo de contexto para Claude Code. Lido automaticamente no início de cada sessão.

---

## 🎯 O que é este projeto

**CIS (Clinical Intelligence System)** é um assistente de IA clínica single-doctor para o Dr. Werciley Saraiva Vieira Junior (infectologista, CRM-DF 16381). O sistema automatiza documentação clínica, síntese de evidências PubMed, detecção de divergências de conduta, geração de relatórios médicos e publicações científicas — tudo via 11 prompts LLM especializados.

**Modelo de operação:** Single-doctor (ADR 002) — toda a inteligência clínica é contextualizada para um único médico.
**Hosting:** Railway — variável `APP_URL` define a URL pública.

---

## 🏗️ Stack Técnica

| Camada            | Tecnologia                                                      |
| ----------------- | --------------------------------------------------------------- |
| Frontend          | React 19, TypeScript, Vite, Tailwind CSS v4                     |
| Roteamento client | Wouter 3.x                                                      |
| API               | tRPC v11 + Express 4                                            |
| ORM               | Drizzle ORM (MySQL dialect) — schema em `drizzle/cis-schema.ts` |
| Banco de dados    | TiDB / MySQL 8                                                  |
| Autenticação      | Google OAuth + JWT (jose)                                       |
| IA clínica        | Anthropic SDK — Haiku 4.5 / Sonnet 4.6 / Opus 4.7               |
| Transcrição       | OpenAI Whisper (gpt-4o-mini-transcribe)                         |
| Upload de áudio   | AWS S3 + presigned URLs                                         |
| Filas             | BullMQ (pubmed, digest, caseSeries) — prefixo `{cis-prod}`      |
| Cache             | Redis (resultados PubMed 24h, budget 60s, rate limiting)        |
| Testes            | Vitest 2.x                                                      |
| Package manager   | **pnpm** (obrigatório — não usar npm/yarn)                      |

---

## 📁 Estrutura de Diretórios

```
.
├── client/
│   └── src/
│       ├── App.tsx                # Roteamento + CISDashboard funcional
│       ├── _core/hooks/
│       │   └── useAuth.ts         # Hook de auth (token em localStorage: cis_token)
│       ├── components/
│       │   ├── LoginPage.tsx      # Login Google OAuth + devLogin
│       │   ├── Logo.tsx
│       │   └── StaffHeader.tsx
│       └── lib/trpc.ts            # Cliente tRPC
│
├── server/
│   ├── _core/
│   │   ├── index.ts               # Entry point do servidor Express
│   │   ├── trpc.ts                # Procedures: public/protected/admin/medico/staff
│   │   ├── context.ts             # Contexto tRPC — JWT via Bearer ou cookie cis_session
│   │   ├── env.ts                 # Variáveis de ambiente tipadas (Zod)
│   │   ├── encryption.ts          # Criptografia AES-256-GCM (LGPD)
│   │   ├── circuitBreaker.ts      # Circuit breaker para APIs externas
│   │   ├── rateLimiters.ts        # Rate limiting Redis por endpoint
│   │   ├── redis.ts               # Redis + QUEUE_PREFIX ({cis-prod}/{cis-dev})
│   │   └── security.ts            # Helmet, CORS, Permissions-Policy
│   ├── routers.ts                 # Roteador tRPC: { auth, scriba }
│   ├── db.ts                      # Drizzle — importa apenas cis-schema.ts
│   ├── clinicalIntelligence.ts    # 11 prompts CIS (01–11) + Batch API + orçamento Opus
│   ├── cis/blocks.ts              # Blocos reutilizáveis de prompt (guards, GRADE)
│   ├── scriba.ts                  # Lógica de sessão, SOAP, alertas
│   ├── pubmed.ts                  # E-utilities NCBI + circuit breaker + cache Redis 24h
│   ├── zotero.ts                  # Biblioteca Zotero + circuit breaker
│   ├── unpaywall.ts               # Texto completo open access + circuit breaker
│   ├── obsidian.ts                # Publicação no vault Obsidian via GitHub API
│   ├── n8n.ts                     # Webhooks n8n (best-effort)
│   ├── storage.ts                 # Presigned URLs S3 para áudio
│   ├── pubmedQueue.ts             # Fila BullMQ: síntese PubMed assíncrona
│   ├── digestQueue.ts             # Fila BullMQ: digests diário/semanal/mensal
│   ├── caseSeriesQueue.ts         # Fila BullMQ: série de casos automática
│   ├── workers.ts                 # Entry point workers standalone
│   └── routes/
│       ├── auth.ts                # OAuth Google callback + devLogin
│       ├── scriba.ts              # tRPC router — consultas, SOAPs, alertas
│       └── cisRest.ts             # REST API externa (API key): GET /api/cis/*
│
├── drizzle/
│   ├── cis-schema.ts              # ⭐ Schema exclusivo do CIS (6 tabelas)
│   └── schema.ts                  # Schema legado (NÃO importar em código CIS)
│
├── shared/
│   └── types.ts                   # AuthUser, Role e outros tipos compartilhados
│
├── .env.example                   # Template de variáveis CIS (sem segredos reais)
├── .github/workflows/ci.yml       # CI: type-check + lint + tests em todo push
├── CLAUDE.md                      # Este arquivo
├── package.json                   # name: "cis"
└── pnpm-lock.yaml
```

---

## ⚡ Comandos Essenciais

### Desenvolvimento

```bash
pnpm install        # instalar dependências
pnpm dev            # servidor + frontend com HMR
pnpm build          # build de produção
pnpm start          # servidor em produção
pnpm start:workers  # workers standalone (serviço separado no Railway)
pnpm check          # TypeScript type-check
pnpm test           # suíte de testes
pnpm db:push        # aplicar schema ao banco (após alterar cis-schema.ts)
```

---

## 🔐 Variáveis de Ambiente

Ver `.env.example` para lista completa com comentários.

**Obrigatórias:**

```env
DATABASE_URL        # TiDB/MySQL
JWT_SECRET          # mín. 32 chars
GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
OWNER_OPEN_ID       # sub Google do admin
ENCRYPTION_KEY      # 64 chars hex
CPF_HASH_SALT       # mín. 32 chars
AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_S3_BUCKET
BUILT_IN_FORGE_API_KEY   # Anthropic
REDIS_URL
```

---

## 🧠 Os 11 Prompts CIS

| ID      | Função                                 | Modelo             | Saída               |
| ------- | -------------------------------------- | ------------------ | ------------------- |
| CIS-01  | Extrator de exames laboratoriais       | Haiku 4.5          | JSON estruturado    |
| CIS-02a | MedScribe: SOAP note completo          | Sonnet 4.6         | Texto livre         |
| CIS-02b | Knowledge metadata (MeSH, CID-10)      | Haiku 4.5          | JSON                |
| CIS-03  | Síntese analítica de artigos PubMed    | Sonnet 4.6         | Markdown GRADE      |
| CIS-04  | Verificação de critérios DUT/ANS       | Sonnet 4.6         | JSON                |
| CIS-05  | Relatório de tratamento para operadora | Sonnet 4.6         | Texto formal        |
| CIS-06  | Detecção de divergência de conduta     | Sonnet 4.6         | JSON com hash       |
| CIS-07  | Digest diário                          | Sonnet 4.6         | Markdown            |
| CIS-08  | Digest semanal                         | Sonnet 4.6 / Batch | Markdown            |
| CIS-09  | Digest mensal                          | Sonnet 4.6 / Batch | Markdown            |
| CIS-10  | Geração de série de casos (CARE)       | Opus 4.7           | Rascunho científico |
| CIS-11  | Revisão de literatura automática       | Opus 4.7           | Artigo estruturado  |

**Orçamento Opus:** `OPUS_DAILY_TOKEN_BUDGET` — quando atingido, downgrade automático para Sonnet.

---

## 🏥 Arquitetura do Sistema

### Fluxo de uma consulta

```
1. Médico abre sessão (scriba.abrirSessao)
2. Áudio enviado ao S3 via presigned URL (scriba.getAudioUploadUrl)
3. Whisper transcreve o áudio (scriba.transcreverAudio)
4. CIS-01: extrai exames laboratoriais (Haiku, se laudo fornecido)
5. CIS-02a + CIS-02b: gera SOAP + knowledge_metadata (Sonnet + Haiku)
6. CIS-06: detecta divergência de conduta
7. Worker pubmedQueue: PubMed + Zotero + Unpaywall → CIS-03 (Sonnet)
8. CIS-06 re-executa com síntese completa → salva alertas
9. Digest automático ao encerrar sessão (diário → semanal → mensal)
```

### Schema CIS (`drizzle/cis-schema.ts`)

| Tabela               | Descrição                                            |
| -------------------- | ---------------------------------------------------- |
| `users`              | Médico e admin (staff)                               |
| `clinical_sessions`  | Sessões de atendimento diário                        |
| `soap_notes`         | SOAP notes com metadados, síntese e retenção 20 anos |
| `conduct_alerts`     | Alertas de divergência de conduta                    |
| `publication_drafts` | Rascunhos de série de casos e revisões               |
| `clinical_digests`   | Digests diário/semanal/mensal                        |

### Procedures tRPC

| Role        | Procedure            | Acesso                       |
| ----------- | -------------------- | ---------------------------- |
| Público     | `publicProcedure`    | Login, callback OAuth        |
| Autenticado | `protectedProcedure` | Qualquer usuário autenticado |
| Médico      | `medicoProcedure`    | role ∈ {medico, admin}       |
| Admin       | `adminProcedure`     | role = admin                 |

---

## 🧪 Suíte de Testes (128 testes)

| Arquivo                               | O que testa                                         |
| ------------------------------------- | --------------------------------------------------- |
| `server/clinicalIntelligence.test.ts` | 11 prompts, orçamento Opus, downgrade, JSON parsing |
| `server/cisRest.test.ts`              | Endpoints REST, auth, paginação, PII isolation      |
| `server/pubmed.test.ts`               | CircuitBreaker, cache Redis, E-utilities            |
| `server/roles.test.ts`                | Sistema de permissões por role                      |
| `server/security.test.ts`             | Payload bomb, CORS, CPF injection                   |
| `server/token.test.ts`                | Ciclo de vida de tokens                             |
| `server/pubmedQueue.test.ts`          | Worker queue BullMQ                                 |

---

## 🔒 Segurança & LGPD

- **Nome do paciente:** AES-256-GCM em `soapNotes.pacienteNomeEncrypted` — nunca exposto via API
- **Retenção CFM:** `soapNotes.retencaoAte` = criação + 20 anos (CFM Res. 1821/2007)
- **API REST:** `X-CIS-Api-Key` com `timingSafeEqual` (previne timing attack)
- **Rate limiting:** Redis-backed por endpoint
- **CORS:** exact-match origin (previne subdomain takeover)
- **devLogin:** `NOT_FOUND` em produção (indistinguível de rota inexistente)
- **Token localStorage:** chave `cis_token`; cookie fallback: `cis_session`

---

## ⚠️ Atenção ao Trabalhar no Projeto

1. **Schema:** usar SEMPRE `drizzle/cis-schema.ts` — nunca `drizzle/schema.ts` em código CIS
2. **Package manager:** sempre `pnpm` — `packageManager: pnpm@10.4.1`
3. **LGPD:** nome do paciente sempre via `encryption.ts`; nunca expor `pacienteNomeEncrypted`
4. **Opus budget:** `OPUS_DAILY_TOKEN_BUDGET` controla custo — downgrade automático
5. **Filas BullMQ:** prefixo `{cis-prod}` em prod — não usar prefixo `fp-*`
6. **Projeto independente:** NÃO tem ligação com Facilita PrEP. São projetos completamente separados.
