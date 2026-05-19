# CIS — Clinical Intelligence System

Assistente de IA clínica single-doctor para o Dr. Werciley Saraiva Vieira Júnior (CRM-DF 16381, infectologista). Automatiza documentação clínica, síntese de evidências PubMed, detecção de divergências de conduta e geração de publicações científicas via 11 prompts LLM especializados.

## Stack

| Camada   | Tecnologia                                        |
| -------- | ------------------------------------------------- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4       |
| API      | tRPC v11 + Express 4                              |
| ORM      | Drizzle ORM (MySQL dialect)                       |
| Banco    | TiDB / MySQL 8                                    |
| Auth     | Google OAuth + JWT (jose)                         |
| IA       | Anthropic SDK — Haiku 4.5 / Sonnet 4.6 / Opus 4.7 |
| Filas    | BullMQ + Redis                                    |
| Hosting  | Railway                                           |

## Início Rápido

```bash
# 1. Instalar dependências
pnpm install

# 2. Subir Redis + MySQL local (Docker)
docker compose up -d

# 3. Configurar variáveis de ambiente
cp .env.example .env
# Para dev local com Docker: DATABASE_URL=mysql://cis:cisdev@localhost:3306/cis_db
#                             REDIS_URL=redis://localhost:6379

# 4. Criar tabelas no banco
pnpm db:push

# 5. Iniciar em desenvolvimento
pnpm dev
```

### Login em desenvolvimento (devLogin)

Sem Google OAuth configurado localmente, use o endpoint de login de desenvolvimento:

```bash
# Criar sessão como médico admin (apenas NODE_ENV != production)
curl -X POST http://localhost:3000/trpc/auth.devLogin \
  -H "Content-Type: application/json" \
  -d '{"json": {"openId": "dev-medico-001", "email": "dr@atos.med.br", "nome": "Dr. Werciley", "role": "admin"}}'
```

O token JWT retornado pode ser usado no header `Authorization: Bearer <token>` ou no cookie `cis_session`.

## Comandos

```bash
pnpm dev            # servidor + frontend com HMR
pnpm build          # build de produção
pnpm start          # servidor em produção
pnpm start:workers  # workers standalone (serviço separado)
pnpm check          # type-check TypeScript
pnpm test           # testes
pnpm test:coverage  # testes com relatório de cobertura
pnpm db:generate    # gerar migrations a partir do schema
pnpm db:migrate     # aplicar migrations ao banco
pnpm db:push        # push direto do schema (dev only)
pnpm db:studio      # Drizzle Studio — inspecionar banco
pnpm lint           # verificar formatação
pnpm format         # formatar código
```

## Configuração

Copie `.env.example` para `.env` e preencha:

**Obrigatórias:**

- `DATABASE_URL` — TiDB/MySQL 8
- `JWT_SECRET` — mín. 32 chars (gerar com `openssl rand -hex 32`)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — OAuth 2.0
- `OWNER_OPEN_ID` — sub Google do médico admin
- `ENCRYPTION_KEY` — 64 chars hex (gerar com `openssl rand -hex 32`)
- `CPF_HASH_SALT` — mín. 32 chars
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_S3_BUCKET`
- `BUILT_IN_FORGE_API_KEY` — chave Anthropic
- `REDIS_URL`

Ver `.env.example` para lista completa com documentação.

## Os 11 Prompts CIS

| ID      | Função                                 | Modelo             |
| ------- | -------------------------------------- | ------------------ |
| CIS-01  | Extrator de exames laboratoriais       | Haiku 4.5          |
| CIS-02a | MedScribe: SOAP note completo          | Sonnet 4.6         |
| CIS-02b | Knowledge metadata (MeSH, CID-10)      | Haiku 4.5          |
| CIS-03  | Síntese analítica de artigos PubMed    | Sonnet 4.6         |
| CIS-04  | Verificação de critérios DUT/ANS       | Sonnet 4.6         |
| CIS-05  | Relatório de tratamento para operadora | Sonnet 4.6         |
| CIS-06  | Detecção de divergência de conduta     | Sonnet 4.6         |
| CIS-07  | Digest diário                          | Sonnet 4.6         |
| CIS-08  | Digest semanal                         | Sonnet 4.6 / Batch |
| CIS-09  | Digest mensal                          | Sonnet 4.6 / Batch |
| CIS-10  | Série de casos (CARE)                  | Opus 4.7           |
| CIS-11  | Revisão de literatura                  | Opus 4.7           |

## Segurança & LGPD

- Nome do paciente: AES-256-GCM (`soapNotes.pacienteNomeEncrypted`)
- Retenção CFM: `retencaoAte` = criação + 20 anos (CFM Res. 1821/2007)
- API REST: `X-CIS-Api-Key` com `timingSafeEqual`
- CORS: exact-match origin
- devLogin: `NOT_FOUND` em produção

## Deploy (Railway)

1. Criar serviço apontando para este repositório
2. Adicionar plugin Redis
3. Configurar variáveis de ambiente (ver `.env.example`)
4. Definir `NODE_ENV=production`
5. Build command: `pnpm build`
6. Start command: `pnpm start`
7. **Release Command:** `pnpm db:migrate` — executa migrations automaticamente a cada deploy antes do novo container receber tráfego

Para workers separados: criar segundo serviço com `pnpm start:workers` e `WORKERS_ENABLED=false` no serviço principal.

Ver `docs/RUNBOOK.md` para operações e troubleshooting.
