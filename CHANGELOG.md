# Changelog

## [Unreleased]

### Segurança / Conformidade
- **LGPD D04:** pixels GTM, Meta e GA4 agora só carregam após consentimento (`cookies_accepted=all`); `gtm-loader.js` tem guard no início
- Removida tag `<noscript>` do GTM que carregava unconditionally via iframe
- Removido `CookieBanner.tsx` legado (usava chave `cookie_consent` diferente da canônica `cookies_accepted`)

### Adicionado
- `server/capi.ts`: infraestrutura Meta Conversions API server-side (SHA-256 de PII, dedup por `event_id`, AbortController 5s, no-op silencioso sem env vars)
- `server/workers/nutricaoWorker.ts`: drip de 5 e-mails (dias 1/2/3/7/14) para leads não convertidos com dedup Redis TTL 25h
- `client/src/lib/analytics.ts`: persistência de UTMs em sessionStorage, `generateEventId()`, scroll depth 25/50/75/90%, time-on-page 30/60/120s, Enhanced Conversions dataLayer
- `MARKETING.md`: scorecard completo (45 dimensões), budget scaling, calendário sazonal, brief criativo
- `EXPERIMENTOS.md`: framework A/B com 7 regras e 10 testes priorizados
- `RUNBOOK.md`: procedimentos de DR para TiDB, Redis, Railway, certificado ICP-Brasil, variáveis de ambiente
- `server/capi.test.ts`: testes de no-op, hash SHA-256, tolerância a falhas de rede e timeout
- `client/src/lib/analytics.test.ts`: testes de UTM persistence, `generateEventId`, eventos dataLayer
- Fontes auto-hospedadas via `@fontsource/dm-sans` e `@fontsource/cormorant-garamond` (elimina dependência do Google Fonts CDN)

### Melhorado
- `server/capi.ts`: warn em produção quando CAPI não está configurado (era debug silencioso)
- `server/capi.ts`: `AbortController` com timeout de 5s na chamada ao Graph API
- `server/workers/nutricaoWorker.ts`: `import { Resend }` movido para top-level (era dynamic import dentro do loop)
- `server/workers/nutricaoWorker.ts`: removida coluna `sql\`NULL\`` fictícia do SELECT (dedup já é feito via Redis)
- `/api/metrics`: fila `nutricao-lead` incluída no relatório de queue depth
- `client/index.html`: removidos preconnects do Google Fonts (desnecessários após auto-hospedagem)

### ⚠️ Breaking Changes
- **Telefone:** campo `telefone` agora exige formato E.164 (`+5561999998888`). Números legados (10-11 dígitos sem `+55`) são normalizados automaticamente na leitura; o script `server/scripts/backfillTelefoneE164.ts` migra os registros no banco. Execute-o uma vez após o deploy.

### Segurança
- Remover `paymentId` da resposta pública de `consultarStatusPorPrecadastro` (fecha cadeia de enumeração JWT)
- Substituir comparação de string por `timingSafeEqual` na validação do webhook Asaas (timing oracle)
- Adicionar circuit breaker para chamadas à API Asaas (Redis-backed + fallback local)
- LLM daily throttle via Redis counter (variável `LLM_DAILY_LIMIT`, padrão 200/dia)

### Adicionado
- Alertas WhatsApp para equipe médica e secretaria (`notificarStaff`) com debounce Redis de 5 min e máscara de número (LGPD)
- Input de telefone internacional (`react-international-phone`) com validação E.164; script de backfill para registros legados
- Integração Z-API WhatsApp com 4 triggers (cadastro, link de acesso, lembrete, pesquisa)
- Endpoint admin `regenerarFichaAtendimento` para reprocessar PDFs corrompidos
- Tabela `dlq_jobs` para persistência de jobs que esgotam retries + campo `reprocessingAt` para idempotência
- Endpoint `/api/metrics` com queue depth e uso de memória
- CI/CD via GitHub Actions (TypeScript check, testes, build, audit)
- Dependabot para atualizações automáticas de segurança (npm + GitHub Actions)
- Sistema de toast para notificações de UX
- Utilitário `fmt` para formatação BRL e datas
- Hook `useFormDraft` aplicado a todos os steps do formulário paciente (rascunho persiste entre recarregamentos)
- Componente `SubmitButton` unificado com estado loading/disabled
- Banner de consentimento de cookies (LGPD)
- Runbook de incidentes e template de notificação ANPD
- Logging de custo estimado por análise de exame (LLM)
- Cron job `healthcheck.ts` (Railway 03:00 UTC) verificando DB, Redis, S3, DLQ size e TTL cleanup
- Paginação cursor-based (`paginationInput`/`paginatedResponse`) para listagens admin

### Melhorado
- Steps 2–5 do formulário paciente: validação + UPDATE em query única (elimina SELECT redundante por etapa)
- `formatarCpf` consolidado em `shared/validators.ts` (sem duplicação entre client e server)
- `admin.ts` dividido em sub-módulos `admin/users.ts` e `admin/dlq.ts` (sem mudança de API)
- Cobertura de testes: thresholds elevados para 75%/75%/60% (lines/functions/branches)
- Testes `pdfQueue.test.ts` com mock BullMQ para validar enqueue e nomes de fila

### Corrigido
- Header `asaas-access-token` no webhook (era `access_token`)
- Substituição de referências a Stripe por Asaas nas páginas legais

### Infraestrutura
- `.dockerignore` para excluir arquivos desnecessários da imagem Docker
- `.nvmrc` para pinar versão Node.js 22
- README.md com quick-start e documentação centralizada
