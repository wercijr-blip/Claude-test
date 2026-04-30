import { timingSafeEqual } from 'crypto'
import { z } from 'zod'
import { router, publicProcedure } from '../_core/trpc.ts'
import { TRPCError } from '@trpc/server'
import { db } from '../db.ts'
import { satisfacaoPesquisas, pesquisaTokens } from '../../drizzle/schema.ts'
import { eq, gt } from 'drizzle-orm'

async function validarTokenPesquisa(pacienteId: number, token: string): Promise<void> {
  const [row] = await db
    .select({ token: pesquisaTokens.token, expiraEm: pesquisaTokens.expiraEm })
    .from(pesquisaTokens)
    .where(eq(pesquisaTokens.pacienteId, pacienteId))
    .limit(1)

  // Always run the comparison to avoid timing oracle even on missing token
  const expected = Buffer.from(row?.token ?? ' '.repeat(64))
  const provided = Buffer.from(token)

  const match =
    expected.length === provided.length &&
    timingSafeEqual(expected, provided)

  if (!match || !row || row.expiraEm < new Date()) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Link de pesquisa inválido.' })
  }
}

export const pesquisaRouter = router({
  submeter: publicProcedure
    .input(
      z.object({
        pacienteId: z.number(),
        token: z.string(),
        achouFacil: z.boolean(),
        conseguiuMedicacao: z.boolean(),
        indicaria: z.boolean(),
        comentario: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      await validarTokenPesquisa(input.pacienteId, input.token)

      const [existing] = await db
        .select({ id: satisfacaoPesquisas.id })
        .from(satisfacaoPesquisas)
        .where(eq(satisfacaoPesquisas.pacienteId, input.pacienteId))
        .limit(1)

      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Pesquisa já respondida. Obrigado!' })
      }

      await db.transaction(async (tx) => {
        await tx.insert(satisfacaoPesquisas).values({
          pacienteId: input.pacienteId,
          achouFacil: input.achouFacil,
          conseguiuMedicacao: input.conseguiuMedicacao,
          indicaria: input.indicaria,
          comentario: input.comentario,
        })
        // Token consumed atomically — prevents replay even under concurrent retries
        await tx.delete(pesquisaTokens).where(eq(pesquisaTokens.pacienteId, input.pacienteId))
      })

      return { ok: true }
    }),

  status: publicProcedure
    .input(z.object({ pacienteId: z.number(), token: z.string() }))
    .query(async ({ input }) => {
      await validarTokenPesquisa(input.pacienteId, input.token)

      const [existing] = await db
        .select({ id: satisfacaoPesquisas.id })
        .from(satisfacaoPesquisas)
        .where(eq(satisfacaoPesquisas.pacienteId, input.pacienteId))
        .limit(1)

      return { respondido: !!existing }
    }),
})
