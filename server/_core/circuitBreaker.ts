import { logger } from './logger.ts'

interface CircuitState {
  failures: number
  lastFailure: number
  open: boolean
}

const circuits = new Map<string, CircuitState>()

export async function withCircuitBreaker<T>(
  name: string,
  fn: () => Promise<T>,
  opts = { threshold: 5, resetMs: 60_000 },
): Promise<T> {
  const state = circuits.get(name) ?? { failures: 0, lastFailure: 0, open: false }

  if (state.open) {
    const sinceFailure = Date.now() - state.lastFailure
    if (sinceFailure < opts.resetMs) {
      throw new Error(`[circuit-breaker] ${name} aberto — serviço temporariamente indisponível`)
    }
    // half-open: tentativa de recuperação
    state.open = false
  }

  try {
    const result = await fn()
    if (state.failures > 0) {
      state.failures = 0
      circuits.set(name, state)
    }
    return result
  } catch (err) {
    state.failures++
    state.lastFailure = Date.now()
    if (state.failures >= opts.threshold) {
      state.open = true
      logger.error(`[circuit-breaker] ${name} aberto após ${state.failures} falhas consecutivas`)
    }
    circuits.set(name, state)
    throw err
  }
}

export function getCircuitStatus(name: string): { open: boolean; failures: number } {
  const state = circuits.get(name)
  return state ? { open: state.open, failures: state.failures } : { open: false, failures: 0 }
}
