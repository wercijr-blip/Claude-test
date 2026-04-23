import { z } from 'zod'
import { randomBytes, createHash } from 'crypto'
import { router, publicProcedure, staffProcedure } from '../_core/trpc.ts'
import { TRPCError } from '@trpc/server'
import { db } from '../db.ts'
import { precadastros, accessTokens } from '../../drizzle/schema.ts'
import { eq, desc } from 'drizzle-orm'
import { encrypt, decrypt, hashCpf } from '../_core/encryption.ts'
import { validarCpf, normalizarCpf } from '../_core/cpfValidator.ts'
import { criarCheckoutIntake } from '../stripe/products.ts'
import { enviarLinkAcessoIntake } from '../email.ts'
import { enviarWhatsApp } from '../whatsapp.ts'
import { env } from '../_core/env.ts'
import { TOKEN_EXPIRY_DAYS } from '../../shared/security-constants.ts'
import { ERROR_MESSAGES, HORARIO_ATENDIMENTO } from '../../shared/const.ts'

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

function isDentroHorarioAtendimento(): boolean {
  const agora = new Date()
  const spTime = new Date(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  const hora = spTime.getHours()
  const diaSemana = spTime.getDay() // 0=Dom, 1=Seg, ..., 6=Sab
  const isDiaUtil = diaSemana >= 1 && diaSemana <= 5
  const isDentroHorario = hora >= HORARIO_ATENDIMENTO.ABERTURA_HORA && hora < HORARIO_ATENDIMENTO.FECHAMENTO_HORA
  return isDiaUtil && isDentroHorario
}

export async function gerarEEnviarLinkAcesso(precadastroId: number, validadoPorId?: number): Promise<void> {
  const [precad] = await db.select().from(precadastros).where(eq(precadastros.id, precadastroId)).limit(1)
  if (!precad) throw new Error(`Pré-cadastro ${precadastroId} não encontrado`)

  const raw = randomBytes(32).toString('hex')
  const tokenHash = hashToken(raw)
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + TOKEN_EXPIRY_DAYS)

  const emailDecrypted = decrypt(precad.emailEncrypted)
  const telefoneDecrypted = decrypt(precad.telefoneEncrypted)
  const nomeDecrypted = decrypt(precad.nomeEncrypted)

  await db.insert(accessTokens).values({
    tokenHash,
    patientEmail: emailDecrypted,
    tipo: precad.tipo === 'plano' ? 'convenio' : 'privado',
    convenio: precad.plano ?? undefined,
    expiresAt,
    createdById: validadoPorId ?? 1,
  })

  const [token] = await db
    .select({ id: accessTokens.id })
    .from(accessTokens)
    .where(eq(accessTokens.tokenHash, tokenHash))
    .limit(1)

  await db.update(precadastros)
    .set({ status: 'link_enviado', accessTokenId: token?.id })
    .where(eq(precadastros.id, precadastroId))

  const link = `${env.APP_URL}/acesso/${raw}`

  await enviarLinkAcessoIntake(emailDecrypted, nomeDecrypted, link, expiresAt).catch(console.error)

  const mensagemWA =
    `Olá ${nomeDecrypted}! Seu acesso ao formulário PrEP está liberado.\n\n` +
    `Acesse o link abaixo para continuar:\n${link}\n\n` +
    `Válido até ${expiresAt.toLocaleDateString('pt-BR')}.\n\n_Facilita PrEP_`
  await enviarWhatsApp(telefoneDecrypted, mensagemWA).catch(console.error)
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

      return { precadastroId: inserted.id }
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
        .set({ validadoPorId: ctx.user!.id, validadoEm: new Date() })
        .where(eq(precadastros.id, input.precadastroId))

      await gerarEEnviarLinkAcesso(input.precadastroId, ctx.user!.id)

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
          validadoPorId: ctx.user!.id,
          validadoEm: new Date(),
          observacoes: input.observacoes,
        })
        .where(eq(precadastros.id, input.precadastroId))

      return { ok: true }
    }),
})
