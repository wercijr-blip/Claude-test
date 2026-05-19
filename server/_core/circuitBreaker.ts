import IORedis from 'ioredis'
import { env } from './env.ts'
import { logger } from './logger.ts'

const CB_PREFIX = 'cb:'

interface CircuitState {
  failures: number
  lastFailure: number
  open: boolean
}

// Dedicated Redis client for circuit breaker state.
// Separate from the BullMQ connection (which has maxRetriesPerRequest: null and
// would hang indefinitely). This one fails fast so circuit checks never block requests.
const cbRedis = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: 0,
  enableOfflineQueue: false,
  lazyConnect: true,
  connectTimeout: 1_000,
})
cbRedis.on('error', () => {}) // suppress unhandled error events; failures are caught per-call

// Local cache — updated on every write, used as synchronous fallback
// when Redis is unavailable (test env, transient network errors, restarts).
const localCache = new Map<string, CircuitState>()

async function readState(name: string): Promise<CircuitState> {
  try {
    const raw = await cbRedis.hgetall(`${CB_PREFIX}${name}`)
    if (!raw || Object.keys(raw).length === 0) {
      return localCache.get(name) ?? { failures: 0, lastFailure: 0, open: false }
    }
    const state: CircuitState = {
      failures: parseInt(raw.failures ?? '0', 10),
      lastFailure: parseInt(raw.lastFailure ?? '0', 10),
      open: raw.open === '1',
    }
    localCache.set(name, state)
    return state
  } catch {
    return localCache.get(name) ?? { failures: 0, lastFailure: 0, open: false }
  }
}

async function writeState(name: string, state: CircuitState, resetMs: number): Promise<void> {
  localCache.set(name, state)
  try {
    const key = `${CB_PREFIX}${name}`
    await cbRedis.hset(key, {
      failures: state.failures,
      lastFailure: state.lastFailure,
      open: state.open ? '1' : '0',
    })
    // Auto-expire after the reset window so stale open circuits don't persist forever
    await cbRedis.expire(key, Math.ceil(resetMs / 1000) + 30)
  } catch {
    // Redis write failed — local cache still holds state; won't survive restart
  }
}

export async function withCircuitBreaker<T>(
  name: string,
  fn: () => Promise<T>,
  opts = { threshold: 5, resetMs: 60_000 },
): Promise<T> {
  const state = await readState(name)

  if (state.open) {
    const sinceFailure = Date.now() - state.lastFailure
    if (sinceFailure < opts.resetMs) {
      throw new Error(`[circuit-breaker] ${name} aberto — serviço temporariamente indisponível`)
    }
    // half-open: allow one probe request through
    state.open = false
  }

  try {
    const result = await fn()
    if (state.failures > 0) {
      state.failures = 0
      await writeState(name, state, opts.resetMs)
    }
    return result
  } catch (err) {
    state.failures++
    state.lastFailure = Date.now()
    if (state.failures >= opts.threshold) {
      state.open = true
      logger.error(`[circuit-breaker] ${name} aberto após ${state.failures} falhas consecutivas`)
    }
    await writeState(name, state, opts.resetMs)
    throw err
  }
}

// Synchronous read from local cache — accurate for the current instance.
// Use for health endpoints and dashboards; not for circuit gating logic.
export function getCircuitStatus(name: string): { open: boolean; failures: number } {
  const state = localCache.get(name)
  return state ? { open: state.open, failures: state.failures } : { open: false, failures: 0 }
}
