import { z } from 'zod'
import { SignJWT } from 'jose'
import { router, protectedProcedure } from '../_core/trpc.ts'
import { TRPCError } from '@trpc/server'
import { db } from '../db.ts'
import { pacientes, precadastros, pdfs, tcleAssinaturas, accessTokens } from '../../drizzle/schema.ts'
import { eq, and, sql, gte } from 'drizzle-orm'
import type { ResultSetHeader } from 'mysql2'
import { encrypt, decrypt, hashCpf } from '../_core/encryption.ts'
import { validarCpf, normalizarCpf } from '../_core/cpfValidator.ts'
import { ERROR_MESSAGES, PREP_MODALIDADE, PREP_POSOLOGIA } from '../../shared/const.ts'
import { env } from '../_core/env.ts'
import { JWT_EXPIRY_PATIENT } from '../../shared/security-constants.ts'
import { getPresignedUrl } from '../storage.ts'
import { enqueueGerarPdf } from '../pdfQueue.ts'
import { enviarCadastroRecebidoExames } from '../email.ts'
import { enviarWhatsApp } from '../whatsapp.ts'
import { gerarLinkDeAcesso } from './intake.ts'
import * as Sentry from '@sentry/node'
import { okEmpty } from '../_core/response.ts'
import { normalizarTelefoneParaE164 } from '../_core/phoneUtils.ts'

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
    .select({ id: pacientes.id, currentStep: pacientes.currentStep, status: pacientes.status })
    .from(pacientes)
    .where(and(eq(pacientes.id, pacienteId), eq(pacientes.tokenId, tokenId)))
    .limit(1)

  if (!p) throw new TRPCError({ code: 'NOT_FOUND' })
  if (p.currentStep < etapaRequerida) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Complete as etapas anteriores primeiro' })
  }
  return p
}

// Single-query alternative: merges step validation into the UPDATE WHERE clause.
// Happy path = 1 query instead of 2. Error path falls back to a diagnostic SELECT.
async function salvarEtapa(
  pacienteId: number,
  tokenId: number,
  etapaRequerida: number,
  nextStep: number,
  fields: Record<string, unknown>,
): Promise<void> {
  const result = await db
    .update(pacientes)
    .set({ ...fields, currentStep: sql`GREATEST(currentStep, ${nextStep})`, updatedAt: new Date() })
    .where(and(
      eq(pacientes.id, pacienteId),
      eq(pacientes.tokenId, tokenId),
      gte(pacientes.currentStep, etapaRequerida),
    ))

  if ((result as unknown as ResultSetHeader).affectedRows === 0) {
    const [exists] = await db
      .select({ id: pacientes.id })
      .from(pacientes)
      .where(and(eq(pacientes.id, pacienteId), eq(pacientes.tokenId, tokenId)))
      .limit(1)
    throw exists
      ? new TRPCError({ code: 'BAD_REQUEST', message: 'Complete as etapas anteriores primeiro' })
      : new TRPCError({ code: 'NOT_FOUND' })
  }
}

