# Facilita PrEP

Plataforma digital para prevenção de HIV via PrEP (Profilaxia Pré-Exposição) no Brasil. Permite que pacientes preencham formulários clínicos, façam upload de exames, assinem TCLE digitalmente e recebam prescrições com assinatura digital ICP-Brasil.

**Domínio:** https://facilitaprep.com.br

## Início rápido

```bash
# Pré-requisitos: Node.js 22, pnpm 10, Docker
cp .env.example .env        # preencher variáveis obrigatórias
docker compose up -d        # MySQL 8, Redis 7, MinIO
pnpm install
pnpm db:push                # aplicar schema no banco local
pnpm dev                    # servidor + frontend com HMR
```

Acesse: http://localhost:3000

## Documentação

| Documento | Conteúdo |
|-----------|----------|
| [CLAUDE.md](./CLAUDE.md) | Stack, estrutura, convenções, segurança (leitura para LLMs) |
| [RODAR-LOCAL.md](./RODAR-LOCAL.md) | Setup local detalhado com Docker e troubleshooting |
| [docs/backups.md](./docs/backups.md) | Estratégia de backup LGPD-compliant |
| [docs/runbook-incidentes.md](./docs/runbook-incidentes.md) | Runbook para incidentes em produção |

## Stack

| Camada | Tecnologia |
|--------|------------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4 |
| API | tRPC v11 + Express 4 |
| Banco | Drizzle ORM + TiDB/MySQL 8 |
| Filas | BullMQ + Redis (Upstash) |
| Storage | AWS S3 |
| Pagamentos | Asaas |
| Assinatura digital | ICP-Brasil (A3) |

## Scripts

```bash
pnpm dev          # desenvolvimento (hot reload)
pnpm build        # build de produção
pnpm test         # rodar testes
pnpm test:coverage # testes com relatório de cobertura
pnpm check        # verificação TypeScript
pnpm db:push      # aplicar schema no banco
pnpm db:studio    # Drizzle Studio (UI do banco)
pnpm format       # formatar código
```

## Conformidade

- **LGPD**: Dados criptografados em repouso (AES-256-GCM), audit log imutável, retenção 20 anos (CFM)
- **CFM 2.299/2021**: Assinatura digital ICP-Brasil A3
- **OWASP**: Rate limiting, CSP, HSTS, RBAC, prevenção de SQL injection
