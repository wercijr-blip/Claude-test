# Runbook de Incidentes — Facilita PrEP

> Documento de referência para resposta a incidentes em produção.
> Atualizar após cada post-mortem.

## SLAs Definidos

| Severidade | Definição                                    | RTO   | RPO  |
|-----------|----------------------------------------------|-------|------|
| P0        | Site inacessível / banco indisponível        | 30min | 1h   |
| P1        | Pagamentos falhando / PDFs não gerados       | 1h    | 4h   |
| P2        | Feature degradada (1 rota com erro)          | 4h    | 24h  |
| P3        | Bug visual / problema não-bloqueante         | 48h   | —    |

## Monitoramento

- **Health check:** `GET https://facilitaprep.com.br/api/health`
- **Métricas:** `GET https://facilitaprep.com.br/api/metrics`
- **Versão:** `GET https://facilitaprep.com.br/api/health/version`
- **Logs:** Railway Dashboard → Deployments → Logs
- **Erros:** Sentry (https://sentry.io)

---

## Cenário 1: Site inacessível (503/timeout)

**Sintomas:** `/api/health` retorna 503 ou não responde.

**Diagnóstico:**
1. Verificar Railway Dashboard → status do serviço
2. `GET /api/health` → checar `db` e `redis`
3. Verificar logs no Railway para erro fatal

**Resolução:**
- Se `"db": "error"`: ver Cenário 2
- Se `"redis": "error"`: ver Cenário 3
- Se deployment travado: fazer novo deploy no Railway

---

## Cenário 2: Banco de dados inacessível (TiDB Cloud)

**Diagnóstico:**
1. Acessar TiDB Cloud console → verificar status do cluster
2. Cluster suspenso (free tier após inatividade): clicar "Resume"
3. Se ativo: verificar `DATABASE_URL` nas variáveis do Railway

**Resolução:**
- Free tier: reativar cluster no console TiDB
- Pool saturado: aguardar idle timeout de 5 min ou reiniciar serviço no Railway
- Credenciais incorretas: atualizar `DATABASE_URL` no Railway e fazer deploy

**Pós-incidente:**
- Verificar se houve perda de dados consultando TiDB backup
- Registrar RTO real vs. meta (30min)

---

## Cenário 3: Redis inacessível (Upstash)

**Impacto:** Rate limiters falham abertas; BullMQ jobs ficam presos.

**Diagnóstico:**
1. `/api/health` → `"redis": "error"`
2. Acessar Upstash console → verificar status e consumo (limite 500k cmds/mês)

**Resolução:**
- Quota excedida: aguardar reset mensal ou upgrade do plano
- Serviço down: Upstash tem SLA 99.9% — aguardar ou trocar `REDIS_URL` para Redis backup
- Reiniciar conexão: SIGTERM no Railway → restart automático

---

## Cenário 4: Webhook Asaas não processa pagamentos

**Sintomas:** Pacientes pagaram mas não receberam link de acesso.

**Diagnóstico:**
1. Verificar logs Railway: buscar `[asaas-webhook]`
2. Verificar tabela `stripe_events` no banco (deduplicação)
3. Verificar `ASAAS_WEBHOOK_TOKEN` no Railway
4. Header esperado: `asaas-access-token` (não `access_token`)

**Resolução:**
1. Acessar painel Asaas → Configurações → Webhooks
2. Verificar URL do webhook (`https://facilitaprep.com.br/api/asaas/webhook`)
3. Reenviar evento manualmente pelo painel Asaas
4. Se token errado: atualizar `ASAAS_WEBHOOK_TOKEN` e alinhar com Asaas

---

## Cenário 5: PDFs não sendo gerados

**Sintomas:** Pacientes com status `aprovado` mas sem PDF disponível.

**Diagnóstico:**
1. Verificar logs: buscar `[pdfQueue]`
2. Verificar fila em `/api/metrics` → `queues.pdf`
3. Verificar `dlq_jobs` no banco (jobs que esgotaram retries)

**Resolução:**
1. Se job no DLQ: usar endpoint admin `reprocessarDlqJob`
2. Se erro de certificado ICP: verificar `ICP_PFX_BASE64` e `ICP_PFX_PASSWORD` no Railway
3. Certificado expirado: renovar A3 ICP-Brasil (anual) e atualizar `ICP_PFX_BASE64`

---

## Restore de Backup TiDB

1. Acessar TiDB Cloud → Cluster → Backup → selecionar backup (automático diário)
2. Criar cluster de restore temporário
3. Exportar dados via TiDB Data Migration
4. Importar no cluster principal durante janela de manutenção
5. Verificar: `SELECT COUNT(*) FROM pacientes` deve bater com contagem pré-incidente

---

## Notificação de Incidente (LGPD Art. 48)

Se houver suspeita de exposição de dados pessoais:
1. **Até 72h:** notificar ANPD usando template em `docs/templates/notificacao-anpd.md`
2. Portal ANPD: https://www.gov.br/anpd/pt-br
3. Notificar pacientes afetados por e-mail

---

## Template de Post-Mortem

Criar arquivo `docs/post-mortems/YYYY-MM-DD-titulo.md` após cada incidente P0/P1:

```markdown
## Incidente: [título]
**Data:** YYYY-MM-DD
**Duração:** Xh Ymin
**Severidade:** P0/P1/P2
**RTO real vs. meta:** Xmin vs. 30min

### Linha do tempo
- HH:MM — [evento]

### Causa raiz
[descrição]

### Impacto
[usuários afetados, dados em risco, etc.]

### Correções aplicadas
- [item]

### Prevenção futura
- [ ] [ação]
```
