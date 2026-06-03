# Atos Saúde Bot — Runbook Operacional

## Contatos de Emergência

| Papel | Responsabilidade |
|---|---|
| Admin técnico | Acesso Railway, Railway CLI, servidor |
| Clínica | Contato pacientes, WhatsApp manual |

---

## 1. Health Check

**Endpoint:** `GET /health`

Retorna:
```json
{
  "ok": true,
  "db": "ok",
  "whatsapp": "ok",
  "uptime": 12345,
  "ts": "2025-01-20T10:00:00.000Z"
}
```

- `db: "error"` → problema no SQLite. Ver seção 3.
- `whatsapp: "error"` → Evolution API inacessível. Ver seção 4.
- HTTP 503 → servidor em degradação crítica.

---

## 2. Reiniciar o Serviço

### Railway (produção)
```bash
# Via Railway CLI
railway up --service atos-saude-bot

# Via painel Railway: Settings → Deploy → Redeploy
```

### Docker local
```bash
docker compose restart atos-saude-bot
```

### Variáveis de ambiente obrigatórias
```
JWT_SECRET           # mínimo 32 chars
PII_ENCRYPTION_KEY   # 64 hex chars (node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
EVOLUTION_URL        # URL da Evolution API
EVOLUTION_API_KEY    # chave de acesso Evolution
EVOLUTION_WEBHOOK_SECRET  # segredo do webhook (mesmo na Evolution e aqui)
INSTANCE_NAME        # nome da instância WhatsApp
ANTHROPIC_API_KEY    # para FAQ por IA
PANEL_ORIGIN         # origem autorizada para CORS (ex: https://meudominio.com)
```

---

## 3. Problema no Banco de Dados

### Sintomas
- `/health` retorna `"db": "error"`
- Logs: `SqliteError: SQLITE_CANTOPEN` ou `SQLITE_BUSY`

### Diagnóstico
```bash
# Verificar se o volume está montado
ls -lh $DATA_DIR/atos-saude.db

# Checar integridade
sqlite3 $DATA_DIR/atos-saude.db "PRAGMA integrity_check;"
```

### Restaurar backup
```bash
# Listar backups disponíveis
ls -lh $DATA_DIR/backups/

# Restaurar (substitui o banco atual)
pnpm restore
# ou manualmente:
gunzip -c $DATA_DIR/backups/atos-saude-YYYY-MM-DDThh-mm-ss.db.gz > $DATA_DIR/atos-saude.db
```

### Forçar WAL checkpoint (trava de leitura/escrita)
```bash
sqlite3 $DATA_DIR/atos-saude.db "PRAGMA wal_checkpoint(FULL);"
```

---

## 4. WhatsApp Desconectado

### Sintomas
- `/health` retorna `"whatsapp": "error"`
- Painel mostra status diferente de `open`
- Bot não responde mensagens

### Reconectar via painel
1. Acesse `https://<domínio>/painel`
2. Aba **WhatsApp** → botão **Reconectar**
3. Escaneie o QR code com o WhatsApp do chip da clínica

### Reconectar via API
```bash
# Reiniciar instância
curl -X DELETE $EVOLUTION_URL/instance/logout/$INSTANCE_NAME \
  -H "apikey: $EVOLUTION_API_KEY"

curl -X GET $EVOLUTION_URL/instance/connect/$INSTANCE_NAME \
  -H "apikey: $EVOLUTION_API_KEY"
```

### Verificar webhook registrado
```bash
curl $EVOLUTION_URL/webhook/find/$INSTANCE_NAME \
  -H "apikey: $EVOLUTION_API_KEY"
# Deve apontar para: https://<domínio>/webhook
```

---

## 5. Falha no Backup

### Sintomas
- Log: `Falha ao criar backup local`
- Notificação WhatsApp para ADMIN_PHONE (se configurado)
- Sem arquivo em `$DATA_DIR/backups/` do dia

### Executar backup manual
```bash
pnpm backup
```

### Verificar S3 (se configurado)
```bash
aws s3 ls s3://$AWS_BACKUP_BUCKET/backups/ --profile atos-saude
```

---

## 6. Job de Scheduler com Falha

### Verificar log de jobs
```sql
-- Últimos 20 jobs (qualquer status)
SELECT job_name, status, duration_ms, detail, executed_at
FROM job_log
ORDER BY executed_at DESC
LIMIT 20;

-- Jobs com falha nas últimas 24h
SELECT * FROM job_log
WHERE status = 'FAILED'
  AND executed_at > datetime('now', '-1 day');
```

### Jobs disponíveis
| Job | Horário | Descrição |
|---|---|---|
| `agenda-medicos` | 8h BRT | Envia agenda do dia seguinte aos médicos |
| `lembretes` | A cada 15min | Lembretes 24h e 2h antes da consulta |
| `pesquisas` | A cada 15min | Pesquisa de satisfação 3h após consulta |
| `limpeza` | 3h BRT | Remove sessões, mensagens >90 dias, tokens expirados |
| `backup` | 2h BRT | Backup diário do banco + upload S3 |

---

## 7. Mensagens com Erro (DLQ)

Webhooks que falharam ao processar ficam registrados em `audit_log`:

```sql
SELECT * FROM audit_log
WHERE action = 'webhook_error'
ORDER BY created_at DESC
LIMIT 20;
```

Para reprocessar manualmente, use o `message_id` (coluna `target_id`) para localizar a mensagem nos logs da Evolution API.

---

## 8. LGPD — Solicitações de Titulares

### Acesso aos dados (Art. 18 I)
```
GET /api/pacientes/:phone
Authorization: Bearer <admin-token>
```

### Exclusão de dados (Art. 18 III)
```
DELETE /api/pacientes/:phone
Authorization: Bearer <admin-token>
```

Agendamentos são **anonimizados** (não deletados) — obrigação de retenção CFM (20 anos).

---

## 9. Rotação de Secrets

### JWT_SECRET
```bash
# Gerar novo secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Atualizar variável no Railway → todos os tokens existentes serão invalidados automaticamente
```

### PII_ENCRYPTION_KEY
⚠️ **Atenção:** Trocar esta chave torna os dados PII existentes ilegíveis.
Só trocar após migrar (descriptografar → nova chave → recriptografar) ou em implantação nova.

---

## 10. Monitoramento

| Métrica | Como verificar |
|---|---|
| Uptime | `GET /health` → campo `uptime` |
| Agendamentos do dia | `GET /api/stats` |
| Jobs recentes | `SELECT * FROM job_log ORDER BY executed_at DESC LIMIT 10` |
| Erros webhook | `SELECT * FROM audit_log WHERE action='webhook_error'` |
| Sessões ativas | `SELECT COUNT(*) FROM sessions` |
| Mensagens processadas | `SELECT COUNT(*) FROM processed_messages` |
