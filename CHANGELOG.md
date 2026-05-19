# Changelog

## [Unreleased]

### Segurança
- Remover `paymentId` da resposta pública de `consultarStatusPorPrecadastro` (fecha cadeia de enumeração JWT)
- Substituir comparação de string por `timingSafeEqual` na validação do webhook Asaas (timing oracle)
- Adicionar circuit breaker para chamadas à API Asaas (Redis-backed + fallback local)
- LLM daily throttle via Redis counter (variável `LLM_DAILY_LIMIT`, padrão 200/dia)

### Adicionado
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
