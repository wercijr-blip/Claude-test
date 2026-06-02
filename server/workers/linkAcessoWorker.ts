import { Worker } from 'bullmq'
import { enviarLinkAcessoIntake, type PagamentoMeta } from '../email.ts'
import { enviarWhatsApp } from '../whatsapp.ts'
import { logger } from '../_core/logger.ts'
import {
  LINK_ACESSO_QUEUE_NAME, QUEUE_PREFIX, connection, SHARED_WORKER_SETTINGS,
  linkAcessoQueue, persistDlq,
} from './queues.ts'

export async function enqueueEnviarLinkAcesso(
  email: string,
  nome: string,
  telefone: string | null,
  link: string,
  expiresAt: Date,
  codigo: string,
  pagamento?: PagamentoMeta,
) {
  if (!codigo) throw new Error('enqueueEnviarLinkAcesso: codigo vazio — abortando para não enviar link inacessível')
  if (!link.includes('/acesso/')) throw new Error(`enqueueEnviarLinkAcesso: link sem token de acesso — link="${link}"`)

  return linkAcessoQueue.add(
    'enviar-link',
    {
      email, nome, telefone, link, expiresAt: expiresAt.toISOString(), codigo,
      pagamento: pagamento
        ? { ...pagamento, dataHora: pagamento.dataHora.toISOString() }
        : undefined,
    },
    { attempts: 5, backoff: { type: 'exponential', delay: 10_000 } },
  )
}

export function startLinkAcessoWorker() {
  const worker = new Worker(
    LINK_ACESSO_QUEUE_NAME,
    async (job) => {
      const { email, nome, telefone, link, expiresAt, codigo, pagamento: pagamentoRaw } = job.data as {
        email: string
        nome: string
        telefone: string | null
        link: string
        expiresAt: string
        codigo: string
        pagamento?: { valorCentavos: number; formaPagamento: string; dataHora: string; idTransacao: string }
      }

      if (!codigo) throw new Error(`[linkAcessoWorker] job ${job.id}: codigo vazio — não enviar`)
      if (!link.includes('/acesso/')) throw new Error(`[linkAcessoWorker] job ${job.id}: link sem token — link="${link}"`)

      const primeiroNome = nome.split(' ')[0]
      const expires = new Date(expiresAt)
      const pagamento: PagamentoMeta | undefined = pagamentoRaw
        ? { ...pagamentoRaw, dataHora: new Date(pagamentoRaw.dataHora) }
        : undefined

      await enviarLinkAcessoIntake(email, nome, link, expires, codigo, pagamento)

      if (telefone) {
        const msg =
          `Olá ${primeiroNome}! Seu acesso ao formulário PrEP está liberado.\n\n` +
          `Acesse o link abaixo para continuar:\n${link}\n\n` +
          `Ou cole o código abaixo no site facilitaprep.com.br:\n*${codigo}*\n\n` +
          `Válido até ${expires.toLocaleDateString('pt-BR')}.\n\n_Facilita PrEP_`
        await enviarWhatsApp(telefone, msg).catch((e: unknown) => logger.warn('[linkAcessoQueue] notificação falhou', { error: String(e) }))
      }
    },
    { connection, ...SHARED_WORKER_SETTINGS, drainDelay: 15, prefix: QUEUE_PREFIX },
  )

  worker.on('failed', (job, err) => {
    logger.error(`[linkAcessoQueue] Job ${job?.id} falhou (${job?.attemptsMade} tentativas)`, { message: err.message })
    if ((job?.attemptsMade ?? 0) >= (job?.opts?.attempts ?? 5)) {
      void persistDlq(LINK_ACESSO_QUEUE_NAME, job, err)
    }
  })

  return worker
}
