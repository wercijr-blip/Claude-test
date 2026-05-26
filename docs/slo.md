# SLI / SLO — Facilita PrEP

> Revisado: 2026-05-26 | Responsável: Dr. Werciley Saraiva Vieira Jr.

## Contexto

Facilita PrEP é uma plataforma de saúde para prescrição de PrEP. Os SLOs abaixo equilibram a criticidade clínica (pacientes dependem de acesso ao serviço) com a realidade operacional de uma plataforma cloud-native single-region.

---

## SLIs e SLOs

| # | Serviço | SLI | SLO | Janela |
|---|---------|-----|-----|--------|
| 1 | API (`/api/health`) | Disponibilidade — % de requests retornando 2xx ou 3xx | **99.5%** | Rolling 30 dias |
| 2 | API | Latência p95 de endpoints de leitura | **< 800 ms** | Rolling 7 dias |
| 3 | API | Latência p95 de mutações críticas (salvar etapa, upload) | **< 3 s** | Rolling 7 dias |
| 4 | Geração de PDF | Taxa de sucesso — PDFs gerados / solicitações enfileiradas | **99%** | Rolling 30 dias |
| 5 | Geração de PDF | Tempo de geração p95 | **< 60 s** | Rolling 7 dias |
| 6 | E-mail de link de acesso | Entrega dentro de 5 min do pagamento confirmado | **95%** | Rolling 30 dias |
| 7 | Análise de exames (IA) | Taxa de sucesso do job de análise | **95%** | Rolling 30 dias |
| 8 | Análise de exames (IA) | Tempo de análise p95 | **< 120 s** | Rolling 7 dias |

---

## Error Budget

| SLO | Budget mensal (43 200 min) | Budget diário |
|-----|--------------------------|---------------|
| Disponibilidade 99.5% | **216 min downtime** | ~7 min |
| PDF 99% | **432 falhas / 43 200 jobs** | — |

Quando o error budget semanal cair abaixo de 50%, nenhuma mudança de risco alto é deployada (freeze automático — documentado no runbook).

---

## Medição

| Fonte | O que mede |
|-------|-----------|
| Railway Healthcheck (`/api/health`) | Disponibilidade — ping a cada 60 s |
| `.github/workflows/health-check.yml` | Smoke test externo a cada 15 min |
| Sentry Performance | Latência de transactions por route |
| BullMQ Dashboard / logs | Taxa de sucesso de workers |
| Logs Railway (`pnpm start`) | Erros 5xx, timeouts |

---

## Alertas (ver `docs/alerting-rules.yml`)

| Condição | Severidade | Ação |
|----------|-----------|------|
| `/api/health` falha por 3 min consecutivos | **P0** | PagerDuty / WhatsApp imediato |
| Disponibilidade < 99% nas últimas 1h | **P1** | Notificação em até 15 min |
| Fila de PDF com > 20 jobs pendentes por > 10 min | **P2** | Notificação em até 30 min |
| Error budget semanal < 50% | **P2** | Revisão imediata de deploys |

---

## RTO / RPO (ver `docs/adr/004-rto-rpo-dr-targets.md`)

| Cenário | RTO | RPO |
|---------|-----|-----|
| Crash de instância Railway | **< 2 min** (auto-restart) | 0 (stateless) |
| Falha de banco TiDB | **< 4h** | **< 1h** (backups TiDB Cloud) |
| Região AWS S3 indisponível | **< 2h** | **< 24h** (última cópia) |
| Comprometimento de credenciais | **< 1h** | 0 (rotacionar + revogar) |

---

## Revisão

Os SLOs devem ser revisados trimestralmente ou após qualquer incidente P0/P1.
Histórico de incidentes: `docs/runbook-incidentes.md`.
