import { z } from 'zod'
import { router, medicoProcedure } from '../_core/trpc.ts'
import { TRPCError } from '@trpc/server'
import { db } from '../db.ts'
import { pacientes, exames } from '../../drizzle/schema.ts'
import { eq, inArray, and, gt, sql } from 'drizzle-orm'
import { decrypt } from '../_core/encryption.ts'
import { okEmpty } from '../_core/response.ts'
import { paginationInput, paginatedResponse } from '../_core/pagination.ts'
import type { ResultadoIa } from '../../shared/types.ts'

export const medicoRouter = router({
  // Listar pacientes pendentes de revisão
  listarPendentes: medicoProcedure
    .input(paginationInput)
    .query(async ({ input }) => {
      const { limit, cursor } = input
      const rows = await db
        .select()
        .from(pacientes)
        .where(
          cursor
            ? and(inArray(pacientes.status, ['pendente', 'em_revisao']), gt(pacientes.id, cursor))
            : inArray(pacientes.status, ['pendente', 'em_revisao']),
        )
        .orderBy(pacientes.id)
        .limit(limit + 1)

      const mapped = rows.map((p) => ({
        id: p.id,
        nome: decrypt(p.nomeEncrypted),
        status: p.status,
        currentStep: p.currentStep,
        tipoAtendimento: p.tipoAtendimento,
        createdAt: p.createdAt,
      }))

      return paginatedResponse(mapped, limit)
    }),

  // Ver detalhe de um paciente
  verPaciente: medicoProcedure
    .input(z.object({ pacienteId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const [p] = await db
        .select()
        .from(pacientes)
        .where(eq(pacientes.id, input.pacienteId))
        .limit(1)

      if (!p) throw new TRPCError({ code: 'NOT_FOUND' })

      // Only claim 'em_revisao' if still 'pendente' — avoids overwriting another doctor's lock
      await db
        .update(pacientes)
        .set({ status: 'em_revisao', medicoId: ctx.session.id, updatedAt: new Date() })
        .where(and(eq(pacientes.id, input.pacienteId), inArray(pacientes.status, ['pendente'])))

      // Re-fetch after lock attempt so the response always reflects current DB state
      // (if another doctor already held the lock, status/medicoId will show that)
      const [pAtual] = await db
        .select()
        .from(pacientes)
        .where(eq(pacientes.id, input.pacienteId))
        .limit(1)

      if (!pAtual) throw new TRPCError({ code: 'NOT_FOUND' })

      const examesDoP = await db
        .select()
        .from(exames)
        .where(eq(exames.pacienteId, input.pacienteId))

      return {
        ...pAtual,
        nome: decrypt(pAtual.nomeEncrypted),
        cpf: decrypt(pAtual.cpfEncrypted),
        dataNascimento: pAtual.dataNascimentoEncrypted ? decrypt(pAtual.dataNascimentoEncrypted) : null,
        nomeMae: pAtual.nomeMaeEncrypted ? decrypt(pAtual.nomeMaeEncrypted) : null,
        email: pAtual.emailEncrypted ? decrypt(pAtual.emailEncrypted) : null,
        telefone: pAtual.telefoneEncrypted ? decrypt(pAtual.telefoneEncrypted) : null,
        cpfEncrypted: undefined,
        nomeEncrypted: undefined,
        dataNascimentoEncrypted: undefined,
        nomeMaeEncrypted: undefined,
        emailEncrypted: undefined,
        telefoneEncrypted: undefined,
        exames: examesDoP,
      }
    }),

  // Aprovar paciente
  aprovar: medicoProcedure
    .input(z.object({ pacienteId: z.number(), observacoes: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      await db.transaction(async (tx) => {
        const [p] = await tx.select().from(pacientes).where(eq(pacientes.id, input.pacienteId)).limit(1)
        if (!p) throw new TRPCError({ code: 'NOT_FOUND' })
        if (p.medicoId !== null && p.medicoId !== ctx.session.id && ctx.session.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Paciente em revisão por outro médico.' })
        }

        await tx
          .update(pacientes)
          .set({
            status: 'aprovado',
            medicoId: ctx.session.id,
            observacoesMedico: input.observacoes,
            updatedAt: new Date(),
          })
          .where(and(eq(pacientes.id, input.pacienteId), inArray(pacientes.status, ['pendente', 'em_revisao'])))
      })

      return okEmpty()
    }),

  // Rejeitar paciente
  rejeitar: medicoProcedure
    .input(z.object({ pacienteId: z.number(), motivo: z.string().min(10) }))
    .mutation(async ({ input, ctx }) => {
      await db.transaction(async (tx) => {
        const [p] = await tx.select().from(pacientes).where(eq(pacientes.id, input.pacienteId)).limit(1)
        if (!p) throw new TRPCError({ code: 'NOT_FOUND' })
        if (p.medicoId !== null && p.medicoId !== ctx.session.id && ctx.session.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Paciente em revisão por outro médico.' })
        }

        await tx
          .update(pacientes)
          .set({
            status: 'rejeitado',
            medicoId: ctx.session.id,
            observacoesMedico: input.motivo,
            updatedAt: new Date(),
          })
          .where(and(eq(pacientes.id, input.pacienteId), inArray(pacientes.status, ['pendente', 'em_revisao'])))
      })

      return okEmpty()
    }),

  // Listar exames com rejeição de IA — filtra diretamente no SQL, sem carregar 200 linhas em memória
  listarExamesRejeitadosIa: medicoProcedure.query(async () => {
    return db
      .select({
        id: exames.id,
        pacienteId: exames.pacienteId,
        nomeArquivo: exames.nomeArquivo,
        tipoExame: exames.tipoExame,
        resultadoIa: exames.resultadoIa,
        liberadoPorMedicoId: exames.liberadoPorMedicoId,
        liberadoEm: exames.liberadoEm,
        createdAt: exames.createdAt,
      })
      .from(exames)
      .where(
        sql`JSON_UNQUOTE(JSON_EXTRACT(resultado_ia, '$.status')) IN ('rejeitado_ia', 'rejeitado', 'pendente_revisao')`
      )
      .orderBy(exames.createdAt)
      .limit(200)
  }),

  // Liberar exame que foi rejeitado pela IA (aprovação manual pelo médico)
  liberarExameSemValidacao: medicoProcedure
    .input(z.object({
      exameId: z.number(),
      observacoes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const [exame] = await db.select().from(exames).where(eq(exames.id, input.exameId)).limit(1)
      if (!exame) throw new TRPCError({ code: 'NOT_FOUND', message: 'Exame não encontrado.' })

      const resultadoAtual = exame.resultadoIa as ResultadoIa | null
      if (
        resultadoAtual?.status !== 'rejeitado_ia' &&
        resultadoAtual?.status !== 'rejeitado' &&
        resultadoAtual?.status !== 'pendente_revisao'
      ) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Apenas exames rejeitados pela IA podem ser liberados manualmente.',
        })
      }

      const novoResultado: ResultadoIa = {
        ...resultadoAtual,
        status: 'liberado_manualmente',
        observacoesMedico: input.observacoes ?? null,
        liberadoEm: new Date().toISOString(),
      }

      await db
        .update(exames)
        .set({
          resultadoIa: novoResultado,
          liberadoPorMedicoId: ctx.session.id,
          liberadoEm: new Date(),
          revisadoPorId: ctx.session.id,
          revisadoEm: new Date(),
        })
        .where(eq(exames.id, input.exameId))

      return okEmpty()
    }),
})
