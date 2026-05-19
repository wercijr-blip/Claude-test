# CIS — Runbook Operacional

> Referência rápida para operação e resolução de incidentes do Clinical Intelligence System.

---

## 1. Saúde do Sistema

### Health Check

```bash
# Verifica DB, Redis e filas BullMQ
curl https://cis.atos.med.br/api/health

# Versão do deploy
curl https://cis.atos.med.br/api/health/version
```

Resposta esperada: `{ "status": "ok", "db": "ok", "redis": "ok", "queues": {...} }`

### Logs em tempo real (Railway)

```bash
railway logs --service cis-server --tail
railway logs --service cis-workers --tail
```

---

## 2. Banco de Dados

### Verificar conectividade

```bash
mysql \
  --host=gateway01.sa-east-1.prod.aws.tidbcloud.com \
  --port=4000 --user="$DB_USER" --password="$DB_PASS" \
  --ssl-mode=VERIFY_IDENTITY \
  -e "SELECT 1; SHOW TABLES;" cis_db
```

### Aplicar migrations

```bash
# Sempre antes de um deploy com mudanças de schema
pnpm db:migrate
```

### Backup manual antes de migration crítica

```bash
mysqldump \
  --host=gateway01.sa-east-1.prod.aws.tidbcloud.com \
  --port=4000 --user="$DB_USER" --password="$DB_PASS" \
  --ssl-mode=VERIFY_IDENTITY --single-transaction --set-gtid-purged=OFF \
  cis_db | gzip > backup-cis-$(date -u +%Y%m%d-%H%M%S).sql.gz
```

### Restaurar Point-In-Time (TiDB Cloud)

1. Acesse o console TiDB Cloud → Cluster → Backups
2. Clique em **Restore** e selecione o ponto no tempo desejado
3. Restaure para um cluster de staging primeiro para validar
4. RTO estimado: < 4 horas

---

## 3. Continuidade de Negócio — RTO/RPO

### Objetivos

| Componente | RPO (máx. perda de dados) | RTO (tempo de recuperação) |
|---|---|---|
| Banco de dados (TiDB Cloud) | 5 minutos (PITR automático) | < 4 horas |
| Redis (filas BullMQ) | 0 — jobs em DLQ para replay | < 15 minutos |
| Servidor CIS (Railway) | n/a | < 5 minutos (restart) |
| Armazenamento de áudio (S3) | 0 — replicação multi-AZ | < 30 minutos |

**SLA operacional informado ao cliente:** disponibilidade de 99,5% mês (≤ 3,65h/mês de indisponibilidade).

### Procedimento de Drill de DR (realizar trimestralmente)

1. **Notificar** o Dr. Werciley: janela de manutenção prevista (janela fora do horário clínico, 22h–01h BRT).
2. **Verificar estado da DLQ** antes de iniciar: `curl https://cis.atos.med.br/api/health | jq .queues`
3. **Simular falha de BD:** pausar o cluster no console TiDB Cloud → confirmar que o CIS retorna 503 e que nenhum dado é perdido.
4. **Restaurar PITR:** selecionar ponto no tempo 15 minutos antes → restaurar em cluster de staging → validar integridade (contagem de registros, SOAPs, alertas).
5. **Simular falha de Redis:** parar o serviço Redis → confirmar que jobs em `waiting` são re-enfileirados após restart.
6. **Testar replay de DLQ:** adicionar job de teste na fila `dlq` → confirmar que pode ser re-processado manualmente via Bull Board.
7. **Registrar resultado** no post-mortem de DR: duração efetiva de recuperação vs RTO/RPO acima.
8. **Próximo drill:** agendar para 90 dias.

---

## 4. Redis

### Verificar conexão

```bash
redis-cli -u "$REDIS_URL" PING
# Esperado: PONG
```

### Inspecionar filas BullMQ

```bash
# Jobs aguardando
redis-cli -u "$REDIS_URL" KEYS "{cis-prod}:*:wait"

# Jobs ativos
redis-cli -u "$REDIS_URL" KEYS "{cis-prod}:*:active"

# Jobs com falha
redis-cli -u "$REDIS_URL" KEYS "{cis-prod}:*:failed"
```

### Limpar jobs travados (use com cuidado)

```bash
# Lista jobs failed da fila pubmed-synthesis
redis-cli -u "$REDIS_URL" LRANGE "{cis-prod}:pubmed-synthesis:failed" 0 -1
```

---

## 5. Workers BullMQ

### Verificar status dos workers

Os workers expostos via `/api/health` mostram contagem de jobs waiting/active/failed por fila.

```bash
curl https://cis.atos.med.br/api/health | jq .queues
```

### Reiniciar workers (Railway)

```bash
railway service restart cis-workers
```

### Jobs travados (stalled)

BullMQ detecta jobs travados automaticamente via `stalledInterval`. Se um worker travar:
1. O job é re-enfileirado automaticamente (máx `maxStalledCount: 1`)
2. Após `maxStalledCount`, o job vai para failed
3. Verifique os logs: `railway logs --service cis-workers`

