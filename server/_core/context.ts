import type { Request, Response } from 'express'
import { verifyToken, COOKIE_NAME } from './auth.ts'
import { db } from '../db.ts'
import { users } from '../../drizzle/schema.ts'
import { eq } from 'drizzle-orm'

export interface MedscribeUser {
  id:                 number
  email:              string
  name:               string | null
  role:               'admin' | 'doctor'
  clinicId:           string | null
  specialty:          string | null
  crm:                string | null
  active:             number
  mustChangePassword: number
  bulletinEmail:      string | null
  receiveMonthlyBulletin: number
}

export interface Context {
  req:  Request
  res:  Response
  user: MedscribeUser | null
  // Legacy session field kept for backward compatibility with existing routes
  session: MedscribeUser | null
}

export async function createContext({ req, res }: { req: Request; res: Response }): Promise<Context> {
  const token = extractToken(req)
  if (!token) return { req, res, user: null, session: null }

  try {
    const payload = await verifyToken(token)

    const row = await db
      .select()
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1)
      .then((rows) => rows[0] ?? null)

    if (!row || !row.active) return { req, res, user: null, session: null }

    const user: MedscribeUser = {
      id:                     row.id,
      email:                  row.email,
      name:                   row.name ?? row.nome ?? null,
      role:                   (row.role === 'admin' ? 'admin' : 'doctor') as 'admin' | 'doctor',
      clinicId:               row.clinicId ?? null,
      specialty:              row.specialty ?? null,
      crm:                    row.crm ?? null,
      active:                 row.active,
      mustChangePassword:     row.mustChangePassword,
      bulletinEmail:          row.bulletinEmail ?? null,
      receiveMonthlyBulletin: row.receiveMonthlyBulletin,
    }

    return { req, res, user, session: user }
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.warn('[auth] token inválido:', err)
  }

  return { req, res, user: null, session: null }
}

function extractToken(req: Request): string | null {
  // Cookie MedScribe
  const cookie = req.cookies?.[COOKIE_NAME] as string | undefined
  if (cookie) return cookie

  // Authorization header (Bearer)
  const auth = req.headers.authorization
  if (auth?.startsWith('Bearer ')) return auth.slice(7)

  // Cookie legado Facilita PrEP
  const legacy = req.cookies?.fp_session as string | undefined
  return legacy ?? null
}
