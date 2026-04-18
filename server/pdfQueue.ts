import { Queue, Worker } from 'bullmq'
import IORedis from 'ioredis'
import { env } from './_core/env.ts'
import { db } from './db.ts'
import { pacientes, pdfs, consultasInicio, accessTokens, precadastros } from '../drizzle/schema.ts'
import { eq, and, gt, isNull } from 'drizzle-orm'
import { decrypt } from './_core/encryption.ts'
import { gerarPrescricaoPdf, assinarPdf } from './pdfSigner.ts'
import { uploadBuffer } from './storage.ts'
import { enviarLinkAcessoIntake } from './email.ts'
import { enviarWhatsApp } from './whatsapp.ts'

export const PDF_QUEUE_NAME = 'pdf-generation'
export const LEMBRETE_QUEUE_NAME = 'lembrete-exame'

const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null })

export const pdfQueue = new Queue(PDF_QUEUE_NAME, { connection })
export const lembreteQueue = new Queue(LEMBRETE_QUEUE_NAME, { connection })

export function startPdfWorker() {
  const worker = new Worker(
    PDF_QUEUE_NAME,
    async (job) => {
      const { pacienteId } = job.data as { pacienteId: number }

      const [p] = await db.select().from(pacientes).where(eq(pacientes.id, pacienteId)).limit(1)
      if (!p) throw new Error(`Paciente ${pacienteId} não encontrado`)

      const pacienteDecrypted = {
        ...p,
        nome: decrypt(p.nomeEncrypted),
        dataNascimento: p.dataNascimentoEncrypted ? decrypt(p.dataNascimentoEncrypted) : null,
      }

      const pdfBuffer = await gerarPrescricaoPdf(pacienteDecrypted)
      const { buffer: signedBuffer, certificadoSerial, assinadoEm } = await assinarPdf(pdfBuffer)

      const s3Key = `pdfs/${pacienteId}/${Date.now()}-prescricao.pdf`
      await uploadBuffer(s3Key, signedBuffer, 'application/pdf')

      await db.insert(pdfs).values({ pacienteId, s3Key, tipo: 'prescricao', certificadoSerial, assinadoEm })

      return { s3Key }
    },
    { connection, concurrency: 3 },
  )

  worker.on('failed', (job, err) => {
    console.error(`[pdfQueue] Job ${job?.id} falhou:`, err.message)
  })

  return worker
}

export function startLembreteWorker() {
  const worker = new Worker(
    LEMBRETE_QUEUE_NAME,
    async () => {
      const agora = new Date()

      // Buscar todas as consultas aguardando upload dentro do prazo
      const pendentes = await db
        .select({
          consultaId: consultasInicio.id,
          tokenId: consultasInicio.tokenId,
          linkExpiresAt: consultasInicio.linkExpiresAt,
          ultimoLembrete: consultasInicio.ultimoLembreteAt,
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
        if (!p.patientEmail) continue

        const nome = p.precadNome ? decrypt(p.precadNome).split(' ')[0] : 'Paciente'
        const linkBase = `${env.APP_URL}/inicio`

        await enviarLinkAcessoIntake(p.patientEmail, nome, linkBase, p.linkExpiresAt!).catch(console.error)

        if (p.precadTelefone) {
          const telefone = decrypt(p.precadTelefone)
          const msg =
            `Olá ${nome}! Estamos aguardando o envio do seu exame de HIV para dar continuidade ao atendimento PrEP.\n\n` +
            `Acesse o formulário e envie o exame: ${linkBase}\n\n` +
            `Prazo: ${p.linkExpiresAt?.toLocaleDateString('pt-BR')}\n\n_Facilita PrEP_`
          await enviarWhatsApp(telefone, msg).catch(console.error)
        }

        await db.update(consultasInicio)
          .set({ ultimoLembreteAt: agora })
          .where(eq(consultasInicio.id, p.consultaId))
      }

      return { enviados: pendentes.length }
    },
    { connection },
  )

  worker.on('failed', (job, err) => {
    console.error(`[lembreteQueue] Job ${job?.id} falhou:`, err.message)
  })

  return worker
}

export async function agendarLembreteDiario() {
  // Rodar todo dia às 08:00 horário de Brasília (11:00 UTC)
  await lembreteQueue.add('lembrete-diario', {}, {
    repeat: { pattern: '0 11 * * *' },
    jobId: 'lembrete-diario-fixo',
  })
}

export async function enqueueGerarPdf(pacienteId: number) {
  return pdfQueue.add('gerar', { pacienteId }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  })
}
