import { z } from 'zod'
import { router, medicoProcedure } from '../_core/trpc.ts'
import { TRPCError } from '@trpc/server'
import { db } from '../db.ts'
import { pacientes, exames } from '../../drizzle/schema.ts'
import { eq, inArray } from 'drizzle-orm'
import { decrypt } from '../_core/encryption.ts'

export const medicoRouter = router({
  // Listar pacientes pendentes de revisão
  listarPendentes: medicoProcedure.query(async () => {
    const rows = await db
      .select()
      .from(pacientes)
      .where(inArray(pacientes.status, ['pendente', 'em_revisao']))
      .orderBy(pacientes.createdAt)

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
        email: p.emailEncrypted ? decrypt(p.emailEncrypted) : null,
        telefone: p.telefoneEncrypted ? decrypt(p.telefoneEncrypted) : null,
        cpfEncrypted: undefined,
        nomeEncrypted: undefined,
        dataNascimentoEncrypted: undefined,
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

      await db
        .update(pacientes)
        .set({
          status: 'aprovado',
          medicoId: ctx.session.id,
          observacoesMedico: input.observacoes,
          updatedAt: new Date(),
        })
        .where(eq(pacientes.id, input.pacienteId))

      return { ok: true }
    }),

  // Rejeitar paciente
  rejeitar: medicoProcedure
    .input(z.object({ pacienteId: z.number(), motivo: z.string().min(10) }))
    .mutation(async ({ input, ctx }) => {
      const [p] = await db.select().from(pacientes).where(eq(pacientes.id, input.pacienteId)).limit(1)
      if (!p) throw new TRPCError({ code: 'NOT_FOUND' })

      await db
        .update(pacientes)
        .set({
          status: 'rejeitado',
          medicoId: ctx.session.id,
          observacoesMedico: input.motivo,
          updatedAt: new Date(),
        })
        .where(eq(pacientes.id, input.pacienteId))

      return { ok: true }
    }),
})
