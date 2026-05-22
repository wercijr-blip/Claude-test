import { Queue } from 'bullmq'
import { env } from '../_core/env.ts'
import { redis } from '../_core/redis.ts'
import { db } from '../db.ts'
import { dlqJobs } from '../../drizzle/schema.ts'
import { logger } from '../_core/logger.ts'

export const PDF_QUEUE_NAME = 'pdf-generation'
export const LEMBRETE_QUEUE_NAME = 'lembrete-exame'
export const PESQUISA_QUEUE_NAME = 'pesquisa-satisfacao'
export const LINK_ACESSO_QUEUE_NAME = 'link-acesso'
export const NUTRICAO_QUEUE_NAME = 'nutricao-lead'

export const QUEUE_PREFIX = env.NODE_ENV === 'production' ? '{fp-prod}' : `{fp-${env.NODE_ENV}}`

export const connection = redis

// Upstash Redis free tier: 500k commands/month.
// BullMQ defaults burn through it in ~4 days with 3 active workers:
//   stalledInterval=30s × 3 workers = 6 stall-checks/min = ~260k checks/month
//   drainDelay=5s       × 3 workers = 36 polls/min       = ~1.5M polls/month
//
// drainDelay unit is SECONDS in BullMQ (not ms).
// Tuned per worker urgency — target: <80k commands/month total.
export const SHARED_WORKER_SETTINGS = {
  lockDuration: 60_000,
  stalledInterval: 60_000,
  maxStalledCount: 1,
  removeOnComplete: { count: 10 },
  removeOnFail: { count: 50 },
} as const

// Real-time: patient waits for docs — keep drainDelay short
export const PDF_WORKER_OPTS    = { ...SHARED_WORKER_SETTINGS, drainDelay: 15 }
// Delayed 24h: no urgency — poll infrequently
export const PESQUISA_WORKER_OPTS = { ...SHARED_WORKER_SETTINGS, drainDelay: 120 }
// Daily cron at 11h: poll very infrequently
export const LEMBRETE_WORKER_OPTS = { ...SHARED_WORKER_SETTINGS, drainDelay: 300 }

export const pdfQueue = new Queue(PDF_QUEUE_NAME, { connection, prefix: QUEUE_PREFIX })
export const lembreteQueue = new Queue(LEMBRETE_QUEUE_NAME, { connection, prefix: QUEUE_PREFIX })
export const pesquisaQueue = new Queue(PESQUISA_QUEUE_NAME, { connection, prefix: QUEUE_PREFIX })
export const linkAcessoQueue = new Queue(LINK_ACESSO_QUEUE_NAME, { connection, prefix: QUEUE_PREFIX })
export const nutricaoQueue = new Queue(NUTRICAO_QUEUE_NAME, { connection, prefix: QUEUE_PREFIX })

// Nutrição diária às 10h — poll very infrequently (daily cron)
export const NUTRICAO_WORKER_OPTS = { ...SHARED_WORKER_SETTINGS, drainDelay: 300 }

export async function persistDlq(
  queue: string,
  job: { id?: string; name: string; data?: unknown; attemptsMade?: number } | undefined,
  err: Error,
) {
  if (!job) return
  await db.insert(dlqJobs).values({
    queue,
    jobId: job.id ? String(job.id) : null,
    jobName: job.name,
    data: job.data ?? null,
    failReason: err.message,
    attempts: job.attemptsMade ?? 0,
  }).catch((e: unknown) => logger.error('[dlq] falha ao persistir job', { error: String(e) }))
}
