import { Queue, Worker } from 'bullmq'
import { lt, eq } from 'drizzle-orm'
import { db } from '../db.ts'
import { pacientes } from '../../drizzle/schema.ts'
import { logger } from '../_core/logger.ts'
import { connection, QUEUE_PREFIX, SHARED_WORKER_SETTINGS } from './queues.ts'

const RETENTION_QUEUE_NAME = 'retention-lgpd'
const retentionQueue = new Queue(RETENTION_QUEUE_NAME, { connection, prefix: QUEUE_PREFIX })

// Run daily at 03:00 — quiet window, no patient traffic
export async function agendarRetencaoDiaria() {
  await retentionQueue.add('purge-lgpd', {}, {
    repeat: { pattern: '0 3 * * *' },
    jobId: 'purge-lgpd-diario',
  })
}

async function executarPurgaLgpd(): Promise<{ purged: number; errors: number }> {
  const agora = new Date()
  let purged = 0
  let errors = 0

  const vencidos = await db
    .select({ id: pacientes.id })
    .from(pacientes)
    .where(lt(pacientes.retentionUntil, agora))

  if (vencidos.length === 0) {
    logger.info('[retention] nenhum registro vencido', { timestamp: agora.toISOString() })
    return { purged: 0, errors: 0 }
  }

  logger.info('[retention] iniciando anonimização LGPD', { count: vencidos.length })

  for (const row of vencidos) {
    try {
      await db
        .update(pacientes)
        .set({
          nomeEncrypted: '[anonimizado]',
          cpfEncrypted: '[anonimizado]',
          dataNascimentoEncrypted: null,
          nomeMaeEncrypted: null,
          emailEncrypted: null,
          telefoneEncrypted: null,
          cpfHash: '[anonimizado]',
          retentionUntil: null,
          updatedAt: new Date(),
        })
        .where(eq(pacientes.id, row.id))
      purged++
    } catch (err) {
      errors++
      logger.error('[retention] falha ao anonimizar paciente', { id: row.id, error: String(err) })
    }
  }

  logger.info('[retention] anonimização concluída', { purged, errors })
  return { purged, errors }
}

export function startRetentionWorker() {
  const worker = new Worker(
    RETENTION_QUEUE_NAME,
    async () => {
      const { purged, errors } = await executarPurgaLgpd()
      const { enviarRelatorioRetencao } = await import('../email.ts')
      await enviarRelatorioRetencao(purged, errors)
      return { purged, errors }
    },
    {
      ...SHARED_WORKER_SETTINGS,
      drainDelay: 300,
      connection,
      prefix: QUEUE_PREFIX,
    },
  )

  worker.on('failed', (job, err) => {
    logger.error('[retention] job falhou', { jobId: job?.id, error: err.message })
  })

  return worker
}
