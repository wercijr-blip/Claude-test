# Backup e Recuperação de Dados — Facilita PrEP

## Banco de Dados (TiDB Cloud Serverless)

O banco de dados é gerenciado pelo **TiDB Cloud Serverless** (camada de dados gerenciada),
que oferece backup automático nativo — não é necessário script manual de `mysqldump` ou similar.

> **Nota:** O banco em produção é **TiDB Cloud Serverless (MySQL 8.0-compatible)** em
> `gateway01.eu-central-1.prod.aws.tidbcloud.com:4000`. Não usar `pg_dump` — o banco não é PostgreSQL.
> Backups automáticos diários nativos ficam disponíveis por 7 dias no dashboard PingCAP em
> **Backup → Automated Backup**. Para snapshots manuais antes de migrations, use `mysqldump`
> (ou `dumpling`, da PingCAP, que paraleliza o dump por chunks).

### Backup Automático

| Recurso | Detalhe |
|---|---|
| Frequência | Diária (automática pela TiDB Cloud) |
| Retenção | 7 dias (padrão tier gratuito) |
| Tipo | Snapshot incremental |
| Acesso | Console TiDB Cloud → Cluster → Backups |
| RPO | < 24 horas |
| RTO | < 4 horas (restauração via console) |

### Backup Manual (Export)

Para exportações pontuais (ex.: antes de uma migration):

```bash
# Opção 1 — mysqldump (MySQL-compatible, flags obrigatórias para TiDB Cloud)
mysqldump \
  --host=gateway01.eu-central-1.prod.aws.tidbcloud.com \
  --port=4000 \
  --user="$DB_USER" \
  --password="$DB_PASS" \
  --ssl-mode=VERIFY_IDENTITY \
  --single-transaction \
  --set-gtid-purged=OFF \
  --quick \
  --routines \
  --triggers \
  facilita_prep \
  | gzip > backup-$(date -u +%Y%m%d-%H%M%S).sql.gz

# Opção 2 — dumpling (ferramenta nativa PingCAP, paraleliza por chunks)
dumpling \
  -u "$DB_USER" -P 4000 \
  -h gateway01.eu-central-1.prod.aws.tidbcloud.com \
  -p "$DB_PASS" \
  --filetype sql \
  --threads 4 \
  --output ./backup-$(date -u +%Y%m%d-%H%M%S) \
  --database facilita_prep

# Opção 3 — Via TiDB Cloud CLI (sem precisar de cliente local)
ticloud serverless export create \
  --cluster-id <SEU_CLUSTER_ID> \
  --database facilita_prep \
  --file-type SQL \
  --target-type LOCAL
```

Ou via console: TiDB Cloud → Cluster → **Import/Export** → Export.

### Restore Manual

```bash
# Restaurar a partir de dump mysqldump (descomprime e importa via cliente mysql)
gunzip -c backup-YYYYMMDD-HHMMSS.sql.gz | mysql \
  --host=gateway01.eu-central-1.prod.aws.tidbcloud.com \
  --port=4000 \
  --user="$DB_USER" \
  --password="$DB_PASS" \
  --ssl-mode=VERIFY_IDENTITY \
  facilita_prep
```

### Configuração Recomendada em Produção

No painel TiDB Cloud, verifique que:

1. **Backup automático está habilitado** (Settings → Backup)
2. **Retenção mínima de 20 dias** para cumprir CFM 2.299/2021 (dados de saúde)
3. **Alertas de falha de backup** configurados em Settings → Alerts

---

## Arquivos S3 (Exames de Pacientes)

Exames enviados ficam no bucket `AWS_S3_BUCKET` (padrão: `facilita-prep-exames-producao`).

### Proteção

| Recurso | Configuração |
|---|---|
| Versioning | Habilitar via console AWS S3 → Properties |
| Lifecycle | `exames-inicio/` expira em 30 dias (configurado via `storage.ts:ensureS3Lifecycle`) |
| Replicação | Opcional: Cross-Region Replication para sa-east-1 → us-east-1 |

