import { createHash } from 'crypto'
import { z } from 'zod'
import { router, publicProcedure } from '../_core/trpc.ts'
import { TRPCError } from '@trpc/server'
import { db } from '../db.ts'
import { satisfacaoPesquisas } from '../../drizzle/schema.ts'
import { eq } from 'drizzle-orm'
import { env } from '../_core/env.ts'

export function gerarTokenPesquisa(pacienteId: number): string {
  return createHash('sha256').update(`pesquisa:${pacienteId}:${env.JWT_SECRET}`).digest('hex')
}

export const pesquisaRouter = router({
  submeter: publicProcedure
    .input(
      z.object({
        pacienteId: z.number(),
        token: z.string(),
        achouFacil: z.boolean(),
        conseguiuMedicacao: z.boolean(),
        comentario: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const esperado = gerarTokenPesquisa(input.pacienteId)
      if (input.token !== esperado) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Link de pesquisa inválido.' })
      }

      const [existing] = await db
        .select({ id: satisfacaoPesquisas.id })
        .from(satisfacaoPesquisas)
        .where(eq(satisfacaoPesquisas.pacienteId, input.pacienteId))
        .limit(1)

      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Pesquisa já respondida. Obrigado!' })
      }

      await db.insert(satisfacaoPesquisas).values({
        pacienteId: input.pacienteId,
        achouFacil: input.achouFacil,
        conseguiuMedicacao: input.conseguiuMedicacao,
        comentario: input.comentario,
      })

      return { ok: true }
    }),

  status: publicProcedure
    .input(z.object({ pacienteId: z.number(), token: z.string() }))
    .query(async ({ input }) => {
      const esperado = gerarTokenPesquisa(input.pacienteId)
      if (input.token !== esperado) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Link de pesquisa inválido.' })
      }

      const [existing] = await db
        .select({ id: satisfacaoPesquisas.id })
        .from(satisfacaoPesquisas)
        .where(eq(satisfacaoPesquisas.pacienteId, input.pacienteId))
        .limit(1)

      return { respondido: !!existing }
    }),
})
