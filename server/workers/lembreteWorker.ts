import { Worker } from 'bullmq'
import { sql } from 'drizzle-orm'
import { env } from '../_core/env.ts'
import { db } from '../db.ts'
import { consultasInicio, accessTokens, precadastros } from '../../drizzle/schema.ts'
import { eq, and, gt, lt } from 'drizzle-orm'
import { decrypt } from '../_core/encryption.ts'
import { enviarLinkAcessoIntake } from '../email.ts'
import { enviarWhatsApp } from '../whatsapp.ts'
import { generateToken, hashToken } from '../_core/tokenUtils.ts'
import { logger } from '../_core/logger.ts'
import { redis } from '../_core/redis.ts'
import * as Sentry from '@sentry/node'
import { LEMBRETE_QUEUE_NAME, QUEUE_PREFIX, connection, LEMBRETE_WORKER_OPTS, lembreteQueue, persistDlq } from './queues.ts'

export async function agendarLembreteDiario() {
  await lembreteQueue.add('lembrete-diario', {}, {
    repeat: { pattern: '0 11 * * *' },
    jobId: 'lembrete-diario-fixo',
  })
}

// Roda diariamente às 7h — valida conectividade dos recursos críticos
// e alerta via Sentry se qualquer serviço estiver degradado.
export async function agendarDrMensal() {
  await lembreteQueue.add('dr-mensal', {}, {
    repeat: { pattern: '0 7 * * *' },
    jobId: 'dr-mensal-fixo',
  })
}

async function executarDrMensal() {
  const checks: Record<string, boolean> = {}

  try {
    await db.execute(sql`SELECT 1`)
    checks.db = true
  } catch (err) {
    checks.db = false
    logger.error('[dr-mensal] DB inacessível', { error: String(err) })
    Sentry.captureException(err, { tags: { dr: 'db' } })
  }

  try {
    await redis.ping()
    checks.redis = true
  } catch (err) {
    checks.redis = false
    logger.error('[dr-mensal] Redis inacessível', { error: String(err) })
    Sentry.captureException(err, { tags: { dr: 'redis' } })
  }

  const allOk = Object.values(checks).every(Boolean)
  const level = allOk ? 'info' : 'error'
  logger[level]('[dr-mensal] resultado', { checks, allOk, timestamp: new Date().toISOString() })

  if (!allOk) {
    Sentry.captureMessage('[FacilitaPrEP] DR check mensal falhou', {
      level: 'error',
      extra: { checks, appUrl: env.APP_URL },
    })
  }

  return { checks, allOk }
}

export function startLembreteWorker() {
  const worker = new Worker(
    LEMBRETE_QUEUE_NAME,
    async (job) => {
      if (job.name === 'dr-mensal') return executarDrMensal()

      const agora = new Date()
      const tresDiasDepois = new Date(agora.getTime() + 3 * 24 * 60 * 60 * 1000)

      const pendentes = await db
        .select({
          consultaId: consultasInicio.id,
          tokenId: consultasInicio.tokenId,
          linkExpiresAt: consultasInicio.linkExpiresAt,
          ultimoLembreteAt: consultasInicio.ultimoLembreteAt,
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
            lt(consultasInicio.linkExpiresAt!, tresDiasDepois),
          ),
        )

      for (const p of pendentes) {
        // Skip if already reminded in the last 20 hours
        if (p.ultimoLembreteAt && agora.getTime() - p.ultimoLembreteAt.getTime() < 20 * 60 * 60 * 1000) continue

        const diasRestantes = Math.ceil((p.linkExpiresAt!.getTime() - agora.getTime()) / (24 * 60 * 60 * 1000))
        const isUrgente = diasRestantes <= 1

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
          const msg = isUrgente
            ? `⚠️ Olá ${nome}! Hoje é o último dia para enviar seu exame de HIV.\n\n` +
              `Acesse agora:\n${linkLembrete}\n\nCódigo: *${codigoLembrete}*\n\n_Facilita PrEP_`
            : `Olá ${nome}! Seu prazo para enviar o exame de HIV termina em ${diasRestantes} dia${diasRestantes > 1 ? 's' : ''}.\n\n` +
              `Acesse o formulário:\n${linkLembrete}\n\nCódigo: *${codigoLembrete}*\n\n` +
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
