import { z } from 'zod'
import { router, protectedProcedure } from '../_core/trpc.ts'
import { TRPCError } from '@trpc/server'
import { db } from '../db.ts'
import { pacientes } from '../../drizzle/schema.ts'
import { eq, and } from 'drizzle-orm'
import { encrypt, decrypt, hashCpf } from '../_core/encryption.ts'
import { validarCpf } from '../_core/cpfValidator.ts'
import { ERROR_MESSAGES } from '@shared/const.ts'

function assertPatient(session: unknown): asserts session is { type: 'patient'; tokenId: number; pacienteId: number | null } {
  if (!session || (session as { type: string }).type !== 'patient') {
    throw new TRPCError({ code: 'FORBIDDEN' })
  }
}

const condutaSchema = z.object({
  relacoesSexuais: z.object({
    tipos: z.array(z.enum(['vaginal', 'anal_receptivo', 'anal_insertivo', 'oral'])),
    frequencia: z.enum(['diaria', 'semanal', 'mensal', 'esporadica']),
    parceirosUltimos6Meses: z.number().min(0),
    usaPreservativo: z.enum(['sempre', 'quase_sempre', 'as_vezes', 'nunca']),
  }),
  historicoDst: z.boolean(),
  dstDescricao: z.string().optional(),
  prepAnterior: z.boolean(),
  prepPeriodo: z.string().optional(),
  usoDrogas: z.boolean(),
  drogasDescricao: z.string().optional(),
  outrasInformacoes: z.string().optional(),
})

