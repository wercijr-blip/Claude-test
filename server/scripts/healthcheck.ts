/**
 * Healthcheck diário — executado como cron job no Railway (03:00 UTC).
 *
 * Verifica: banco de dados · Redis · S3
 * Em caso de falha: captura no Sentry + exit code 1 (Railway alerta via e-mail).
 *
 * Configuração no Railway:
 *   Serviço: healthcheck-diario
 *   Tipo: Cron Job
 *   Schedule: 0 3 * * *
 *   Comando: tsx server/scripts/healthcheck.ts
 *   Variáveis: herdar do ambiente production
 */
import '../_core/instrument.ts'
import { db } from '../db.ts'
import { redis } from '../_core/redis.ts'
import { env } from '../_core/env.ts'
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3'
import * as Sentry from '@sentry/node'
import { sql } from 'drizzle-orm'

interface CheckResult {
  name: string
  ok: boolean
  ms: number
  error?: string
}

const results: CheckResult[] = []

async function runCheck(name: string, fn: () => Promise<void>): Promise<void> {
  const start = Date.now()
  try {
    await fn()
    results.push({ name, ok: true, ms: Date.now() - start })
  } catch (err) {
    results.push({ name, ok: false, ms: Date.now() - start, error: (err as Error).message })
    Sentry.captureException(err, { tags: { check: name, script: 'healthcheck' } })
  }
}

await runCheck('database', async () => {
  await db.execute(sql`SELECT 1`)
})

await runCheck('redis', async () => {
  await redis.ping()
})

await runCheck('s3', async () => {
  const s3 = new S3Client({
    region: env.AWS_REGION ?? 'sa-east-1',
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
  })
  await s3.send(new HeadBucketCommand({ Bucket: env.AWS_S3_BUCKET }))
})

const allOk = results.every(r => r.ok)

for (const r of results) {
  const icon = r.ok ? '✓' : '✗'
  const detail = r.ok ? `${r.ms}ms` : `${r.ms}ms — ${r.error}`
  console.log(`${icon} ${r.name}: ${detail}`)
}

if (allOk) {
  console.log(`[healthcheck] Todos os serviços operacionais — ${new Date().toISOString()}`)
} else {
  console.error(`[healthcheck] FALHA detectada — veja Sentry para detalhes`)
}

await redis.quit().catch(() => {})
await Sentry.close(2000)
process.exit(allOk ? 0 : 1)
