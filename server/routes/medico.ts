import { z } from 'zod'
import { router, medicoProcedure } from '../_core/trpc.ts'
import { TRPCError } from '@trpc/server'
import { db } from '../db.ts'
import { pacientes, exames } from '../../drizzle/schema.ts'
import { eq, inArray } from 'drizzle-orm'
import { decrypt } from '../_core/encryption.ts'
import { isExameRejeitadoIa } from '../examUtils.ts'
import { okEmpty } from '../_core/response.ts'

type ResultadoIaJson = {
  status?: string
  [key: string]: unknown
}

export const medicoRouter = router({
  // Listar pacientes pendentes de revisão
  listarPendentes: medicoProcedure.query(async () => {
    const rows = await db
      .select()
      .from(pacientes)
      .where(inArray(pacientes.status, ['pendente', 'em_revisao']))
      .orderBy(pacientes.createdAt)
      .limit(500)

    return rows.map((p) => ({
      id: p.id,
      nome: decrypt(p.nomeEncrypted),
      status: p.status,
      currentStep: p.currentStep,
      tipoAtendimento: p.tipoAtendimento,
      createdAt: p.createdAt,
    }))
  }),

  // Ver detalhe de um paciente
  verPaciente: medicoProcedure
    .input(z.object({ pacienteId: z.number() }))
    .query(async ({ input, ctx }) => {
      const [p] = await db
        .select()
        .from(pacientes)
        .where(eq(pacientes.id, input.pacienteId))
        .limit(1)

      if (!p) throw new TRPCError({ code: 'NOT_FOUND' })

      await db
        .update(pacientes)
        .set({ status: 'em_revisao', medicoId: ctx.session.id, updatedAt: new Date() })
        .where(eq(pacientes.id, input.pacienteId))

      const examesDoP = await db
        .select()
        .from(exames)
        .where(eq(exames.pacienteId, input.pacienteId))

      return {
        ...p,
        nome: decrypt(p.nomeEncrypted),
        cpf: decrypt(p.cpfEncrypted),
        dataNascimento: p.dataNascimentoEncrypted ? decrypt(p.dataNascimentoEncrypted) : null,
        nomeMae: p.nomeMaeEncrypted ? decrypt(p.nomeMaeEncrypted) : null,
        email: p.emailEncrypted ? decrypt(p.emailEncrypted) : null,
        telefone: p.telefoneEncrypted ? decrypt(p.telefoneEncrypted) : null,
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
      const [p] = await db.select().from(pacientes).where(eq(pacientes.id, input.pacienteId)).limit(1)
      if (!p) throw new TRPCError({ code: 'NOT_FOUND' })
      if (p.medicoId !== null && p.medicoId !== ctx.session.id && ctx.session.role !== 'admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Paciente em revisão por outro médico.' })
      }

      await db
        .update(pacientes)
        .set({
          status: 'aprovado',
          medicoId: ctx.session.id,
          observacoesMedico: input.observacoes,
          updatedAt: new Date(),
        })
        .where(eq(pacientes.id, input.pacienteId))

      return okEmpty()
    }),

  // Rejeitar paciente
  rejeitar: medicoProcedure
    .input(z.object({ pacienteId: z.number(), motivo: z.string().min(10) }))
    .mutation(async ({ input, ctx }) => {
      const [p] = await db.select().from(pacientes).where(eq(pacientes.id, input.pacienteId)).limit(1)
      if (!p) throw new TRPCError({ code: 'NOT_FOUND' })
      if (p.medicoId !== null && p.medicoId !== ctx.session.id && ctx.session.role !== 'admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Paciente em revisão por outro médico.' })
      }

      await db
        .update(pacientes)
        .set({
          status: 'rejeitado',
          medicoId: ctx.session.id,
          observacoesMedico: input.motivo,
          updatedAt: new Date(),
        })
        .where(eq(pacientes.id, input.pacienteId))

      return okEmpty()
    }),

  // Listar exames com rejeição de IA (status rejeitado_ia no resultadoIa)
  listarExamesRejeitadosIa: medicoProcedure.query(async () => {
    const rows = await db.select().from(exames).orderBy(exames.createdAt)
    return rows.filter((e) => isExameRejeitadoIa(e.resultadoIa as ResultadoIaJson | null)).map((e) => ({
      id: e.id,
      pacienteId: e.pacienteId,
      nomeArquivo: e.nomeArquivo,
      tipoExame: e.tipoExame,
      resultadoIa: e.resultadoIa,
      liberadoPorMedicoId: e.liberadoPorMedicoId,
      liberadoEm: e.liberadoEm,
      createdAt: e.createdAt,
    }))
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

      const resultadoAtual = exame.resultadoIa as ResultadoIaJson | null
      if (
        resultadoAtual?.status !== 'rejeitado_ia' &&
        resultadoAtual?.status !== 'rejeitado'
      ) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Apenas exames rejeitados pela IA podem ser liberados manualmente.',
        })
      }

      const novoResultado: ResultadoIaJson = {
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
