import { z } from 'zod'
import { SignJWT } from 'jose'
import { router, publicProcedure, protectedProcedure } from '../_core/trpc.ts'
import { env } from '../_core/env.ts'
import { db } from '../db.ts'
import { users } from '../../drizzle/schema.ts'
import { eq } from 'drizzle-orm'
import { JWT_EXPIRY_STAFF } from '../../shared/security-constants.ts'
import type { Role } from '../../shared/types.ts'

export const authRouter = router({
  // Callback OAuth — troca code por JWT interno
  callback: publicProcedure
    .input(z.object({ code: z.string(), state: z.string().optional() }))
    .mutation(async ({ input }) => {
      // Trocar code por dados do usuário no servidor OAuth
      const resp = await fetch(`${env.OAUTH_SERVER_URL}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: input.code, app_id: env.VITE_APP_ID }),
      })

      if (!resp.ok) throw new Error('Falha ao obter token OAuth')

      const data = (await resp.json()) as {
        openId: string
        email: string
        name: string
      }

      // Upsert do usuário
      const [existing] = await db.select().from(users).where(eq(users.openId, data.openId)).limit(1)

      let userId: number
      let role: Role

      if (existing) {
        userId = existing.id
        role = existing.role as Role
        await db
          .update(users)
          .set({ email: data.email, nome: data.name, updatedAt: new Date() })
          .where(eq(users.id, existing.id))
      } else {
        const isOwner = data.openId === env.OWNER_OPEN_ID
        role = isOwner ? 'admin' : 'secretaria'
        const [result] = await db.insert(users).values({
          openId: data.openId,
          email: data.email,
          nome: data.name,
          role,
        })
        userId = (result as { insertId: number }).insertId
      }

      const secret = new TextEncoder().encode(env.JWT_SECRET)
      const token = await new SignJWT({ type: 'staff', userId })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(data.openId)
        .setIssuedAt()
        .setExpirationTime(JWT_EXPIRY_STAFF)
        .sign(secret)

      return { token, role }
    }),

  me: protectedProcedure.query(({ ctx }) => {
    return ctx.session
  }),

  logout: protectedProcedure.mutation(() => {
    return { ok: true }
  }),
})
