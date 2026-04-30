import { z } from 'zod'
import { randomBytes } from 'crypto'
import { createHash } from 'crypto'
import { SignJWT } from 'jose'
import { router, publicProcedure, staffProcedure } from '../_core/trpc.ts'
import { TRPCError } from '@trpc/server'
import { db } from '../db.ts'
import { accessTokens, pacientes } from '../../drizzle/schema.ts'
import { eq, and, gt, isNull } from 'drizzle-orm'
import { env } from '../_core/env.ts'
import { JWT_EXPIRY_PATIENT, TOKEN_EXPIRY_DAYS } from '../../shared/security-constants.ts'
import { ERROR_MESSAGES } from '../../shared/const.ts'

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

export const tokenRouter = router({
  // Secretaria gera token para paciente
  criar: staffProcedure
    .input(
      z.object({
        patientEmail: z.string().email().optional(),
        tipo: z.enum(['privado', 'convenio']).default('privado'),
        convenio: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const raw = randomBytes(32).toString('hex')
      const hash = hashToken(raw)

      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + TOKEN_EXPIRY_DAYS)

      await db.insert(accessTokens).values({
        tokenHash: hash,
        patientEmail: input.patientEmail,
        tipo: input.tipo,
        convenio: input.convenio,
        expiresAt,
        createdById: ctx.session.id,
      })

      return { token: raw, expiresAt }
    }),

  // Paciente valida o token e recebe JWT de sessão
  validar: publicProcedure
    .input(z.object({ token: z.string().length(64) }))
    .mutation(async ({ input }) => {
      const hash = hashToken(input.token)

      const [record] = await db
        .select()
        .from(accessTokens)
        .where(
          and(
            eq(accessTokens.tokenHash, hash),
            isNull(accessTokens.revokedAt),
            gt(accessTokens.expiresAt, new Date()),
          ),
        )
        .limit(1)

      if (!record) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: ERROR_MESSAGES.TOKEN_INVALID })
      }

      // Buscar paciente existente para esse token
      const [existingPaciente] = await db
        .select({ id: pacientes.id, currentStep: pacientes.currentStep })
        .from(pacientes)
        .where(eq(pacientes.tokenId, record.id))
        .limit(1)

      // Marcar token como usado na primeira vez — UPDATE atômico evita double-write em requests paralelos
      await db
        .update(accessTokens)
        .set({ usedAt: new Date() })
        .where(and(eq(accessTokens.id, record.id), isNull(accessTokens.usedAt)))

      const secret = new TextEncoder().encode(env.JWT_SECRET)
      const sessionToken = await new SignJWT({
        type: 'patient',
        tokenId: record.id,
        pacienteId: existingPaciente?.id ?? null,
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(JWT_EXPIRY_PATIENT)
        .sign(secret)

      return {
        sessionToken,
        pacienteId: existingPaciente?.id ?? null,
        currentStep: existingPaciente?.currentStep ?? 1,
      }
    }),

  // Secretaria lista tokens gerados
  listar: staffProcedure.query(async ({ ctx }) => {
    return db
      .select()
      .from(accessTokens)
      .where(eq(accessTokens.createdById, ctx.session.id))
      .orderBy(accessTokens.createdAt)
  }),

  // Secretaria revoga token
  revogar: staffProcedure
    .input(z.object({ tokenId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const [token] = await db
        .select()
        .from(accessTokens)
        .where(
          and(eq(accessTokens.id, input.tokenId), eq(accessTokens.createdById, ctx.session.id)),
        )
        .limit(1)

      if (!token) throw new TRPCError({ code: 'NOT_FOUND' })

      await db
        .update(accessTokens)
        .set({ revokedAt: new Date() })
        .where(eq(accessTokens.id, input.tokenId))

      return { ok: true }
    }),
})
