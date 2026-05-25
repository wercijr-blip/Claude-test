# Changelog

Todas as mudanças notáveis do Facilita PrEP são documentadas aqui.
Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

## [Unreleased]

### Adicionado

- Endpoint Prometheus `/api/metrics/prometheus` para integração com Grafana/Alertmanager
- Alerta por email quando DLQ acumula ≥ 10 jobs com falha
- Alerta por email quando certificado ICP-Brasil vence em < 60 dias (era < 30 dias, apenas log)
- `examApprovalService.ts` — lógica de aprovação automática extraída de `examQueue.ts`
- `OfflineIndicator` — banner de sem conexão para UX offline-aware
- Revogação de JWT por blocklist Redis no logout
- Testes unitários para `retentionWorker` (0% → cobertura básica)
- Proteção de boot: `TOTP_ENC_KEY` obrigatória em produção
- Workflow GitHub Actions para DR drill mensal automatizado
- Smoke test pós-deploy de staging no CI

### Corrigido

- `admin.ts`: delete sequencial de PDFs S3 substituído por `Promise.all` + `inArray` (batch)
- `examQueue.ts`: race condition em `forceRequeue` — `remove()` agora tem `.catch()` guard
- `checkDailyLimit`: `decr()` recupera slot no Redis ao rejeitar por limite
- `examQueue.ts`: backoff de 5s → 65s (garante cruzamento da janela de 60s do rate limit)
- `MedicoDashboard`: `onError` não limpa painel do médico (UX regressão revertida)
- `retentionWorker`: WHERE clause corrigida de `lt(id+1)` para `eq(id)`
- `paciente.ts`: `cpfHash` imutável após INSERT (removido de UPDATE e `onDuplicateKeyUpdate`)

### Segurança

- Detecção de injeção de prompt nos campos de exame (NGS1.12)
- Rate limiting de dados LGPD Art. 18 (3 req/hora por IP)
- CSP estrita com exceções documentadas para GTM e Sentry

## [1.0.0] — 2026-01-01

### Lançamento inicial

- Formulário multi-etapas PrEP (StepPaciente → StepTcle)
- Upload e análise de exames por IA (Claude API)
- Assinatura digital ICP-Brasil (PAdES/ETSI-CAdES)
- TCLE digital com assinatura do paciente
- Dashboard médico com aprovação/rejeição de exames
- Dashboard secretaria com gestão de tokens de acesso
- Painel de auditoria SBIS (BPIA + ECF + NGS1 + NGS2)
- Integração Asaas (pagamentos) e Meta CAPI (analytics)
- Retenção LGPD com anonimização automática (20 anos — CFM 2.218/2018)
