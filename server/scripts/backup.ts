/**
 * Backup do banco de dados
 *
 * O banco usa TiDB Cloud Serverless (sa-east-1, São Paulo — AWS).
 * Host: gateway01.sa-east-1.prod.aws.tidbcloud.com:4000
 *
 * O TiDB Cloud Serverless oferece backup automático com Point-in-Time Recovery (PITR)
 * gerenciado nativamente, sem necessidade de configuração manual.
 *
 * Para verificar o estado dos backups:
 *   1. Acesse https://tidbcloud.com e autentique
 *   2. Selecione o cluster cis_db
 *   3. Aba Settings → Backup
 *   4. Confirme que PITR está ativo e o retention period está configurado
 *
 * IMPORTANTE: NÃO usar pg_dump — o banco é MySQL-compatível (TiDB), não PostgreSQL.
 *
 * Para backup manual adicional (snapshot) ou retenção maior que o plano Serverless oferece,
 * use mysqldump com SSL obrigatório:
 *
 *   DB_URL="$DATABASE_URL"
 *   FILENAME="cis-$(date +%F).sql.gz"
 *   mysqldump \
 *     --host=gateway01.sa-east-1.prod.aws.tidbcloud.com \
 *     --port=4000 \
 *     --user="$DB_USER" \
 *     --password="$DB_PASS" \
 *     --ssl-mode=VERIFY_IDENTITY \
 *     --single-transaction \
 *     --quick \
 *     --routines \
 *     --triggers \
 *     cis_db \
 *     | gzip > /tmp/$FILENAME
 *
 *   # Upload para S3:
 *   aws s3 cp /tmp/$FILENAME s3://$BUCKET/backups/$FILENAME
 *
 * Retenção legal: dados de saúde devem ser retidos por mínimo 20 anos
 * conforme CFM Res. 1821/2007 e Lei 13.787/2018.
 */

console.log('[backup] Backup é gerenciado nativamente pelo TiDB Cloud (PITR).')
console.log('[backup] Acesse https://tidbcloud.com → cluster cis_db → Settings → Backup')
process.exit(0)
