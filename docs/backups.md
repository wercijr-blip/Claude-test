# Backup e Recuperação de Dados — Facilita PrEP

## Banco de Dados (TiDB Cloud Serverless)

O banco de dados é gerenciado pelo **TiDB Cloud Serverless** (camada de dados gerenciada),
que oferece backup automático nativo — não é necessário script manual de `pg_dump` ou similar.

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
# Via TiDB Cloud CLI (ticloud)
ticloud serverless export create \
  --cluster-id <SEU_CLUSTER_ID> \
  --database facilita_prep \
  --file-type SQL \
  --target-type LOCAL
```

Ou via console: TiDB Cloud → Cluster → **Import/Export** → Export.

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
