import { useState, useCallback } from 'react'
import type { AuthUser, PatientSession } from '@shared/types.ts'

const TOKEN_KEY = 'fp_token'

export function useAuth() {
  const [token, setTokenState] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))

  const setToken = useCallback((t: string | null) => {
    if (t) {
      localStorage.setItem(TOKEN_KEY, t)
    } else {
      localStorage.removeItem(TOKEN_KEY)
    }
    setTokenState(t)
  }, [])

  const logout = useCallback(() => setToken(null), [setToken])

  // Read directly from localStorage so the reference is stable and the tRPC
  // client (created once via useState) always gets the current token.
  const getToken = useCallback(() => localStorage.getItem(TOKEN_KEY), [])

  return { token, setToken, logout, getToken, isAuthenticated: !!token }
}

export function parseJwtPayload(token: string): AuthUser | PatientSession | null {
  try {
    const [, payload] = token.split('.')
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    return decoded as AuthUser | PatientSession
  } catch {
    return null
  }
}
