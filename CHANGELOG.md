# Changelog — CIS (Clinical Intelligence System)

Todas as mudanças notáveis são documentadas aqui.
Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/)

---

## [Unreleased]

### Added

- Cursor pagination (`nextCursor`) em `listarSoapNotes`, `listarAlertas`, `listarDigests`, `listarPublicacoes`
- `exportarDadosPaciente` endpoint para portabilidade de dados (LGPD Art. 18 VI)
- `/api/health/metrics` expõe profundidade da DLQ e status do orçamento Opus
- `getDlqCount()` no módulo DLQ
- Campo `engines` no `package.json` (Node ≥ 22, pnpm 10.4.1)
- Tabela RTO/RPO e procedimento de drill de DR em `docs/RUNBOOK.md`
- `docker-compose.dev.yml` para Redis + MySQL local
- ADR-001 (modelo single-doctor) e ADR-002 (transcrição Whisper) em `docs/ADR/`
- Testes para DLQ e audit trail (`server/dlq.test.ts`, `server/audit.test.ts`)
- Thresholds de cobertura elevados para 75%/75%/65%

### Changed

- `listarAlertas`: ordenação estabilizada por `id DESC` (keyset pagination consistente)
- `listarDigests` / `listarPublicacoes`: mesma paginação por cursor aplicada
- `CISDashboard`: `invalidate()` substitui `refetch()`; botão "Marcar visto" com invalidação automática
- Estados de loading e erro na lista de notas recentes

### Removed

- `staffProcedure` (código morto — role `secretaria` não existe no CIS)
- `JWT_EXPIRY_PATIENT` e `ALLOWED_MIME_TYPES` (resíduos do Facilita PrEP)

---

### Added (histórico)

- 11 prompts de inteligência clínica (CIS-01 a CIS-11)
- Filas BullMQ: pubmed-synthesis, clinical-digest, case-series
- Síntese analítica de artigos PubMed com classificação GRADE
- Detecção de divergência de conduta com histórico de feedback
- Geração automática de série de casos (≥ 3 casos mesmo CID-10)
- Digest diário/semanal/mensal com Anthropic Batch API (50% custo)
- Publicação automática no vault Obsidian via GitHub API
- Notificações n8n para alertas de conduta urgentes
- Budget Opus com downgrade automático para Sonnet
- Integração Zotero + Unpaywall para texto completo open access
- AES-256-GCM para nome do paciente (LGPD)
- Retenção de 20 anos em `soap_notes.retencao_ate` (CFM 2.299/2021)
- Presigned URLs S3 para upload de áudio de consulta
- Transcrição via OpenAI Whisper (gpt-4o-mini-transcribe)
- CORS exact-match + Helmet + Permissions-Policy
- Rate limiting Redis por endpoint
- Circuit breaker para APIs externas (PubMed, Zotero, Obsidian)
- Health check em `/api/health` com status DB, Redis e filas
- Graceful shutdown com `worker.close()` antes de `redis.quit()`
- Docker Compose para desenvolvimento local (Redis)
- Runbook operacional em `docs/RUNBOOK.md`
- Migrations versionadas via `drizzle-kit generate` + `pnpm db:migrate`

### Security

- `timingSafeEqual` para autenticação da REST API por API key
- `devLogin` retorna NOT_FOUND em produção (indistinguível de rota inexistente)
- Sentry sem PII (`sendDefaultPii: false`), DSN via variável de ambiente
- CI com `pnpm audit --audit-level=high` bloqueante

---

## [1.0.0] — 2026-05-19

Versão inicial do CIS — lançamento em produção para ATOS Saúde Integrada.
