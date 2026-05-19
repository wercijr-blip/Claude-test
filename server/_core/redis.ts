import IORedis from 'ioredis'
import { env } from './env.ts'

// Single shared Redis connection for BullMQ queues and rate limiters.
// BullMQ requires maxRetriesPerRequest: null; lazyConnect avoids blocking boot.
export const redis = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
})

// Shared keyspace prefix — all queues must use the same value or workers won't see their jobs.
export const QUEUE_PREFIX = env.NODE_ENV === 'production' ? '{fp-prod}' : `{fp-${env.NODE_ENV}}`
