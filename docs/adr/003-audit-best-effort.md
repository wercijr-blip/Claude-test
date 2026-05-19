# ADR 003 — logAudit em modo best-effort

**Status:** Aceito  
**Data:** 2025-05-19

## Contexto

O sistema registra todos os eventos críticos (acesso a dados de saúde, mutations de paciente, ações administrativas) na tabela `audit_log` via a função `logAudit()`. Em uma arquitetura de saúde sujeita a LGPD e CFM 2.299/2021, o log de auditoria é um requisito regulatório — não uma feature opcional.

Há uma tensão entre dois objetivos:

1. **Confiabilidade regulatória:** nenhum evento crítico deve ser perdido
2. **Disponibilidade do serviço:** uma falha no banco de auditoria não deve derrubar o fluxo clínico principal

## Decisão

`logAudit()` usa modo **best-effort**: a inserção no `audit_log` é feita com `.catch(err => logger.error(...))`, e um erro na auditoria **não propaga** para o caller.

O servidor de produção está em Railway com autoscaling, e o banco de dados (TiDB Cloud Serverless) é altamente disponível. Na prática, falhas de log são raras.

## Consequências

**Prós:**
- Falhas transitórias no banco (timeout, connection pool exhausted) não interrompem o atendimento clínico
- UX do paciente não é afetada por problemas de infra de auditoria

**Contras:**
- Em cenário de indisponibilidade total do banco, eventos de auditoria são perdidos sem notificação ao operador
- Não há replay/buffer: eventos perdidos durante downtime não são recuperáveis automaticamente

## Mitigações

- Todos os erros em `logAudit()` são logados em `logger.error` com nível estruturado (capturados pelo Sentry)
- O healthcheck (`server/scripts/healthcheck.ts`) verifica conectividade com o banco a cada execução (Railway cron 03:00 UTC)
- O runbook de incidentes (`docs/runbook-incidentes.md`) inclui verificação do `audit_log` na investigação de anomalias

## Alternativas Consideradas

- **Fail-fast:** propagar erros de auditoria — descartado por violar disponibilidade em contexto de saúde crítica
- **Fila de auditoria separada (BullMQ):** garantia de entrega com retry — viável no futuro se o volume de eventos crescer, mas adiciona complexidade para o cenário atual (< 500 pacientes/mês)
- **WAL/CDC:** captura de eventos via Change Data Capture — fora do escopo do stack atual
