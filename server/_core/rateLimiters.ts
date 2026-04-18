import rateLimit from 'express-rate-limit'
import { RATE_LIMITS } from '@shared/security-constants.ts'

export const authLimiter = rateLimit({
  windowMs: RATE_LIMITS.AUTH.windowMs,
  max: RATE_LIMITS.AUTH.max,
  message: { error: 'Muitas tentativas de login. Aguarde 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
})

export const tokenValidateLimiter = rateLimit({
  windowMs: RATE_LIMITS.TOKEN_VALIDATE.windowMs,
  max: RATE_LIMITS.TOKEN_VALIDATE.max,
  message: { error: 'Muitas tentativas. Aguarde alguns minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
})

export const uploadLimiter = rateLimit({
  windowMs: RATE_LIMITS.UPLOAD.windowMs,
  max: RATE_LIMITS.UPLOAD.max,
  message: { error: 'Limite de uploads atingido. Aguarde 1 minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
})

export const apiLimiter = rateLimit({
  windowMs: RATE_LIMITS.API_GERAL.windowMs,
  max: RATE_LIMITS.API_GERAL.max,
  message: { error: 'Muitas requisições. Aguarde.' },
  standardHeaders: true,
  legacyHeaders: false,
})

export const pdfLimiter = rateLimit({
  windowMs: RATE_LIMITS.PDF_GENERATE.windowMs,
  max: RATE_LIMITS.PDF_GENERATE.max,
  message: { error: 'Limite de geração de PDFs atingido.' },
  standardHeaders: true,
  legacyHeaders: false,
})
