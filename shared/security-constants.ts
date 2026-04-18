export const RATE_LIMITS = {
  AUTH: { windowMs: 15 * 60 * 1000, max: 10 },
  TOKEN_VALIDATE: { windowMs: 5 * 60 * 1000, max: 20 },
  UPLOAD: { windowMs: 60 * 1000, max: 5 },
  API_GERAL: { windowMs: 60 * 1000, max: 100 },
  PDF_GENERATE: { windowMs: 60 * 1000, max: 10 },
} as const

export const TOKEN_EXPIRY_DAYS = 7

export const JWT_EXPIRY_STAFF = '8h'
export const JWT_EXPIRY_PATIENT = '4h'

export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024 // 10MB

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const

export const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://facilitaprep.manus.space',
] as const

export const CSRF_HEADER = 'x-csrf-token'

export const SESSION_COOKIE_NAME = 'fp_session'

export const SECURITY_EVENTS = {
  LOGIN_SUCCESS: 'login_success',
  LOGIN_FAILURE: 'login_failure',
  LOGOUT: 'logout',
  TOKEN_VALIDATED: 'token_validated',
  TOKEN_INVALID: 'token_invalid',
  UNAUTHORIZED_ACCESS: 'unauthorized_access',
  UPLOAD_SUCCESS: 'upload_success',
  UPLOAD_BLOCKED: 'upload_blocked',
  PDF_GENERATED: 'pdf_generated',
  CPF_INJECTION_ATTEMPT: 'cpf_injection_attempt',
  RATE_LIMIT_HIT: 'rate_limit_hit',
} as const
