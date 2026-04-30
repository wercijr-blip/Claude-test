import { z } from 'zod'
import { SignJWT } from 'jose'
import { router, protectedProcedure } from '../_core/trpc.ts'
import { TRPCError } from '@trpc/server'
import { db } from '../db.ts'
import { pacientes, precadastros, pdfs, tcleAssinaturas } from '../../drizzle/schema.ts'
import { eq, and } from 'drizzle-orm'
import { encrypt, decrypt, hashCpf } from '../_core/encryption.ts'
import { validarCpf } from '../_core/cpfValidator.ts'
import { ERROR_MESSAGES } from '../../shared/const.ts'
import { env } from '../_core/env.ts'
import { JWT_EXPIRY_PATIENT } from '../../shared/security-constants.ts'
import { getPresignedUrl } from '../storage.ts'
import { enqueueGerarPdf } from '../pdfQueue.ts'
import type { ResultSetHeader } from 'mysql2'

async function emitirJwtPaciente(tokenId: number, pacienteId: number): Promise<string> {
  const secret = new TextEncoder().encode(env.JWT_SECRET)
  return new SignJWT({ type: 'patient', tokenId, pacienteId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY_PATIENT)
    .sign(secret)
}

function assertPatient(session: unknown): asserts session is { type: 'patient'; tokenId: number; pacienteId: number | null } {
  if (!session || (session as { type: string }).type !== 'patient') {
    throw new TRPCError({ code: 'FORBIDDEN' })
  }
}

async function validarEtapaPaciente(pacienteId: number, tokenId: number, etapaRequerida: number) {
  const [p] = await db
    .select({ id: pacientes.id, currentStep: pacientes.currentStep })
    .from(pacientes)
    .where(and(eq(pacientes.id, pacienteId), eq(pacientes.tokenId, tokenId)))
    .limit(1)

  if (!p) throw new TRPCError({ code: 'NOT_FOUND' })
  if (p.currentStep < etapaRequerida) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Complete as etapas anteriores primeiro' })
  }
  return p
}

const condutaSchema = z.object({
  relacoesSexuais: z.object({
    tipos: z.array(z.enum(['vaginal', 'anal_receptivo', 'anal_insertivo', 'oral'])),
    frequencia: z.enum(['diaria', 'semanal', 'mensal', 'esporadica']),
    parceirosUltimos6Meses: z.number().min(0),
    usaPreservativo: z.enum(['sempre', 'quase_sempre', 'as_vezes', 'nunca']),
  }),
  historicoDst: z.boolean(),
  dstDescricao: z.string().max(1000).optional(),
  prepAnterior: z.boolean(),
  prepPeriodo: z.string().max(255).optional(),
  usoDrogas: z.boolean(),
  drogasDescricao: z.string().max(1000).optional(),
  outrasInformacoes: z.string().max(2000).optional(),
})

