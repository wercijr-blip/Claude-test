# ADR 0002 — BullMQ com Upstash Redis (free tier)

**Status:** Aceito  
**Data:** 2025-Q4

## Contexto

O projeto precisa de filas assíncronas para geração de PDFs e análise de exames por IA.
BullMQ é a escolha natural para Node.js, mas consome muitos comandos Redis por padrão
(stalledInterval, drainDelay) — incompatível com o free tier do Upstash (500k cmd/mês).

## Decisão

Usar BullMQ com configurações conservadoras de polling:

- `stalledInterval: 60_000` (era 30s → 60s)
- `drainDelay` calibrado por urgência (15s PDFs → 300s crons diários)
- `removeOnComplete: { count: 10 }`, `removeOnFail: { count: 50 }`
- Estimativa: < 80k comandos/mês

## Consequências

**Positivas:**

- Custo zero de Redis em ambiente de produção para volume atual

**Negativas:**

- Latência de polling mais alta para filas de baixa urgência (pesquisa, lembrete)
- Backoff de retry precisa ser maior que 60s (atual: 65s) para cruzar a janela de rate limit

**Mitigação:** Migrar para Upstash pago se volume de jobs ultrapassar 400k/mês.
