/**
 * Backup do banco de dados
 *
 * O banco usa TiDB Cloud Serverless (eu-central-1, Frankfurt — AWS).
 * Host: gateway01.eu-central-1.prod.aws.tidbcloud.com:4000
 *
 * O TiDB Cloud Serverless oferece backup automático com Point-in-Time Recovery (PITR)
 * gerenciado nativamente, sem necessidade de configuração manual.
 *
 * Para verificar o estado dos backups:
 *   1. Acesse https://tidbcloud.com e autentique
 *   2. Selecione o cluster facilita_prep
 *   3. Aba Settings → Backup
 *   4. Confirme que PITR está ativo e o retention period está configurado
 *
 * IMPORTANTE: NÃO usar pg_dump — o banco é MySQL-compatível (TiDB), não PostgreSQL.
 *
 * Para backup manual adicional (snapshot) ou retenção maior que o plano Serverless oferece,
 * use mysqldump com SSL obrigatório:
 *
 *   DB_URL="$DATABASE_URL"
 *   FILENAME="facilitaprep-$(date +%F).sql.gz"
 *   mysqldump \
 *     --host=gateway01.eu-central-1.prod.aws.tidbcloud.com \
 *     --port=4000 \
 *     --user="$DB_USER" \
 *     --password="$DB_PASS" \
 *     --ssl-mode=VERIFY_IDENTITY \
 *     --single-transaction \
 *     --quick \
 *     --routines \
 *     --triggers \
 *     facilita_prep \
 *     | gzip > /tmp/$FILENAME
 *
 *   # Upload para S3:
 *   aws s3 cp /tmp/$FILENAME s3://$BUCKET/backups/$FILENAME
 *
 * Retenção legal: dados de saúde devem ser retidos por mínimo 20 anos
 * conforme Lei 13.787/2018 e Resolução CFM 2.299/2021.
 */

console.log('[backup] Backup é gerenciado nativamente pelo TiDB Cloud (PITR).')
console.log('[backup] Acesse https://tidbcloud.com → cluster facilita_prep → Settings → Backup')
process.exit(0)