export const pacienteRouter = router({
  // Step 1 — Dados Pessoais
  salvarStep1: protectedProcedure
    .input(
      z.object({
        cpf: z.string().refine(validarCpf, ERROR_MESSAGES.CPF_INVALID),
        nome: z.string().min(3).max(255),
        dataNascimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        sexo: z.enum(['masculino', 'feminino', 'outro']),
        nomeSocial: z.string().max(255).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      assertPatient(ctx.session)
      const { tokenId } = ctx.session
      const cpfHash = hashCpf(input.cpf)

      const retentionUntil = new Date()
      retentionUntil.setFullYear(retentionUntil.getFullYear() + 20)

      const targetId = ctx.session.pacienteId ?? await (async () => {
        const [existing] = await db
          .select({ id: pacientes.id })
          .from(pacientes)
          .where(eq(pacientes.tokenId, tokenId))
          .limit(1)
        return existing?.id ?? null
      })()

      if (targetId) {
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
          .where(eq(pacientes.id, targetId))
        // Emit refreshed JWT only when the session still had pacienteId: null
        const newSessionToken = ctx.session.pacienteId == null
          ? await emitirJwtPaciente(tokenId, targetId)
          : undefined
        return { pacienteId: targetId, newSessionToken }
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
      const newPacienteId = (result as ResultSetHeader).insertId
      const newSessionToken = await emitirJwtPaciente(tokenId, newPacienteId)
      return { pacienteId: newPacienteId, newSessionToken }
    }),

  // Step 2 — Demográfico
  salvarStep2: protectedProcedure
    .input(
      z.object({
        pacienteId: z.number(),
        corRaca: z.string().max(50),
        escolaridade: z.string().max(100),
        situacaoConjugal: z.string().max(50).optional(),
        rendaFamiliar: z.string().max(100).optional(),
        ocupacao: z.string().max(255).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      assertPatient(ctx.session)
      const p = await validarEtapaPaciente(input.pacienteId, ctx.session.tokenId, 2)
      await db
        .update(pacientes)
        .set({
          corRaca: input.corRaca,
          escolaridade: input.escolaridade,
          situacaoConjugal: input.situacaoConjugal,
          rendaFamiliar: input.rendaFamiliar,
          ocupacao: input.ocupacao,
          currentStep: Math.max(p.currentStep, 3),
          updatedAt: new Date(),
        })
        .where(and(eq(pacientes.id, input.pacienteId), eq(pacientes.tokenId, ctx.session.tokenId)))
      return { ok: true }
    }),

  // Step 3 — Contato
  salvarStep3: protectedProcedure
    .input(
      z.object({
        pacienteId: z.number(),
        email: z.string().email().max(255),
        tipoTelefone: z.string().max(20).optional(),
        telefone: z.string().min(10).max(20),
        cep: z.string().length(8),
        logradouro: z.string().max(255),
        numero: z.string().max(20),
        complemento: z.string().max(100).optional(),
        bairro: z.string().max(100),
        cidade: z.string().max(100),
        estado: z.string().length(2),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      assertPatient(ctx.session)
      const p = await validarEtapaPaciente(input.pacienteId, ctx.session.tokenId, 3)
      await db
        .update(pacientes)
        .set({
          emailEncrypted: encrypt(input.email),
          tipoTelefone: input.tipoTelefone,
          telefoneEncrypted: encrypt(input.telefone),
          cep: input.cep,
          logradouro: input.logradouro,
          numero: input.numero,
          complemento: input.complemento,
          bairro: input.bairro,
          cidade: input.cidade,
          estado: input.estado,
          currentStep: Math.max(p.currentStep, 4),
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
      const p = await validarEtapaPaciente(input.pacienteId, ctx.session.tokenId, 4)
      await db
        .update(pacientes)
        .set({ condutaJson: input.conduta, currentStep: Math.max(p.currentStep, 5), updatedAt: new Date() })
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
          nomeMedicamento: z.string().max(255).optional(),
          posologia: z.string().max(500),
          duracao: z.string().max(100),
          observacoes: z.string().max(2000).optional(),
        }),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      assertPatient(ctx.session)
      const p = await validarEtapaPaciente(input.pacienteId, ctx.session.tokenId, 5)
      await db
        .update(pacientes)
        .set({ prescricaoJson: input.prescricao, currentStep: Math.max(p.currentStep, 6), updatedAt: new Date() })
        .where(and(eq(pacientes.id, input.pacienteId), eq(pacientes.tokenId, ctx.session.tokenId)))
      return { ok: true }
    }),

  // Step 6 — Serviço
  salvarStep6: protectedProcedure
    .input(
      z.object({
        pacienteId: z.number(),
        tipoAtendimento: z.enum(['particular', 'convenio', 'sus']),
        convenio: z.string().max(255).optional(),
        numeroConvenio: z.string().max(100).optional(),
        valorCentavos: z.number().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      assertPatient(ctx.session)
      const p = await validarEtapaPaciente(input.pacienteId, ctx.session.tokenId, 6)
      await db
        .update(pacientes)
        .set({
          tipoAtendimento: input.tipoAtendimento,
          convenio: input.convenio,
          numeroConvenio: input.numeroConvenio,
          valorCentavos: input.valorCentavos,
          currentStep: Math.max(p.currentStep, 7),
          updatedAt: new Date(),
        })
        .where(and(eq(pacientes.id, input.pacienteId), eq(pacientes.tokenId, ctx.session.tokenId)))
      return { ok: true }
    }),

  // Step 7 — Autorizados
  salvarStep7: protectedProcedure
    .input(
      z.object({
        pacienteId: z.number(),
        autorizados: z.array(
          z.object({
            nome: z.string().max(255),
            parentesco: z.string().max(50),
            telefone: z.string().max(20).optional(),
          }),
        ).max(10),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      assertPatient(ctx.session)
      const p = await validarEtapaPaciente(input.pacienteId, ctx.session.tokenId, 7)
      await db
        .update(pacientes)
        .set({ autorizadosJson: input.autorizados, currentStep: Math.max(p.currentStep, 8), updatedAt: new Date() })
        .where(and(eq(pacientes.id, input.pacienteId), eq(pacientes.tokenId, ctx.session.tokenId)))
      return { ok: true }
    }),

  // Salvar assinatura TCLE
  salvarTcle: protectedProcedure
    .input(z.object({
      pacienteId: z.number(),
      assinaturaDataUrl: z.string().min(1).max(500_000),
    }))
    .mutation(async ({ input, ctx }) => {
      assertPatient(ctx.session)
      await validarEtapaPaciente(input.pacienteId, ctx.session.tokenId, 8)
      await db
        .insert(tcleAssinaturas)
        .values({ pacienteId: input.pacienteId, assinaturaDataUrl: input.assinaturaDataUrl })
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
      await enqueueGerarPdf(input.pacienteId)
      return { ok: true }
    }),

  // Buscar dados do pré-cadastro para pré-preencher o formulário
  dadosIntake: protectedProcedure
    .query(async ({ ctx }) => {
      assertPatient(ctx.session)
      const { tokenId } = ctx.session

      const [precad] = await db
        .select()
        .from(precadastros)
        .where(eq(precadastros.accessTokenId, tokenId))
        .limit(1)

      if (!precad) return null

      return {
        nome: decrypt(precad.nomeEncrypted),
        cpf: decrypt(precad.cpfEncrypted),
        email: decrypt(precad.emailEncrypted),
        telefone: decrypt(precad.telefoneEncrypted),
        tipo: precad.tipo,
        plano: precad.plano,
      }
    }),

  // Listar PDFs gerados para download
  downloadPdfs: protectedProcedure
    .input(z.object({ pacienteId: z.number() }))
    .query(async ({ input, ctx }) => {
      assertPatient(ctx.session)
      const [paciente] = await db
        .select({ id: pacientes.id })
        .from(pacientes)
        .where(and(eq(pacientes.id, input.pacienteId), eq(pacientes.tokenId, ctx.session.tokenId)))
        .limit(1)
      if (!paciente) throw new TRPCError({ code: 'NOT_FOUND' })

      const rows = await db.select().from(pdfs).where(eq(pdfs.pacienteId, input.pacienteId))

      return Promise.all(
        rows.map(async (r) => ({
          id: r.id,
          tipo: r.tipo,
          assinadoEm: r.assinadoEm,
          url: await getPresignedUrl(r.s3Key, 3600),
        })),
      )
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
        cpfEncrypted: undefined,
        nomeEncrypted: undefined,
        dataNascimentoEncrypted: undefined,
        emailEncrypted: undefined,
        telefoneEncrypted: undefined,
      }
    }),
})
