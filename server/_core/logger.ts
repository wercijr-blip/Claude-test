import { env } from './env.ts'

type Level = 'debug' | 'info' | 'warn' | 'error'

function emit(level: Level, message: string, context?: unknown) {
  const ts = new Date().toISOString()
  if (env.NODE_ENV === 'production') {
    const entry: Record<string, unknown> = { ts, level, msg: message }
    if (context !== undefined) entry['ctx'] = context
    console.log(JSON.stringify(entry))
  } else {
    const prefix = `[${ts}] ${level.toUpperCase().padEnd(5)}`
    if (context !== undefined) {
      console.log(`${prefix} ${message}`, context)
    } else {
      console.log(`${prefix} ${message}`)
    }
  }
}

export const logger = {
  debug: (msg: string, ctx?: unknown) => emit('debug', msg, ctx),
  info:  (msg: string, ctx?: unknown) => emit('info',  msg, ctx),
  warn:  (msg: string, ctx?: unknown) => emit('warn',  msg, ctx),
  error: (msg: string, ctx?: unknown) => emit('error', msg, ctx),
}
