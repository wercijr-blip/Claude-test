# Backup e Recuperação de Dados — CIS

## Banco de Dados (TiDB Cloud Serverless)

O banco de dados é gerenciado pelo **TiDB Cloud Serverless** (camada de dados gerenciada),
que oferece backup automático nativo — não é necessário script manual de `mysqldump` ou similar.

> **Nota:** O banco em produção é **TiDB Cloud Serverless (MySQL 8.0-compatible)** em
> `gateway01.sa-east-1.prod.aws.tidbcloud.com:4000`. Não usar `pg_dump` — o banco não é PostgreSQL.
> Backups automáticos diários nativos ficam disponíveis por 7 dias no dashboard PingCAP em
> **Backup → Automated Backup**. Para snapshots manuais antes de migrations, use `mysqldump`
> (ou `dumpling`, da PingCAP, que paraleliza o dump por chunks).

### Backup Automático

| Recurso    | Detalhe                                |
| ---------- | -------------------------------------- |
| Frequência | Diária (automática pela TiDB Cloud)    |
| Retenção   | 7 dias (padrão tier gratuito)          |
| Tipo       | Snapshot incremental                   |
| Acesso     | Console TiDB Cloud → Cluster → Backups |
| RPO        | < 24 horas                             |
| RTO        | < 4 horas (restauração via console)    |

> **LGPD/CFM:** Configurar retenção mínima de **20 dias** no painel TiDB Cloud para cumprir
> CFM 2.299/2021 (dados de saúde). Verificar em Settings → Backup.

### Backup Manual (Export)

Para exportações pontuais (ex.: antes de uma migration):

```bash
# Opção 1 — mysqldump (MySQL-compatible, flags obrigatórias para TiDB Cloud)
mysqldump \
  --host=gateway01.sa-east-1.prod.aws.tidbcloud.com \
  --port=4000 \
  --user="$DB_USER" \
  --password="$DB_PASS" \
  --ssl-mode=VERIFY_IDENTITY \
  --single-transaction \
  --set-gtid-purged=OFF \
  --quick \
  --routines \
  --triggers \
  cis_db \
  | gzip > backup-cis-$(date -u +%Y%m%d-%H%M%S).sql.gz

# Opção 2 — dumpling (ferramenta nativa PingCAP, paraleliza por chunks)
dumpling \
  -u "$DB_USER" -P 4000 \
  -h gateway01.sa-east-1.prod.aws.tidbcloud.com \
  -p "$DB_PASS" \
  --filetype sql \
  --threads 4 \
  --output ./backup-cis-$(date -u +%Y%m%d-%H%M%S) \
  --database cis_db

# Opção 3 — Via TiDB Cloud CLI (sem precisar de cliente local)
ticloud serverless export create \
  --cluster-id <SEU_CLUSTER_ID> \
  --database cis_db \
  --file-type SQL \
  --target-type LOCAL
```

Ou via console: TiDB Cloud → Cluster → **Import/Export** → Export.

### Restore Manual

```bash
# Restaurar a partir de dump mysqldump
gunzip -c backup-cis-YYYYMMDD-HHMMSS.sql.gz | mysql \
  --host=gateway01.sa-east-1.prod.aws.tidbcloud.com \
  --port=4000 \
  --user="$DB_USER" \
  --password="$DB_PASS" \
  --ssl-mode=VERIFY_IDENTITY \
  cis_db
```

### Configuração Recomendada em Produção

No painel TiDB Cloud, verifique que:

1. **Backup automático está habilitado** (Settings → Backup)
2. **Retenção mínima de 20 dias** para cumprir CFM 2.299/2021 (dados de saúde)
3. **PITR (Point-In-Time Recovery)** habilitado para restauração granular
4. **Alertas de falha de backup** configurados em Settings → Alerts

---

## Arquivos de Áudio (S3)

Gravações de consulta ficam no bucket `AWS_S3_BUCKET` (região: `sa-east-1`).

### Proteção

| Recurso      | Configuração                                                               |
| ------------ | -------------------------------------------------------------------------- |
| Versioning   | Habilitar via console AWS S3 → Properties                                  |
| Lifecycle    | `audio/` expira em 90 dias (após transcrição; o texto é o dado permanente) |
| Replicação   | Opcional: Cross-Region Replication `sa-east-1` → `us-east-1`               |
| Criptografia | SSE-S3 (Server-Side Encryption — padrão AWS)                               |

### Configurar Lifecycle (áudios expiram em 90 dias)

```bash
aws s3api put-bucket-lifecycle-configuration \
  --bucket "$AWS_S3_BUCKET" \
  --lifecycle-configuration '{
    "Rules": [{
      "ID": "expire-audio",
      "Filter": { "Prefix": "audio/" },
      "Status": "Enabled",
      "Expiration": { "Days": 90 }
    }]
  }'
```

### Habilitar Versioning

```bash
aws s3api put-bucket-versioning \
  --bucket "$AWS_S3_BUCKET" \
  --versioning-configuration Status=Enabled
```

---

## LGPD — Retenção de Dados

Conforme **Lei 13.787/2018** (digitalização de prontuários) e **CFM 2.299/2021**:

- SOAP notes devem ser retidas por **mínimo 20 anos** após o último atendimento
- O campo `retencao_ate` em `soap_notes` registra a data limite de retenção
- **Não apagar** registros antes do vencimento de `retencao_ate`
- Soft delete via `deleted_at` — registros nunca são removidos fisicamente antes do prazo

Solicitações de portabilidade/anonimização via LGPD Art. 18/20 devem ser processadas pelo
médico responsável no painel admin, respeitando o prazo legal de retenção.

---

## Tabelas CIS (referência)

| Tabela               | Dados                         | Retenção      |
| -------------------- | ----------------------------- | ------------- |
| `users`              | Staff (médico, admin)         | Indefinida    |
| `clinical_sessions`  | Sessões de atendimento        | 20 anos       |
| `soap_notes`         | SOAP + síntese PubMed         | 20 anos (CFM) |
| `conduct_alerts`     | Alertas de divergência        | 20 anos       |
| `publication_drafts` | Rascunhos científicos         | Indefinida    |
| `clinical_digests`   | Digests diário/semanal/mensal | 5 anos        |
