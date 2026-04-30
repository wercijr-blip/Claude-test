export const RATE_LIMITS = {
  AUTH:         { windowMs: 15 * 60 * 1000, max: 10 },
  API_GERAL:    { windowMs: 60 * 1000,      max: 100 },
  PDF_GENERATE: { windowMs: 60 * 1000,      max: 10 },
} as const

export const JWT_EXPIRY = '8h'

export const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024 // 50MB (áudio)

export const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://medscrita.com.br',
] as const
