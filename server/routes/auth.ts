import { z } from 'zod'
import { SignJWT } from 'jose'
import { TRPCError } from '@trpc/server'
import { router, publicProcedure, protectedProcedure } from '../_core/trpc.ts'
import { env } from '../_core/env.ts'
import { Sentry } from '../_core/instrument.ts'
import { logger } from '../_core/logger.ts'
import { db } from '../db.ts'
import { users } from '../../drizzle/schema.ts'
import { eq } from 'drizzle-orm'
import { JWT_EXPIRY_STAFF } from '../../shared/security-constants.ts'
import { isAllowedRedirectUri } from '../_core/originValidator.ts'
import type { Role } from '../../shared/types.ts'
import type { ResultSetHeader } from 'mysql2'

export const authRouter = router({
  // Callback OAuth — troca code por JWT interno
  callback: publicProcedure
    .input(z.object({ code: z.string(), state: z.string().optional(), redirectUri: z.string().url().optional() }))
    .mutation(async ({ input }) => {
      logger.info('[auth.callback] iniciado', {
        hasCode: !!input.code,
        codeLength: input.code?.length,
        hasRedirectUri: !!input.redirectUri,
        redirectUri: input.redirectUri,
        appUrl: env.APP_URL,
        googleClientIdSet: !!env.GOOGLE_CLIENT_ID,
        googleClientSecretSet: !!env.GOOGLE_CLIENT_SECRET,
      })

      try {
      // Usa o redirectUri enviado pelo cliente (mesmo que Google usou no início do fluxo).
      // Valida contra origens permitidas para evitar open redirect.
      const redirectUri = (input.redirectUri && isAllowedRedirectUri(input.redirectUri))
        ? input.redirectUri
        : `${env.APP_URL}/auth/callback`

      logger.info('[auth.callback] redirectUri resolvido', { redirectUri, validated: input.redirectUri === redirectUri })

      const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: input.code,
          client_id: env.GOOGLE_CLIENT_ID,
          client_secret: env.GOOGLE_CLIENT_SECRET,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
        signal: AbortSignal.timeout(10000),
      })

      if (!tokenResp.ok) {
        const errBody = await tokenResp.json().catch(() => ({ error: 'unknown', error_description: '' })) as { error?: string; error_description?: string }
        const googleError = errBody.error ?? 'unknown_error'
        const description = errBody.error_description ?? ''
        logger.error('[auth.callback] falha token exchange', { status: tokenResp.status, googleError, description })
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: `Google OAuth: ${googleError}${description ? ` — ${description}` : ''}`,
        })
      }

      const tokenData = (await tokenResp.json()) as { access_token: string }

      // Buscar dados do usuário com o access_token
      const userResp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
        signal: AbortSignal.timeout(10000),
      })

      if (!userResp.ok) {
        logger.error('[auth.callback] falha userinfo', { status: userResp.status })
        throw new TRPCError({ code: 'UNAUTHORIZED', message: `Google userinfo falhou (${userResp.status})` })
      }

      const googleUser = (await userResp.json()) as {
        sub: string
        email: string
        name: string
        picture?: string
      }

      const data = {
        openId: googleUser.sub,
        email: googleUser.email,
        name: googleUser.name,
      }

      // Upsert do usuário
      const [existing] = await db.select().from(users).where(eq(users.openId, data.openId)).limit(1)

      let userId: number
      let role: Role

      if (existing) {
        userId = existing.id
        const isOwner = data.openId === env.OWNER_OPEN_ID
        role = isOwner ? 'admin' : existing.role as Role
        await db
          .update(users)
          .set({ email: data.email, nome: data.name, role, updatedAt: new Date() })
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
        userId = (result as ResultSetHeader).insertId
      }

      // Fetch full user record to check 2FA status
      const [freshUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
      const requires2fa = freshUser?.totpEnabled && ['admin', 'medico'].includes(role)

      const secret = new TextEncoder().encode(env.JWT_SECRET)

      if (requires2fa) {
        // Issue a short-lived pending token — frontend must complete TOTP verification
        const pendingToken = await new SignJWT({ type: 'pending_2fa', userId, role })
          .setProtectedHeader({ alg: 'HS256' })
          .setSubject(data.openId)
          .setIssuedAt()
          .setExpirationTime('5m')
          .sign(secret)
        return { token: pendingToken, role, requiresTwoFactor: true }
      }

      const token = await new SignJWT({ type: 'staff', userId, role })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(data.openId)
        .setIssuedAt()
        .setExpirationTime(JWT_EXPIRY_STAFF)
        .sign(secret)

      logger.info('[auth.callback] sucesso', { userId, role, openId: data.openId, requires2fa })
      return { token, role, requiresTwoFactor: false }

      } catch (err) {
        logger.error('[auth.callback] erro', {
          message: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
          codeLength: input.code?.length,
          redirectUri: input.redirectUri,
        })
        Sentry.captureException(err, {
          tags: { route: 'auth.callback' },
          extra: { codeLength: input.code?.length, redirectUri: input.redirectUri },
        })
        throw err
      }
    }),

  // Login mock para desenvolvimento local. Responde NOT_FOUND em produção
  // para ser indistinguível de um endpoint inexistente.
  devLogin: publicProcedure
    .input(z.object({ role: z.enum(['admin', 'medico', 'secretaria']) }))
    .mutation(async ({ input }) => {
      if (env.NODE_ENV !== 'development') {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }

      const openId = `dev-${input.role}`
      const email = `${input.role}@dev.local`
      const nome = `Dev ${input.role.charAt(0).toUpperCase()}${input.role.slice(1)}`

      const [existing] = await db.select().from(users).where(eq(users.openId, openId)).limit(1)

      let userId: number
      if (existing) {
        userId = existing.id
        await db.update(users)
          .set({ role: input.role, email, nome, updatedAt: new Date() })
          .where(eq(users.id, existing.id))
      } else {
        const [result] = await db.insert(users).values({ openId, email, nome, role: input.role })
        userId = (result as ResultSetHeader).insertId
      }

      const secret = new TextEncoder().encode(env.JWT_SECRET)
      const token = await new SignJWT({ type: 'staff', userId, role: input.role })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(openId)
        .setIssuedAt()
        .setExpirationTime(JWT_EXPIRY_STAFF)
        .sign(secret)

      return { token, role: input.role }
    }),

  me: protectedProcedure.query(({ ctx }) => {
    return ctx.session
  }),

  logout: protectedProcedure.mutation(() => {
    return { ok: true }
  }),
})
