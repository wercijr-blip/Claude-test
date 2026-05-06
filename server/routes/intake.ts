import { z } from 'zod'
import { router, publicProcedure, staffProcedure } from '../_core/trpc.ts'
import { hashToken, generateToken } from '../_core/tokenUtils.ts'
import { TRPCError } from '@trpc/server'
import { db } from '../db.ts'
import { precadastros, accessTokens, users } from '../../drizzle/schema.ts'
import { eq, desc, inArray } from 'drizzle-orm'
import { encrypt, decrypt, hashCpf } from '../_core/encryption.ts'
import { validarCpf, normalizarCpf } from '../_core/cpfValidator.ts'
import { criarCheckoutIntake, stripe } from '../stripe/products.ts'
import { enviarNotificacaoNovoPlano, enviarConfirmacaoPlano } from '../email.ts'
import { getPresignedUrl } from '../storage.ts'
import { env } from '../_core/env.ts'
import { TOKEN_EXPIRY_DAYS } from '../../shared/security-constants.ts'
import { enqueueEnviarLinkAcesso } from '../pdfQueue.ts'
import { ERROR_MESSAGES, HORARIO_ATENDIMENTO } from '../../shared/const.ts'
import { logger } from '../_core/logger.ts'

function isDentroHorarioAtendimento(): boolean {
  const agora = new Date()
  const spTime = new Date(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  const hora = spTime.getHours()
  const diaSemana = spTime.getDay() // 0=Dom, 1=Seg, ..., 6=Sab
  const isDiaUtil = diaSemana >= 1 && diaSemana <= 5
  const isDentroHorario = hora >= HORARIO_ATENDIMENTO.ABERTURA_HORA && hora < HORARIO_ATENDIMENTO.FECHAMENTO_HORA
  return isDiaUtil && isDentroHorario
}

export async function gerarEEnviarLinkAcesso(
  precadastroId: number,
  validadoPorId?: number,
): Promise<{ raw: string }> {
  const [precad] = await db.select().from(precadastros).where(eq(precadastros.id, precadastroId)).limit(1)
  if (!precad) throw new Error(`Pré-cadastro ${precadastroId} não encontrado`)

  const emailDecrypted = decrypt(precad.emailEncrypted)
  const telefoneDecrypted = decrypt(precad.telefoneEncrypted)
  const nomeDecrypted = decrypt(precad.nomeEncrypted)

  let raw: string
  let expiresAt: Date

  // Idempotência: se já existe token vinculado ao precadastro (ex: webhook duplicado),
  // reutiliza o token existente em vez de criar outro e enviar dois e-mails.
  if (precad.accessTokenId) {
    const [existingToken] = await db
      .select({ tokenHash: accessTokens.tokenHash, expiresAt: accessTokens.expiresAt })
      .from(accessTokens)
      .where(eq(accessTokens.id, precad.accessTokenId))
      .limit(1)

    if (!existingToken) throw new Error(`Token ${precad.accessTokenId} não encontrado`)

    // Não temos o raw token — só o hash. Gera novo token e atualiza o hash existente.
    // Isso mantém idempotência funcional: um token válido por precadastro.
    raw = generateToken()
    const newHash = hashToken(raw)
    expiresAt = existingToken.expiresAt

    await db.update(accessTokens)
      .set({ tokenHash: newHash })
      .where(eq(accessTokens.id, precad.accessTokenId))
  } else {
    raw = generateToken()
    const tokenHash = hashToken(raw)
    expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + TOKEN_EXPIRY_DAYS)

    await db.transaction(async (tx) => {
      await tx.insert(accessTokens).values({
        tokenHash,
        patientEmail: emailDecrypted,
        tipo: precad.tipo === 'plano' ? 'convenio' : 'privado',
        convenio: precad.plano ?? undefined,
        expiresAt,
        createdById: validadoPorId ?? 1,
      })

      const [token] = await tx
        .select({ id: accessTokens.id })
        .from(accessTokens)
        .where(eq(accessTokens.tokenHash, tokenHash))
        .limit(1)

      await tx.update(precadastros)
        .set({ status: 'link_enviado', accessTokenId: token?.id })
        .where(eq(precadastros.id, precadastroId))
    })
  }

  const link = `${env.APP_URL}/acesso/${raw}`

  // Enqueue instead of direct send — BullMQ provides retry with backoff
  // so a transient email/WA failure doesn't silently lose the patient's link.
  await enqueueEnviarLinkAcesso(emailDecrypted, nomeDecrypted, telefoneDecrypted, link, expiresAt)

  return { raw }
}

