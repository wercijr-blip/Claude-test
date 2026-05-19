# Changelog — CIS (Clinical Intelligence System)

Todas as mudanças notáveis são documentadas aqui.
Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/)

---

## [Unreleased]

### Added
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
