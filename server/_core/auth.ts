import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import { env } from './env.ts'

const COOKIE_NAME = 'ms_session'
const SECRET = new TextEncoder().encode(env.JWT_SECRET)

export { COOKIE_NAME }

export const hashPassword = (plain: string) => bcrypt.hash(plain, 10)
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash)

export async function signToken(payload: { userId: number; role: string }) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(SECRET)
}

export async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, SECRET)
  return payload as { userId: number; role: string }
}

export function getSessionCookieOptions(req: { secure?: boolean; hostname?: string }) {
  const isSecure = env.NODE_ENV === 'production'
  return {
    httpOnly:  true,
    secure:    isSecure,
    sameSite:  'lax' as const,
    path:      '/',
    maxAge:    8 * 60 * 60, // 8h em segundos
  }
}
