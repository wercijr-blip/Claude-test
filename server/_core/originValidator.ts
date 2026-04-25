import type { Request, Response, NextFunction } from 'express'
import { env } from './env.ts'

function buildAllowedOrigins(): string[] {
  const origins = new Set<string>()

  origins.add(env.APP_URL)

  if (env.ALLOWED_ORIGINS) {
    for (const o of env.ALLOWED_ORIGINS.split(',')) {
      const trimmed = o.trim()
      if (trimmed) origins.add(trimmed)
    }
  }

  return Array.from(origins)
}

const allowedOrigins = buildAllowedOrigins()

function isOriginAllowed(value: string): boolean {
  if (!value) return false
  if (/^https?:\/\/localhost(:\d+)?/.test(value)) return true
  return allowedOrigins.some((o) => value === o || value.startsWith(o))
}

export function validateOrigin(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin ?? ''
  const referer = req.headers.referer ?? ''

  if (env.NODE_ENV === 'development') {
    next()
    return
  }

  if (!isOriginAllowed(origin) && !isOriginAllowed(referer)) {
    res.status(403).json({ error: 'Origin não permitida' })
    return
  }

  next()
}

export function validateOAuthState(state: string, expected: string): boolean {
  if (!state || !expected) return false
  if (state.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < state.length; i++) {
    diff |= state.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return diff === 0
}

export function isAllowedRedirectUri(uri: string): boolean {
  try {
    const parsed = new URL(uri)
    if (/^localhost(:\d+)?$/.test(parsed.host)) return true
    return allowedOrigins.some((o) => {
      const base = new URL(o)
      return parsed.origin === base.origin
    })
  } catch {
    return false
  }
}
