import { Worker } from 'bullmq'
import { env } from '../_core/env.ts'
import { db } from '../db.ts'
import { consultasInicio, accessTokens, precadastros } from '../../drizzle/schema.ts'
import { eq, and, gt } from 'drizzle-orm'
import { decrypt } from '../_core/encryption.ts'
import { enviarLinkAcessoIntake } from '../email.ts'
import { enviarWhatsApp } from '../whatsapp.ts'
import { generateToken, hashToken } from '../_core/tokenUtils.ts'
import { logger } from '../_core/logger.ts'
import { LEMBRETE_QUEUE_NAME, QUEUE_PREFIX, connection, LEMBRETE_WORKER_OPTS, lembreteQueue, persistDlq } from './queues.ts'

export async function agendarLembreteDiario() {
  await lembreteQueue.add('lembrete-diario', {}, {
    repeat: { pattern: '0 11 * * *' },
    jobId: 'lembrete-diario-fixo',
  })
}

export function startLembreteWorker() {
  const worker = new Worker(
    LEMBRETE_QUEUE_NAME,
    async () => {
      const agora = new Date()

      const pendentes = await db
        .select({
          consultaId: consultasInicio.id,
          tokenId: consultasInicio.tokenId,
          linkExpiresAt: consultasInicio.linkExpiresAt,
          patientEmail: accessTokens.patientEmail,
          precadNome: precadastros.nomeEncrypted,
          precadTelefone: precadastros.telefoneEncrypted,
        })
        .from(consultasInicio)
        .leftJoin(accessTokens, eq(accessTokens.id, consultasInicio.tokenId))
        .leftJoin(precadastros, eq(precadastros.accessTokenId, consultasInicio.tokenId))
        .where(
          and(
            eq(consultasInicio.status, 'aguardando_upload'),
            gt(consultasInicio.linkExpiresAt!, agora),
          ),
        )

      for (const p of pendentes) {
        if (!p.patientEmail || !p.tokenId) continue

        const nome = p.precadNome ? decrypt(p.precadNome).split(' ')[0] : 'Paciente'

        let linkLembrete: string
        let codigoLembrete: string
        try {
          const raw = generateToken()
          await db.update(accessTokens)
            .set({ tokenHash: hashToken(raw) })
            .where(eq(accessTokens.id, p.tokenId))
          linkLembrete = `${env.APP_URL}/acesso/${raw}`
          codigoLembrete = raw
        } catch (e) {
          logger.warn('[lembreteQueue] falha ao regenerar token', { tokenId: p.tokenId, error: String(e) })
          continue
        }

        await enviarLinkAcessoIntake(p.patientEmail, nome, linkLembrete, p.linkExpiresAt!, codigoLembrete).catch((e: unknown) => logger.warn('[lembreteQueue] notificação falhou', { error: String(e) }))

        if (p.precadTelefone) {
          const telefone = decrypt(p.precadTelefone)
          const msg =
            `Olá ${nome}! Estamos aguardando o envio do seu exame de HIV para dar continuidade ao atendimento PrEP.\n\n` +
            `Acesse o formulário e envie o exame:\n${linkLembrete}\n\n` +
            `Ou cole o código no site facilitaprep.com.br:\n*${codigoLembrete}*\n\n` +
            `Prazo: ${p.linkExpiresAt?.toLocaleDateString('pt-BR')}\n\n_Facilita PrEP_`
          await enviarWhatsApp(telefone, msg).catch((e: unknown) => logger.warn('[lembreteQueue] notificação falhou', { error: String(e) }))
        }

        await db.update(consultasInicio)
          .set({ ultimoLembreteAt: agora })
          .where(eq(consultasInicio.id, p.consultaId))
      }

      return { enviados: pendentes.length }
    },
    { connection, ...LEMBRETE_WORKER_OPTS, prefix: QUEUE_PREFIX },
  )

  worker.on('failed', (job, err) => {
    logger.error(`[lembreteQueue] Job ${job?.id} falhou`, { message: err.message })
    if ((job?.attemptsMade ?? 0) >= (job?.opts?.attempts ?? 3)) {
      void persistDlq(LEMBRETE_QUEUE_NAME, job, err)
    }
  })

  return worker
}
