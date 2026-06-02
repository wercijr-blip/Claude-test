import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { generateSecret, generateURI, verifySync } from 'otplib'
import qrcode from 'qrcode'
import { SignJWT, jwtVerify } from 'jose'
import { createHash, randomBytes } from 'crypto'
import { router, staffProcedure, publicProcedure } from '../_core/trpc.ts'
import { env } from '../_core/env.ts'
import { db } from '../db.ts'
import { users } from '../../drizzle/schema.ts'
import { eq, isNull, and } from 'drizzle-orm'
import { encrypt, decrypt } from '../_core/encryption.ts'
import { logAudit } from '../_core/audit.ts'
import { JWT_EXPIRY_STAFF } from '../../shared/security-constants.ts'
import type { Role } from '../../shared/types.ts'

const APP_NAME = 'Facilita PrEP'
const BACKUP_CODE_COUNT = 8

function hashBackupCode(code: string): string {
  return createHash('sha256').update(code + env.JWT_SECRET).digest('hex')
}

function generateBackupCodes(): { plain: string[]; hashed: string[] } {
  const plain = Array.from({ length: BACKUP_CODE_COUNT }, () => {
    const hex = randomBytes(4).toString('hex').toUpperCase()
    return `${hex.slice(0, 4)}-${hex.slice(4)}`
  })
  const hashed = plain.map(hashBackupCode)
  return { plain, hashed }
}

export const twoFactorRouter = router({
  // Gera novo segredo TOTP e retorna QR code (sem habilitar ainda)
  setup: staffProcedure.mutation(async ({ ctx }) => {
    const session = ctx.session
    if (!['admin', 'medico'].includes(session.role)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: '2FA disponível apenas para admin e médico' })
    }

    const secret = generateSecret()
    const otpAuthUri = generateURI({
      issuer: APP_NAME,
      label: session.email ?? session.openId,
      secret,
    })
    const qrDataUrl = await qrcode.toDataURL(otpAuthUri)
    const encryptedSecret = encrypt(secret)

    await db.update(users)
      .set({ totpSecretEncrypted: encryptedSecret, totpEnabled: false, updatedAt: new Date() })
      .where(eq(users.id, session.id))

    await logAudit({
      actorId: session.id,
      actorRole: session.role,
      action: 'user.2fa_setup',
      resourceType: 'user',
      resourceId: session.id,
      ipAddress: ctx.req.ip,
      userAgent: ctx.req.headers['user-agent'],
    })

    return { qrDataUrl, secret }
  }),

  // Valida código TOTP e habilita 2FA, devolvendo backup codes
  confirm: staffProcedure
    .input(z.object({ code: z.string().length(6) }))
    .mutation(async ({ ctx, input }) => {
      const session = ctx.session
      const [user] = await db.select().from(users).where(eq(users.id, session.id)).limit(1)
      if (!user?.totpSecretEncrypted) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Configure o 2FA primeiro (chame twoFactor.setup)' })
      }

      const totpSecret = decrypt(user.totpSecretEncrypted)
      const result = verifySync({ token: input.code, secret: totpSecret })
      if (!result.valid) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Código TOTP inválido' })
      }

      const { plain, hashed } = generateBackupCodes()

      await db.update(users)
        .set({ totpEnabled: true, totpBackupCodes: hashed, updatedAt: new Date() })
        .where(eq(users.id, session.id))

      await logAudit({
        actorId: session.id,
        actorRole: session.role,
        action: 'user.2fa_verify',
        resourceType: 'user',
        resourceId: session.id,
        ipAddress: ctx.req.ip,
        userAgent: ctx.req.headers['user-agent'],
      })

      return { backupCodes: plain }
    }),

  // Troca pending_2fa token + código TOTP por JWT completo
  verify: publicProcedure
    .input(z.object({ pendingToken: z.string(), code: z.string().min(6).max(9) }))
    .mutation(async ({ ctx, input }) => {
      const jwtKey = new TextEncoder().encode(env.JWT_SECRET)

      let pendingPayload: { userId?: unknown; type?: unknown }
      try {
        const result = await jwtVerify(input.pendingToken, jwtKey)
        pendingPayload = result.payload as typeof pendingPayload
      } catch {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Token inválido ou expirado' })
      }

      if (pendingPayload.type !== 'pending_2fa' || typeof pendingPayload.userId !== 'number') {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Token não é de 2FA pendente' })
      }

      const [user] = await db.select().from(users)
        .where(and(eq(users.id, pendingPayload.userId), isNull(users.deletedAt))).limit(1)
      if (!user || !user.ativo || !user.totpEnabled || !user.totpSecretEncrypted) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Usuário inválido' })
      }

      const isBackup = input.code.includes('-')
      let isValid: boolean

      if (isBackup) {
        isValid = await consumeBackupCode(user, input.code)
      } else {
        const totpSecret = decrypt(user.totpSecretEncrypted)
        isValid = verifySync({ token: input.code, secret: totpSecret }).valid
      }

      if (!isValid) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Código 2FA inválido' })
      }

      const token = await new SignJWT({ type: 'staff', userId: user.id, role: user.role })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(user.openId)
        .setIssuedAt()
        .setExpirationTime(JWT_EXPIRY_STAFF)
        .sign(jwtKey)

      await logAudit({
        actorId: user.id,
        actorRole: user.role,
        action: 'user.2fa_verify',
        resourceType: 'user',
        resourceId: user.id,
        ipAddress: ctx.req.ip,
        userAgent: ctx.req.headers['user-agent'],
      })

      return { token, role: user.role as Role }
    }),

  // Desabilita 2FA (admin pode desabilitar de qualquer usuário)
  disable: staffProcedure
    .input(z.object({ targetUserId: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      const session = ctx.session
      const targetId = input.targetUserId ?? session.id

      if (targetId !== session.id && session.role !== 'admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas admins podem desabilitar 2FA de outro usuário' })
      }

      await db.update(users)
        .set({ totpEnabled: false, totpSecretEncrypted: null, totpBackupCodes: null, updatedAt: new Date() })
        .where(eq(users.id, targetId))

      await logAudit({
        actorId: session.id,
        actorRole: session.role,
        action: 'user.2fa_disabled',
        resourceType: 'user',
        resourceId: targetId,
        ipAddress: ctx.req.ip,
        userAgent: ctx.req.headers['user-agent'],
      })

      return { ok: true }
    }),

  // Estado atual do 2FA para o usuário autenticado
  status: staffProcedure.query(async ({ ctx }) => {
    const [user] = await db
      .select({ totpEnabled: users.totpEnabled })
      .from(users)
      .where(eq(users.id, ctx.session.id))
      .limit(1)

    return { enabled: user?.totpEnabled ?? false }
  }),
})

async function consumeBackupCode(
  user: { id: number; totpBackupCodes: unknown },
  code: string,
): Promise<boolean> {
  const codes = Array.isArray(user.totpBackupCodes) ? (user.totpBackupCodes as string[]) : []
  const hashed = hashBackupCode(code.toUpperCase())
  const idx = codes.indexOf(hashed)
  if (idx === -1) return false

  const remaining = codes.filter((_, i) => i !== idx)
  await db.update(users)
    .set({ totpBackupCodes: remaining, updatedAt: new Date() })
    .where(eq(users.id, user.id))

  return true
}
