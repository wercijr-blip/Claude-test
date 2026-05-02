import { z } from 'zod'
import { SignJWT } from 'jose'
import { router, protectedProcedure } from '../_core/trpc.ts'
import { TRPCError } from '@trpc/server'
import { db } from '../db.ts'
import { pacientes, precadastros, pdfs, tcleAssinaturas } from '../../drizzle/schema.ts'
import { eq, and } from 'drizzle-orm'
import { encrypt, decrypt, hashCpf } from '../_core/encryption.ts'
import { validarCpf } from '../_core/cpfValidator.ts'
import { ERROR_MESSAGES, PREP_MODALIDADE, PREP_POSOLOGIA } from '../../shared/const.ts'
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
        nomeMae: z.string().min(3, 'Informe o nome completo da mãe').max(255),
        cns: z.string().max(20).optional(),
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
            nomeMaeEncrypted: encrypt(input.nomeMae),
            cns: input.cns,
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
        nomeMaeEncrypted: encrypt(input.nomeMae),
        cns: input.cns,
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
        identidadeGenero: z.string().max(50).optional(),
        orientacaoSexual: z.string().max(50).optional(),
        ufNascimento: z.string().length(2).optional(),
        municipioNascimento: z.string().max(100).optional(),
        situacaoRua: z.boolean().optional(),
        privadoLiberdade: z.boolean().optional(),
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
          identidadeGenero: input.identidadeGenero,
          orientacaoSexual: input.orientacaoSexual,
          ufNascimento: input.ufNascimento,
          municipioNascimento: input.municipioNascimento,
          situacaoRua: input.situacaoRua,
          privadoLiberdade: input.privadoLiberdade,
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
        permiteContato: z.boolean().optional(),
        tipoContato: z.enum(['residencial', 'celular', 'email', 'outros']).optional(),
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
          permiteContato: input.permiteContato,
          tipoContato: input.tipoContato,
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

  // Step 5 — Modalidade da PrEP (substitui a antiga Prescrição editável)
  // O paciente escolhe diária (preferencial) ou sob demanda; o sistema
  // preenche posologia/duração automaticamente conforme protocolo MS.
  salvarStep5: protectedProcedure
    .input(
      z.object({
        pacienteId: z.number(),
        prepModalidade: z.enum([PREP_MODALIDADE.DIARIA, PREP_MODALIDADE.SOB_DEMANDA]),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      assertPatient(ctx.session)
      const p = await validarEtapaPaciente(input.pacienteId, ctx.session.tokenId, 5)
      const { posologia, duracao } = PREP_POSOLOGIA[input.prepModalidade]
      await db
        .update(pacientes)
        .set({
          prepModalidade: input.prepModalidade,
          prescricaoJson: {
            medicamento: 'tenofovir_emtricitabina',
            posologia,
            duracao,
            modalidade: input.prepModalidade,
          },
          currentStep: Math.max(p.currentStep, 6),
          updatedAt: new Date(),
        })
        .where(and(eq(pacientes.id, input.pacienteId), eq(pacientes.tokenId, ctx.session.tokenId)))
      return { ok: true }
    }),

  // Step 6 — Serviço (avança direto para TCLE — etapa 7 antiga "Autorizados" foi removida)
  salvarStep6: protectedProcedure
    .input(
      z.object({
        pacienteId: z.number(),
        tipoAtendimento: z.enum(['particular', 'convenio', 'sus']),
        convenio: z.string().max(255).optional(),
        numeroConvenio: z.string().max(100).optional(),
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
          currentStep: Math.max(p.currentStep, 7),
          updatedAt: new Date(),
        })
        .where(and(eq(pacientes.id, input.pacienteId), eq(pacientes.tokenId, ctx.session.tokenId)))
      return { ok: true }
    }),

  // Salvar assinatura TCLE (etapa 7 — antiga etapa 8)
  salvarTcle: protectedProcedure
    .input(z.object({
      pacienteId: z.number(),
      assinaturaDataUrl: z.string().min(1).max(500_000),
    }))
    .mutation(async ({ input, ctx }) => {
      assertPatient(ctx.session)
      await validarEtapaPaciente(input.pacienteId, ctx.session.tokenId, 7)
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
        nomeMae: p.nomeMaeEncrypted ? decrypt(p.nomeMaeEncrypted) : null,
        email: p.emailEncrypted ? decrypt(p.emailEncrypted) : null,
        telefone: p.telefoneEncrypted ? decrypt(p.telefoneEncrypted) : null,
        cpfEncrypted: undefined,
        nomeEncrypted: undefined,
        dataNascimentoEncrypted: undefined,
        nomeMaeEncrypted: undefined,
        emailEncrypted: undefined,
        telefoneEncrypted: undefined,
      }
    }),
})
