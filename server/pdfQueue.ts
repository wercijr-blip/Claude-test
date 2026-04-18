import { Queue, Worker } from 'bullmq'
import IORedis from 'ioredis'
import { env } from './_core/env.ts'
import { db } from './db.ts'
import { pacientes, pdfs } from '../drizzle/schema.ts'
import { eq } from 'drizzle-orm'
import { decrypt } from './_core/encryption.ts'
import { gerarPrescricaoPdf, assinarPdf } from './pdfSigner.ts'
import { uploadBuffer } from './storage.ts'

export const PDF_QUEUE_NAME = 'pdf-generation'

const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null })

export const pdfQueue = new Queue(PDF_QUEUE_NAME, { connection })

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

      // Gerar PDF
      const pdfBuffer = await gerarPrescricaoPdf(pacienteDecrypted)

      // Assinar com ICP-Brasil
      const { buffer: signedBuffer, certificadoSerial, assinadoEm } = await assinarPdf(pdfBuffer)

      // Upload para S3
      const s3Key = `pdfs/${pacienteId}/${Date.now()}-prescricao.pdf`
      await uploadBuffer(s3Key, signedBuffer, 'application/pdf')

      // Registrar no banco
      await db.insert(pdfs).values({
        pacienteId,
        s3Key,
        tipo: 'prescricao',
        certificadoSerial,
        assinadoEm,
      })

      return { s3Key }
    },
    { connection, concurrency: 3 },
  )

  worker.on('failed', (job, err) => {
    console.error(`[pdfQueue] Job ${job?.id} falhou:`, err.message)
  })

  return worker
}

export async function enqueueGerarPdf(pacienteId: number) {
  return pdfQueue.add('gerar', { pacienteId }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  })
}
