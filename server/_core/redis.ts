import IORedis from 'ioredis'
import { env } from './env.ts'

// Single shared Redis connection for BullMQ queues and rate limiters.
// BullMQ requires maxRetriesPerRequest: null; lazyConnect avoids blocking boot.
export const redis = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
})