export const intakeRouter = router({
  // Paciente cria pré-cadastro (público, sem autenticação)
  criar: publicProcedure
    .input(z.object({
      nome: z.string().min(2).max(255),
      telefone: z.string().min(10).max(20),
      cpf: z.string(),
      email: z.string().email(),
      tipo: z.enum(['particular', 'plano']),
      plano: z.string().optional(),
      carteirinhaS3Key: z.string().optional(),
      documentoS3Key: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      if (!validarCpf(input.cpf)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: ERROR_MESSAGES.CPF_INVALID })
      }

      if (input.tipo === 'plano') {
        if (!input.plano) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Selecione o plano de saúde.' })
        }
        if (!input.carteirinhaS3Key || !input.documentoS3Key) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Envie a carteirinha e o documento de identidade.' })
        }
      }

      const cpfNorm = normalizarCpf(input.cpf)

      await db.insert(precadastros).values({
        nomeEncrypted: encrypt(input.nome),
        telefoneEncrypted: encrypt(input.telefone),
        cpfEncrypted: encrypt(cpfNorm),
        cpfHash: hashCpf(cpfNorm),
        emailEncrypted: encrypt(input.email),
        tipo: input.tipo,
        plano: input.plano,
        carteirinhaS3Key: input.carteirinhaS3Key,
        documentoS3Key: input.documentoS3Key,
        status: input.tipo === 'particular' ? 'aguardando_pagamento' : 'aguardando_validacao',
      })

      const [inserted] = await db
        .select({ id: precadastros.id })
        .from(precadastros)
        .where(eq(precadastros.cpfHash, hashCpf(cpfNorm)))
        .orderBy(desc(precadastros.createdAt))
        .limit(1)

      // Notify all secretárias/admins when a plano patient registers
      if (input.tipo === 'plano') {
        const staffUsers = await db
          .select({ email: users.email })
          .from(users)
          .where(inArray(users.role, ['secretaria', 'admin']))

        const emails = staffUsers.map(u => u.email).filter(Boolean) as string[]
        const dashboardUrl = `${env.APP_URL}/secretaria`

        await enviarNotificacaoNovoPlano(emails, input.nome, input.plano!, dashboardUrl).catch((e: unknown) => logger.warn('[intake] notificação falhou', { error: String(e) }))
        await enviarConfirmacaoPlano(input.email, input.nome).catch((e: unknown) => logger.warn('[intake] notificação falhou', { error: String(e) }))
      }

      return { precadastroId: inserted.id }
    }),

  // Após o Stripe redirecionar para /pagamento/sucesso?session_id=...
  // o cliente troca o session_id pelo raw access token, sem depender do
  // e-mail/WhatsApp. O webhook checkout.session.completed também roda em
  // paralelo e enviará as notificações como backup — a checagem
  // `precad.status === 'link_enviado'` no webhook garante idempotência.
  acessoPosPagamento: publicProcedure
    .input(z.object({ sessionId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      let session
      try {
        session = await stripe.checkout.sessions.retrieve(input.sessionId)
      } catch {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Sessão de pagamento não encontrada.' })
      }

      if (session.payment_status !== 'paid') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Pagamento ainda não foi confirmado pelo Stripe. Tente novamente em instantes.',
        })
      }

      const rawPrecadastroId = (session.metadata as { precadastroId?: string } | null)?.precadastroId
      if (!rawPrecadastroId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Sessão sem precadastroId.' })
      }
      const precadastroId = parseInt(rawPrecadastroId, 10)

      const { raw } = await gerarEEnviarLinkAcesso(precadastroId)
      return { token: raw }
    }),

  // Iniciar pagamento Stripe (particular)
  iniciarPagamento: publicProcedure
    .input(z.object({ precadastroId: z.number() }))
    .mutation(async ({ input }) => {
      const [precad] = await db.select().from(precadastros).where(eq(precadastros.id, input.precadastroId)).limit(1)
      if (!precad || precad.tipo !== 'particular') {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }
      if (precad.status === 'link_enviado') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Link já enviado para este cadastro.' })
      }

      const emailDecrypted = decrypt(precad.emailEncrypted)
      const { url, sessionId } = await criarCheckoutIntake(precad.id, emailDecrypted)

      await db.update(precadastros)
        .set({ stripeSessionId: sessionId })
        .where(eq(precadastros.id, precad.id))

      return { url }
    }),

  // Secretaria: listar planos aguardando validação
  listarPendentes: staffProcedure
    .query(async () => {
      const rows = await db
        .select()
        .from(precadastros)
        .where(eq(precadastros.status, 'aguardando_validacao'))
        .orderBy(desc(precadastros.createdAt))

      return rows.map(r => ({
        id: r.id,
        nome: decrypt(r.nomeEncrypted),
        telefone: decrypt(r.telefoneEncrypted),
        email: decrypt(r.emailEncrypted),
        plano: r.plano,
        carteirinhaS3Key: r.carteirinhaS3Key,
        documentoS3Key: r.documentoS3Key,
        createdAt: r.createdAt,
      }))
    }),

  // Gerar URL pré-assinada para visualizar documento de intake (secretaria)
  urlDocumento: staffProcedure
    .input(z.object({ s3Key: z.string().min(1) }))
    .mutation(async ({ input }) => {
      if (!input.s3Key.startsWith('intake/')) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado.' })
      }
      const url = await getPresignedUrl(input.s3Key, 900)
      return { url }
    }),

  // Secretaria: aprovar plano e enviar link
  aprovar: staffProcedure
    .input(z.object({ precadastroId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const [precad] = await db.select().from(precadastros).where(eq(precadastros.id, input.precadastroId)).limit(1)
      if (!precad) throw new TRPCError({ code: 'NOT_FOUND' })
      if (precad.status !== 'aguardando_validacao') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Pré-cadastro não está aguardando validação.' })
      }

      await db.update(precadastros)
        .set({ validadoPorId: ctx.session.id, validadoEm: new Date() })
        .where(eq(precadastros.id, input.precadastroId))

      await gerarEEnviarLinkAcesso(input.precadastroId, ctx.session.id)

      return { ok: true }
    }),

  // Secretaria: rejeitar plano
  rejeitar: staffProcedure
    .input(z.object({ precadastroId: z.number(), observacoes: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const [precad] = await db.select().from(precadastros).where(eq(precadastros.id, input.precadastroId)).limit(1)
      if (!precad) throw new TRPCError({ code: 'NOT_FOUND' })

      await db.update(precadastros)
        .set({
          status: 'rejeitado',
          validadoPorId: ctx.session.id,
          validadoEm: new Date(),
          observacoes: input.observacoes,
        })
        .where(eq(precadastros.id, input.precadastroId))

      return { ok: true }
    }),
})