// Schema clínico do Step 4 — alinhado com os campos preenchidos na
// Ficha de Atendimento PrEP SUS (Form 02 FEV/2025):
//   - temSintomasDst → item 16 (sintomas IST)
//   - usoDrogas      → itens 18 (drogas injetáveis) e 19 (psicoativas)
//   - prepAdesao     → item 20 (apenas se tipoConsulta === 'ja_faco_prep')
const condutaSchema = z.object({
  temSintomasDst: z.boolean(),
  usoDrogas: z.boolean(),
  prepAdesao: z.enum(['diaria', 'sob_demanda']).optional(),
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
      const cpfNorm = normalizarCpf(input.cpf)
      const cpfHash = hashCpf(cpfNorm)

      const retentionUntil = new Date()
      retentionUntil.setFullYear(retentionUntil.getFullYear() + 20)

      // Deriva tipoAtendimento e convenio do accessToken (preenchido pelo
      // intake/Stripe). O Step "Serviço" foi removido do fluxo, então
      // precisamos capturar essas informações na criação do paciente —
      // continuam sendo usadas em dashboards (medico, admin, secretaria).
      const [tokenInfo] = await db
        .select({ tipo: accessTokens.tipo, convenio: accessTokens.convenio })
        .from(accessTokens)
        .where(eq(accessTokens.id, tokenId))
        .limit(1)
      const tipoAtendimento = tokenInfo?.tipo === 'convenio' ? 'convenio' : 'particular'
      const convenio = tokenInfo?.convenio ?? null

      const cpfEncrypted = encrypt(cpfNorm)
      const nomeEncrypted = encrypt(input.nome)
      const dataNascimentoEncrypted = encrypt(input.dataNascimento)
      const nomeMaeEncrypted = encrypt(input.nomeMae)

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
            cpfEncrypted,
            // cpfHash is set once at INSERT and never updated — CPF is immutable after registration
            nomeEncrypted,
            dataNascimentoEncrypted,
            nomeMaeEncrypted,
            cns: input.cns,
            sexo: input.sexo,
            nomeSocial: input.nomeSocial,
            tipoAtendimento,
            convenio,
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

      // Atomic upsert: MySQL ON DUPLICATE KEY UPDATE handles concurrent requests
      // without a race condition window. LAST_INSERT_ID(id) makes MySQL return
      // the existing row's ID on conflict, so insertId is always the right ID.
      await db.insert(pacientes).values({
        tokenId,
        cpfEncrypted,
        cpfHash,
        nomeEncrypted,
        dataNascimentoEncrypted,
        nomeMaeEncrypted,
        cns: input.cns,
        sexo: input.sexo,
        nomeSocial: input.nomeSocial,
        tipoAtendimento,
        convenio,
        currentStep: 2,
        retentionUntil,
      }).onDuplicateKeyUpdate({
        set: {
          cpfEncrypted,
          // cpfHash omitted: CPF is immutable after registration (mirrors the UPDATE path above)
          nomeEncrypted,
          dataNascimentoEncrypted,
          nomeMaeEncrypted,
          cns: input.cns,
          sexo: input.sexo,
          nomeSocial: input.nomeSocial,
          tipoAtendimento,
          convenio,
          currentStep: sql`GREATEST(currentStep, 2)`,
          updatedAt: new Date(),
        },
      })
      const [upserted] = await db
        .select({ id: pacientes.id })
        .from(pacientes)
        .where(eq(pacientes.tokenId, tokenId))
        .limit(1)
      if (!upserted) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao registrar paciente' })
      const newPacienteId = upserted.id
      const newSessionToken = await emitirJwtPaciente(tokenId, newPacienteId)

      // Email 2 — "Cadastro recebido + pedido de exames" — fired once on first creation.
      // Fire-and-forget: failure doesn't block the patient from continuing.
      ;(async () => {
        try {
          const [precad] = await db
            .select({ id: precadastros.id, emailEncrypted: precadastros.emailEncrypted, telefoneEncrypted: precadastros.telefoneEncrypted })
            .from(precadastros)
            .where(eq(precadastros.accessTokenId, tokenId))
            .limit(1)
          if (!precad) return
          const { link, expiresAt, raw } = await gerarLinkDeAcesso(precad.id)
          const telefone = decrypt(precad.telefoneEncrypted)
          const primeiroNome = input.nome.split(' ')[0]
          await Promise.all([
            enviarCadastroRecebidoExames(decrypt(precad.emailEncrypted), input.nome, link, expiresAt, raw),
            telefone
              ? enviarWhatsApp(
                  telefone,
                  `Olá ${primeiroNome}! Recebemos seu cadastro.\n\n` +
                  `📋 *Próximo passo:* envie os exames laboratoriais (HIV ≤7 dias, Creatinina, HBsAg, Anti-HCV, Sífilis).\n\n` +
                  `Acesse:\n${link}\n\n_Facilita PrEP_`,
                ).catch(() => {})
              : undefined,
          ])
        } catch (err) {
          Sentry.captureException(err, { tags: { route: 'salvarStep1', stage: 'email2' } })
        }
      })()

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
      await salvarEtapa(input.pacienteId, ctx.session.tokenId, 2, 3, {
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
      })
      return okEmpty()
    }),

  // Step 3 — Contato
  salvarStep3: protectedProcedure
    .input(
      z.object({
        pacienteId: z.number(),
        email: z.string().email().max(255),
        tipoTelefone: z.string().max(20).optional(),
        telefone: z.string().regex(/^\+\d{8,15}$/, 'Use formato internacional: +5561999998888'),
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
      await salvarEtapa(input.pacienteId, ctx.session.tokenId, 3, 4, {
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
      })
      return okEmpty()
    }),

  // Step 4 — Conduta
  salvarStep4: protectedProcedure
    .input(z.object({ pacienteId: z.number(), conduta: condutaSchema }))
    .mutation(async ({ input, ctx }) => {
      assertPatient(ctx.session)
      await salvarEtapa(input.pacienteId, ctx.session.tokenId, 4, 5, { condutaJson: input.conduta })
      return okEmpty()
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
      const { posologia, duracao } = PREP_POSOLOGIA[input.prepModalidade]
      await salvarEtapa(input.pacienteId, ctx.session.tokenId, 5, 6, {
        prepModalidade: input.prepModalidade,
        prescricaoJson: {
          medicamento: 'tenofovir_emtricitabina',
          posologia,
          duracao,
          modalidade: input.prepModalidade,
        },
      })
      return okEmpty()
    }),

  // O antigo Step 6 (Serviço) foi removido. tipoAtendimento e convenio
  // são preenchidos automaticamente em salvarStep1 a partir do
  // accessToken; numeroConvenio (carteirinha) deixou de ser coletado.

  // Aceite eletrônico do TCLE (etapa 6 — antiga etapa 7).
  // Substituiu a assinatura desenhada; a evidência legal são IP, user-agent
  // e timestamp registrados no momento do clique no checkbox.
  salvarTcle: protectedProcedure
    .input(z.object({
      pacienteId: z.number(),
      aceite: z.literal(true),
    }))
    .mutation(async ({ input, ctx }) => {
      assertPatient(ctx.session)
      const p = await validarEtapaPaciente(input.pacienteId, ctx.session.tokenId, 6)

      // Trava de evidência legal: depois do paciente clicar em finalizar
      // (status muda de 'rascunho' para 'pendente'), o aceite original
      // não pode mais ser sobrescrito — IP, user-agent e timestamp do
      // momento do clique são prova auditada do consentimento.
      if (p.status !== 'rascunho') {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'TCLE já foi aceito e o formulário já foi finalizado.',
        })
      }

      const ipAddress = (ctx.req.ip ?? ctx.req.socket?.remoteAddress ?? null)?.slice(0, 45) ?? null
      const userAgent = ctx.req.headers['user-agent']?.slice(0, 500) ?? null
      // upsert: idempotente em caso de retry de rede ou clique duplo.
      // Antes do finalizar, regravar o aceite com IP/UA atual é seguro —
      // ainda é o mesmo paciente na mesma sessão tentando concluir.
      await db
        .insert(tcleAssinaturas)
        .values({ pacienteId: input.pacienteId, ipAddress, userAgent })
        .onDuplicateKeyUpdate({ set: { ipAddress, userAgent, signedAt: new Date() } })
      return okEmpty()
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
      return okEmpty()
    }),

  // Buscar dados do pré-cadastro para pré-preencher o formulário
  dadosIntake: protectedProcedure
    .query(async ({ ctx }) => {
      assertPatient(ctx.session)

      let tokenId = ctx.session.tokenId
      if (ctx.session.pacienteId !== null) {
        const [pac] = await db
          .select({ tokenId: pacientes.tokenId })
          .from(pacientes)
          .where(eq(pacientes.id, ctx.session.pacienteId))
          .limit(1)
        if (!pac) return null
        tokenId = pac.tokenId
      }

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
        telefone: normalizarTelefoneParaE164(decrypt(precad.telefoneEncrypted)),
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
        telefone: normalizarTelefoneParaE164(p.telefoneEncrypted ? decrypt(p.telefoneEncrypted) : null),
        cpfEncrypted: undefined,
        nomeEncrypted: undefined,
        dataNascimentoEncrypted: undefined,
        nomeMaeEncrypted: undefined,
        emailEncrypted: undefined,
        telefoneEncrypted: undefined,
      }
    }),
})
