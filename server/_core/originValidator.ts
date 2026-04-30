import type { Request, Response, NextFunction } from 'express'
import { env } from './env.ts'
import { allowedOrigins, isOriginAllowed } from './security.ts'

function refererToOrigin(referer: string): string {
  try {
    return new URL(referer).origin
  } catch {
    return ''
  }
}

export function validateOrigin(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin ?? ''
  const refererOrigin = refererToOrigin(req.headers.referer ?? '')

  if (env.NODE_ENV === 'development') {
    next()
    return
  }

  if (!isOriginAllowed(origin) && !isOriginAllowed(refererOrigin)) {
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