export const pacienteRouter = router({
  // Step 1 — Dados Pessoais
  salvarStep1: protectedProcedure
    .input(
      z.object({
        cpf: z.string().refine(validarCpf, ERROR_MESSAGES.CPF_INVALID),
        nome: z.string().min(3),
        dataNascimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        sexo: z.enum(['masculino', 'feminino', 'outro']),
        nomeSocial: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      assertPatient(ctx.session)
      const { tokenId } = ctx.session
      const cpfHash = hashCpf(input.cpf)

      const retentionUntil = new Date()
      retentionUntil.setFullYear(retentionUntil.getFullYear() + 20)

      if (ctx.session.pacienteId) {
        await db
          .update(pacientes)
          .set({
            cpfEncrypted: encrypt(input.cpf),
            cpfHash,
            nomeEncrypted: encrypt(input.nome),
            dataNascimentoEncrypted: encrypt(input.dataNascimento),
            sexo: input.sexo,
            nomeSocial: input.nomeSocial,
            currentStep: 2,
            updatedAt: new Date(),
          })
          .where(eq(pacientes.id, ctx.session.pacienteId))
        return { pacienteId: ctx.session.pacienteId }
      }

      const [result] = await db.insert(pacientes).values({
        tokenId,
        cpfEncrypted: encrypt(input.cpf),
        cpfHash,
        nomeEncrypted: encrypt(input.nome),
        dataNascimentoEncrypted: encrypt(input.dataNascimento),
        sexo: input.sexo,
        nomeSocial: input.nomeSocial,
        currentStep: 2,
        retentionUntil,
      })
      return { pacienteId: (result as { insertId: number }).insertId }
    }),

  // Step 2 — Demográfico
  salvarStep2: protectedProcedure
    .input(
      z.object({
        pacienteId: z.number(),
        corRaca: z.string(),
        escolaridade: z.string(),
        situacaoConjugal: z.string().optional(),
        rendaFamiliar: z.string().optional(),
        ocupacao: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      assertPatient(ctx.session)
      await db
        .update(pacientes)
        .set({ ...input, currentStep: 3, updatedAt: new Date() })
        .where(and(eq(pacientes.id, input.pacienteId), eq(pacientes.tokenId, ctx.session.tokenId)))
      return { ok: true }
    }),

  // Step 3 — Contato
  salvarStep3: protectedProcedure
    .input(
      z.object({
        pacienteId: z.number(),
        email: z.string().email(),
        telefone: z.string().min(10),
        cep: z.string().length(8),
        logradouro: z.string(),
        numero: z.string(),
        complemento: z.string().optional(),
        bairro: z.string(),
        cidade: z.string(),
        estado: z.string().length(2),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      assertPatient(ctx.session)
      await db
        .update(pacientes)
        .set({
          emailEncrypted: encrypt(input.email),
          telefoneEncrypted: encrypt(input.telefone),
          cep: input.cep,
          logradouro: input.logradouro,
          numero: input.numero,
          complemento: input.complemento,
          bairro: input.bairro,
          cidade: input.cidade,
          estado: input.estado,
          currentStep: 4,
          updatedAt: new Date(),
        })
        .where(and(eq(pacientes.id, input.pacienteId), eq(pacientes.tokenId, ctx.session.tokenId)))
      return { ok: true }
    }),

  // Step 4 — Conduta
  salvarStep4: protectedProcedure
    .input(z.object({ pacienteId: z.number(), conduta: condutaSchema }))
    .mutation(async ({ input, ctx }) => {
      assertPatient(ctx.session)
      await db
        .update(pacientes)
        .set({ condutaJson: input.conduta, currentStep: 5, updatedAt: new Date() })
        .where(and(eq(pacientes.id, input.pacienteId), eq(pacientes.tokenId, ctx.session.tokenId)))
      return { ok: true }
    }),

  // Step 5 — Prescrição
  salvarStep5: protectedProcedure
    .input(
      z.object({
        pacienteId: z.number(),
        prescricao: z.object({
          medicamento: z.enum(['tenofovir_emtricitabina', 'outro']),
          nomeMedicamento: z.string().optional(),
          posologia: z.string(),
          duracao: z.string(),
          observacoes: z.string().optional(),
        }),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      assertPatient(ctx.session)
      await db
        .update(pacientes)
        .set({ prescricaoJson: input.prescricao, currentStep: 6, updatedAt: new Date() })
        .where(and(eq(pacientes.id, input.pacienteId), eq(pacientes.tokenId, ctx.session.tokenId)))
      return { ok: true }
    }),

  // Step 6 — Serviço
  salvarStep6: protectedProcedure
    .input(
      z.object({
        pacienteId: z.number(),
        tipoAtendimento: z.enum(['particular', 'convenio', 'sus']),
        convenio: z.string().optional(),
        numeroConvenio: z.string().optional(),
        valorCentavos: z.number().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      assertPatient(ctx.session)
      await db
        .update(pacientes)
        .set({ ...input, currentStep: 7, updatedAt: new Date() })
        .where(and(eq(pacientes.id, input.pacienteId), eq(pacientes.tokenId, ctx.session.tokenId)))
      return { ok: true }
    }),

  // Step 7 — Autorizados
  salvarStep7: protectedProcedure
    .input(
      z.object({
        pacienteId: z.number(),
        autorizados: z.array(
          z.object({ nome: z.string(), parentesco: z.string(), telefone: z.string().optional() }),
        ),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      assertPatient(ctx.session)
      await db
        .update(pacientes)
        .set({ autorizadosJson: input.autorizados, currentStep: 8, updatedAt: new Date() })
        .where(and(eq(pacientes.id, input.pacienteId), eq(pacientes.tokenId, ctx.session.tokenId)))
      return { ok: true }
    }),

  // Finalizar formulário após TCLE
  finalizar: protectedProcedure
    .input(z.object({ pacienteId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      assertPatient(ctx.session)
      await db
        .update(pacientes)
        .set({ status: 'pendente', updatedAt: new Date() })
        .where(and(eq(pacientes.id, input.pacienteId), eq(pacientes.tokenId, ctx.session.tokenId)))
      return { ok: true }
    }),

  // Buscar dados do paciente (descriptografando)
  buscar: protectedProcedure
    .input(z.object({ pacienteId: z.number() }))
    .query(async ({ input, ctx }) => {
      assertPatient(ctx.session)
      const [p] = await db
        .select()
        .from(pacientes)
        .where(and(eq(pacientes.id, input.pacienteId), eq(pacientes.tokenId, ctx.session.tokenId)))
        .limit(1)

      if (!p) throw new TRPCError({ code: 'NOT_FOUND' })

      return {
        ...p,
        cpf: decrypt(p.cpfEncrypted),
        nome: decrypt(p.nomeEncrypted),
        dataNascimento: p.dataNascimentoEncrypted ? decrypt(p.dataNascimentoEncrypted) : null,
        email: p.emailEncrypted ? decrypt(p.emailEncrypted) : null,
        telefone: p.telefoneEncrypted ? decrypt(p.telefoneEncrypted) : null,
        // Remover campos encriptados brutos da resposta
        cpfEncrypted: undefined,
        nomeEncrypted: undefined,
        dataNascimentoEncrypted: undefined,
        emailEncrypted: undefined,
        telefoneEncrypted: undefined,
      }
    }),
})
