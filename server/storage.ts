import { randomUUID } from 'crypto'
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import multer from 'multer'
import type { Request, Response } from 'express'
import { env } from './_core/env.ts'
import { db } from './db.ts'
import { exames } from '../drizzle/schema.ts'
import { MAX_UPLOAD_SIZE_BYTES, ALLOWED_MIME_TYPES } from '../shared/security-constants.ts'
import { enqueueAnalisarExame } from './examQueue.ts'

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}

const s3 = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
})

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if ((ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Tipo de arquivo não permitido'))
    }
  },
})

export async function uploadBuffer(key: string, buffer: Buffer, contentType: string): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ServerSideEncryption: 'AES256',
    }),
  )
}

export async function getBuffer(key: string): Promise<Buffer> {
  const res = await s3.send(new GetObjectCommand({ Bucket: env.AWS_S3_BUCKET, Key: key }))
  const chunks: Uint8Array[] = []
  for await (const chunk of res.Body as AsyncIterable<Uint8Array>) chunks.push(chunk)
  return Buffer.concat(chunks)
}

export async function getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: env.AWS_S3_BUCKET, Key: key }), { expiresIn })
}

export async function deleteObject(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: env.AWS_S3_BUCKET, Key: key }))
}

// Handler de upload de exames (usado pelo Express diretamente)
export function uploadExame(req: Request, res: Response): Promise<void> {
  return new Promise((resolve) => {
    upload.single('file')(req, res, async (err) => {
      if (err) {
        res.status(400).json({ error: err.message })
        resolve()
        return
      }

      if (!req.file) {
        res.status(400).json({ error: 'Nenhum arquivo enviado' })
        resolve()
        return
      }

      // Uploads that don't require a pacienteId — returns s3Key only (no DB insert)
      const unauthTypes: Record<string, string> = {
        'documento_intake': 'intake/documentos',
        'exame_hiv': 'exames-inicio',
      }
      const unauthFolder = unauthTypes[req.body.tipo as string]
      if (unauthFolder) {
        const ext = MIME_TO_EXT[req.file.mimetype] ?? 'bin'
        const s3Key = `${unauthFolder}/${randomUUID()}.${ext}`
        try {
          await uploadBuffer(s3Key, req.file.buffer, req.file.mimetype)
          res.json({ ok: true, s3Key })
        } catch (err) {
          console.error(`[storage] Erro no upload (${req.body.tipo}):`, err)
          res.status(500).json({ error: 'Erro ao salvar arquivo' })
        }
        resolve()
        return
      }

      const pacienteId = parseInt(req.body.pacienteId as string)
      const tipoExame = req.body.tipoExame as string

      if (isNaN(pacienteId)) {
        res.status(400).json({ error: 'pacienteId inválido' })
        resolve()
        return
      }

      const ext = MIME_TO_EXT[req.file.mimetype] ?? 'bin'
      const s3Key = `exames/${pacienteId}/${randomUUID()}.${ext}`

      try {
        await uploadBuffer(s3Key, req.file.buffer, req.file.mimetype)

        const [inserted] = await db.insert(exames).values({
          pacienteId,
          s3Key,
          nomeArquivo: req.file.originalname,
          tipoExame,
          mimeType: req.file.mimetype,
          tamanhoBytes: req.file.size,
        })

        // Queue async AI analysis — returns immediately, analysis runs in background
        const exameId = inserted.insertId
        await enqueueAnalisarExame(exameId).catch((queueErr) => {
          // Non-fatal: log and continue. Exam is saved; analysis can be retried manually.
          console.error(`[storage] Falha ao enfileirar análise do exame ${exameId}:`, queueErr)
        })

        res.json({ ok: true, s3Key })
      } catch (uploadErr) {
        console.error('[storage] Erro no upload:', uploadErr)
        res.status(500).json({ error: 'Erro ao salvar arquivo' })
      }

      resolve()
    })
  })
}