### Recomendação

Habilitar **S3 Versioning** no bucket de produção para proteção contra deleção acidental.

```bash
aws s3api put-bucket-versioning \
  --bucket facilita-prep-exames-producao \
  --versioning-configuration Status=Enabled
```

---

## LGPD — Retenção de Dados

Conforme **Lei 13.787/2018** (digitalização de prontuários) e **CFM 2.299/2021**:

- Prontuários de pacientes devem ser retidos por **mínimo 20 anos** após o último atendimento
- O campo `retention_until` em `pacientes` registra a data limite de retenção
- **Não apagar** registros de saúde antes do vencimento de `retention_until`

Solicitações de anonimização via LGPD Art. 18 são registradas no `audit_log` com
`action = 'paciente.anonymize_request'` para processamento pelo DPO, respeitando
o prazo legal de retenção.

---

## Certificados ICP-Brasil

- Arquivos `.pem` e `.pfx` em `server/certs/` — **NUNCA commitar**
- Em produção: armazenados como variável de ambiente `ICP_PFX_BASE64` (base64 do .pfx)
- Renovar certificado digital **antes do vencimento** (verificar data de expiração no console ICP-Brasil)
- Backup local seguro dos certificados fora do repositório (ex.: cofre de senhas)

---

## Checklist de Teste de Restore (Mensal)

Execute este checklist mensalmente para garantir que os procedimentos de restauração funcionam. Documente a data e o responsável.

**Data do último teste:** ___________  **Responsável:** ___________

### Banco de Dados (TiDB Cloud)

- [ ] Acessar Console TiDB Cloud → Cluster → **Backups**
- [ ] Confirmar que o backup mais recente tem status **"Success"** e data ≤ 24h atrás
- [ ] Acionar restore do snapshot em **ambiente de staging** (não produção)
- [ ] Após restore, executar: `SELECT COUNT(*) FROM pacientes` e `SELECT COUNT(*) FROM audit_log` — confirmar valores plausíveis e coerentes com produção
- [ ] Executar `SELECT * FROM pacientes LIMIT 1` e confirmar que CPF/nome retornam como dados criptografados (não plaintext)
- [ ] Verificar que todas as migrations estão aplicadas: `SELECT * FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 5`
- [ ] Documentar tempo total do restore (objetivo: < 1h para RTO ≤ 2h)

### Arquivos S3

- [ ] Executar: `aws s3api get-bucket-versioning --bucket $AWS_S3_BUCKET`
- [ ] Confirmar resposta: `"Status": "Enabled"`
- [ ] Testar recuperação de versão anterior de um arquivo: `aws s3api list-object-versions --bucket $AWS_S3_BUCKET --prefix exames/ --max-items 5`
- [ ] Confirmar que pelo menos uma versão anterior existe para um exame de teste

### Aplicação (Railway)

- [ ] Acessar Railway Dashboard → Service → **Deployments**
- [ ] Confirmar que o último deploy tem status "Success"
- [ ] Testar redeploy manual no ambiente de staging: Railway → Deploy → Redeploy
- [ ] Verificar que `/api/metrics` responde com HTTP 200 após redeploy
- [ ] Verificar que Redis reconecta automaticamente após restart (railway restart redis-service)

### Certificados ICP-Brasil

- [ ] Verificar data de expiração do certificado: `openssl pkcs12 -in server/certs/werciley.pfx -nokeys -clcerts | openssl x509 -noout -dates`
- [ ] Confirmar que `ICP_PFX_BASE64` está configurado como secret no Railway (não como arquivo)
- [ ] Se expiração < 60 dias: iniciar processo de renovação com ICP-Brasil

### Resultado do Drill

| Item | Status | Observação |
|---|---|---|
| TiDB restore | ✅ / ❌ | |
| S3 versioning | ✅ / ❌ | |
| Railway redeploy | ✅ / ❌ | |
| Certificado ICP | ✅ / ❌ | |
| Tempo total (RTO) | ___min | Objetivo: < 2h |
