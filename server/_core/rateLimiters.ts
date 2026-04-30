import rateLimit from 'express-rate-limit'
import { RedisStore } from 'rate-limit-redis'
import { redis } from './redis.ts'
import { RATE_LIMITS } from '../../shared/security-constants.ts'

function makeStore(prefix: string) {
  return new RedisStore({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sendCommand: ((...args: string[]) => redis.call(args[0], ...args.slice(1))) as any,
    prefix: `rl:${prefix}:`,
  })
}

export const authLimiter = rateLimit({
  windowMs: RATE_LIMITS.AUTH.windowMs,
  max: RATE_LIMITS.AUTH.max,
  message: { error: 'Muitas tentativas de login. Aguarde 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore('auth'),
})

export const tokenValidateLimiter = rateLimit({
  windowMs: RATE_LIMITS.TOKEN_VALIDATE.windowMs,
  max: RATE_LIMITS.TOKEN_VALIDATE.max,
  message: { error: 'Muitas tentativas. Aguarde alguns minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore('token'),
})

export const uploadLimiter = rateLimit({
  windowMs: RATE_LIMITS.UPLOAD.windowMs,
  max: RATE_LIMITS.UPLOAD.max,
  message: { error: 'Limite de uploads atingido. Aguarde 1 minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore('upload'),
})

export const apiLimiter = rateLimit({
  windowMs: RATE_LIMITS.API_GERAL.windowMs,
  max: RATE_LIMITS.API_GERAL.max,
  message: { error: 'Muitas requisições. Aguarde.' },
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore('api'),
})

export const pdfLimiter = rateLimit({
  windowMs: RATE_LIMITS.PDF_GENERATE.windowMs,
  max: RATE_LIMITS.PDF_GENERATE.max,
  message: { error: 'Limite de geração de PDFs atingido.' },
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore('pdf'),
})
