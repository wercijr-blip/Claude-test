import type { Request, Response, NextFunction } from 'express'
import { ALLOWED_ORIGINS } from '@shared/security-constants.ts'
import { env } from './env.ts'

export function validateOrigin(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin ?? ''
  const referer = req.headers.referer ?? ''

  if (env.NODE_ENV === 'development') {
    next()
    return
  }

  const allowed = ALLOWED_ORIGINS as readonly string[]
  const originOk = allowed.some((o) => origin.startsWith(o))
  const refererOk = allowed.some((o) => referer.startsWith(o))

  if (!originOk && !refererOk) {
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
  const allowed = ALLOWED_ORIGINS as readonly string[]
  try {
    const parsed = new URL(uri)
    return allowed.some((o) => {
      const base = new URL(o)
      return parsed.origin === base.origin
    })
  } catch {
    return false
  }
}
