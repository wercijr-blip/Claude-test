export const RATE_LIMITS = {
  AUTH: { windowMs: 15 * 60 * 1000, max: 10 },
  TOKEN_VALIDATE: { windowMs: 5 * 60 * 1000, max: 20 },
  UPLOAD: { windowMs: 60 * 1000, max: 5 },
  API_GERAL: { windowMs: 60 * 1000, max: 100 },
  PDF_GENERATE: { windowMs: 60 * 1000, max: 10 },
  DATA_RIGHTS: { windowMs: 60 * 60 * 1000, max: 3 },
  TOTP: { windowMs: 15 * 60 * 1000, max: 10 },
  CIS_API: { windowMs: 60 * 1000, max: 60 },
} as const

export const TOKEN_EXPIRY_DAYS = 7

export const JWT_EXPIRY_STAFF = '8h'
export const JWT_EXPIRY_PATIENT = '4h'

export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024 // 10MB per file
export const MAX_REQUEST_SIZE_BYTES = 20 * 1024 * 1024 // 20MB ceiling for any request body

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'application/pdf',
] as const
