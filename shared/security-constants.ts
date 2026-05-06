export const RATE_LIMITS = {
  AUTH: { windowMs: 15 * 60 * 1000, max: 10 },
  TOKEN_VALIDATE: { windowMs: 5 * 60 * 1000, max: 20 },
  UPLOAD: { windowMs: 60 * 1000, max: 5 },
  API_GERAL: { windowMs: 60 * 1000, max: 100 },
  PDF_GENERATE: { windowMs: 60 * 1000, max: 10 },
  // LGPD Art. 18 — solicitações de direitos do titular (3 por hora por IP)
  DATA_RIGHTS: { windowMs: 60 * 60 * 1000, max: 3 },
  // TOTP verification — 2FA endpoints
  TOTP: { windowMs: 15 * 60 * 1000, max: 10 },
} as const

export const TOKEN_EXPIRY_DAYS = 7

export const JWT_EXPIRY_STAFF = '8h'
export const JWT_EXPIRY_PATIENT = '4h'

export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024 // 10MB per file
export const MAX_REQUEST_SIZE_BYTES = 20 * 1024 * 1024 // 20MB ceiling for any request body

// WEBP NÃO está aqui porque pdf-lib não suporta WEBP nativamente —
// o exame anexado seria perdido na finalização da documentação
// (prepararExameAnexadoComoPdf rejeita formatos não-PDF/PNG/JPG).
// Para suportar WEBP no futuro, adicionar conversão (sharp) antes
// do embed em PDF.
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'application/pdf',
] as const

// ── Regras de análise de exame HIV (IA) ──────────────────────
export const EXAM_RULES = {
  // Confidence threshold for automatic approval of non-reactive results
  AUTO_APPROVE_MIN_CONFIDENCE: 0.9,
  // Confidence below this → inconclusive, send to medico review
  LOW_CONFIDENCE_THRESHOLD: 0.7,
} as const