### Jobs com falha persistente

Jobs que excederam tentativas ficam com status `failed` (mantidos por 20-30 entradas via `removeOnFail`).
Para re-processar manualmente:

```bash
# Via Bull Board (se habilitado) ou diretamente via Redis
redis-cli -u "$REDIS_URL" LRANGE "{cis-prod}:pubmed-synthesis:failed" 0 -1
```

---

## 6. Antropic / LLM

### Verificar budget Opus diário

```bash
curl -H "X-CIS-Api-Key: $CIS_API_KEY" https://cis.atos.med.br/api/cis/budget
```

### Budget esgotado (downgrade automático para Sonnet)

O CIS faz downgrade automático para Sonnet quando `OPUS_DAILY_TOKEN_BUDGET` é atingido.
Reset automático à meia-noite UTC. Sem ação necessária.

Para aumentar o limite, altere `OPUS_DAILY_TOKEN_BUDGET` nas variáveis de ambiente do Railway.

---

## 7. Incidents — Procedimentos

### P1 — Sistema inacessível

1. Verificar Railway status: `railway status`
2. Verificar health: `curl https://cis.atos.med.br/api/health`
3. Se DB down: verificar TiDB Cloud status page (pingcap.com/status)
4. Se Redis down: verificar provider Redis (Railway / Upstash)
5. Reiniciar serviço: `railway service restart cis-server`

### P2 — SOAP notes não sendo geradas

1. Verificar logs tRPC: `railway logs --service cis-server | grep trpc`
2. Verificar quota Anthropic: console.anthropic.com
3. Verificar variável `BUILT_IN_FORGE_API_KEY` no Railway

### P3 — Síntese PubMed atrasada

1. Verificar fila: `curl https://cis.atos.med.br/api/health | jq .queues.pubmed`
2. Se workers parados: `railway service restart cis-workers`
3. Se NCBI com problemas: aguardar (circuit breaker reativa em 30s após 50% sucesso)

### P4 — Alertas de conduta não aparecendo

1. Verificar se síntese PubMed foi concluída (pré-requisito)
2. Verificar logs: `railway logs --service cis-workers | grep divergência`
3. O alerta sem síntese é gerado em `processarConsulta` — o re-run com síntese é best-effort

---

## 8. Contatos

| Responsável | Função | Contato |
|------------|--------|---------|
| Dr. Werciley Saraiva Vieira Júnior | Médico proprietário / CRM-DF 16381 | (61) 99401-8161 |

---

## 9. Variáveis de Ambiente Críticas

Ver `.env.example` para lista completa. Variáveis obrigatórias em produção:

```
DATABASE_URL          # TiDB Cloud — jdbc string
REDIS_URL             # Redis URL completa
JWT_SECRET            # ≥ 32 chars — NUNCA rotacionar sem invalidar sessões
ENCRYPTION_KEY        # 64 chars hex — NUNCA rotacionar (dados históricos ilegíveis)
CPF_HASH_SALT         # ≥ 32 chars — NUNCA rotacionar (hashes históricos inválidos)
GOOGLE_CLIENT_ID      # OAuth
GOOGLE_CLIENT_SECRET  # OAuth
OWNER_OPEN_ID         # sub Google do médico admin
BUILT_IN_FORGE_API_KEY # Anthropic API key
AWS_ACCESS_KEY_ID     # S3
AWS_SECRET_ACCESS_KEY # S3
AWS_S3_BUCKET         # S3 bucket name
AWS_REGION            # sa-east-1
APP_URL               # URL pública — https://cis.atos.med.br
```

---

## 10. Template de Post-Mortem

Usar após qualquer incidente SEV-1 (dados inacessíveis, falha de auth, DLQ acumulando) ou SEV-2 (degradação >15min).

```markdown
# Post-Mortem: [Título Breve do Incidente]

**Data:** YYYY-MM-DD  
**Duração:** HH:MM – HH:MM BRT  
**Severidade:** SEV-1 / SEV-2  
**Sistemas afetados:** CIS API / BullMQ / Redis / TiDB / S3 / Anthropic  

## Resumo

Uma frase descrevendo o que aconteceu e o impacto clínico (se houver).

## Linha do tempo

| Hora BRT | Evento |
|---|---|
| HH:MM | Incidente detectado via alerta / usuário |
| HH:MM | Início da investigação |
| HH:MM | Causa-raiz identificada |
| HH:MM | Mitigação aplicada |
| HH:MM | Serviço restaurado |

## Causa-raiz

Descrever a causa técnica precisa (código, configuração, infraestrutura).

## Impacto

- Consultas afetadas: N
- SOAPs perdidos: N (se houver)
- Tempo de indisponibilidade: HH:MM

## O que funcionou bem

- …

## O que poderia ter sido melhor

- …

## Ações corretivas

| Ação | Responsável | Prazo |
|---|---|---|
| … | Werciley | YYYY-MM-DD |
```
