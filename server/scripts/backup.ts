#!/usr/bin/env tsx
/**
 * Backup status checker — run via: pnpm backup
 *
 * O banco usa TiDB Cloud Serverless (eu-central-1, Frankfurt — AWS).
 * Backups automáticos com PITR (Point-in-Time Recovery) são gerenciados nativamente.
 *
 * Este script verifica o status de conectividade e exibe instruções de restore.
 *
 * RESTORE PROCEDURES — ver também RUNBOOK.md § 13
 * ─────────────────────────────────────────────
 *
 * 1. PITR (recomendado para restauração parcial ≤ 30 dias):
 *    - TiDB Cloud Console → cluster facilita_prep → Backup → Restore
 *    - Selecione o ponto no tempo desejado (granularidade: segundos)
 *    - PITR restaura em um novo cluster — nunca sobrescreve o original
 *    - Após validar os dados, use mysqldump no cluster restaurado + import na prod
 *
 * 2. mysqldump manual (para backups além do plano Serverless ou exportação):
 *
 *   export DB_USER="..." DB_PASS="..." BUCKET="nome-do-bucket"
 *   FILENAME="facilitaprep-$(date +%F-%H%M).sql.gz"
 *
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
 *   | gzip > /tmp/$FILENAME
 *
 *   aws s3 cp /tmp/$FILENAME s3://$BUCKET/backups/$FILENAME
 *   echo "Backup salvo em s3://$BUCKET/backups/$FILENAME"
 *
 * 3. Restore de arquivo mysqldump:
 *
 *   # Descomprimir
 *   gzip -d /tmp/facilitaprep-YYYY-MM-DD.sql.gz
 *
 *   # Importar — use uma janela de manutenção (bloqueia writes)
 *   mysql \
 *     --host=gateway01.eu-central-1.prod.aws.tidbcloud.com \
 *     --port=4000 \
 *     --user="$DB_USER" \
 *     --password="$DB_PASS" \
 *     --ssl-mode=VERIFY_IDENTITY \
 *     facilita_prep < /tmp/facilitaprep-YYYY-MM-DD.sql
 *
 * RETENÇÃO LEGAL
 * ─────────────────────────────────────────────
 * Dados de saúde: mínimo 20 anos — Lei 13.787/2018 + CFM 2.299/2021
 * Configurar lifecycle no S3 para Glacier após 90 dias se necessário.
 */

import { createConnection } from 'mysql2/promise'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('[backup] DATABASE_URL não definida — rode com: DATABASE_URL=... pnpm backup')
  process.exit(1)
}

console.log('[backup] TiDB Cloud (PITR) — verificando conectividade...')

let conn
try {
  conn = await createConnection(DATABASE_URL)
  const [rows] = await conn.query('SELECT VERSION() AS version, NOW() AS now')
  const { version, now } = (rows as Array<{ version: string; now: Date }>)[0]!
  console.log(`[backup] ✅ Conectado — TiDB ${version} — server time: ${now.toISOString()}`)
  console.log('[backup] ℹ️  Backups automáticos (PITR) gerenciados pelo TiDB Cloud.')
  console.log('[backup] ℹ️  Acesse: https://tidbcloud.com → cluster facilita_prep → Backup')
  console.log('[backup] ℹ️  Para restore detalhado, veja RUNBOOK.md § 13 ou os comentários deste arquivo.')
} catch (err) {
  console.error('[backup] ❌ Falha na conexão com o banco:', (err as Error).message)
  process.exit(1)
} finally {
  await conn?.end()
}
