import { randomUUID } from 'crypto'
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  GetBucketLifecycleConfigurationCommand,
  PutBucketLifecycleConfigurationCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import multer from 'multer'
import { fileTypeFromBuffer } from 'file-type'
import type { Request, Response } from 'express'
import { env } from './_core/env.ts'
import { logger } from './_core/logger.ts'
import { db } from './db.ts'
import { exames, pacientes } from '../drizzle/schema.ts'
import { eq, and } from 'drizzle-orm'
import { MAX_UPLOAD_SIZE_BYTES, ALLOWED_MIME_TYPES } from '../shared/security-constants.ts'
import { enqueueAnalisarExame } from './examQueue.ts'
import { createContext } from './_core/context.ts'

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
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

// ── S3 Lifecycle ─────────────────────────────────────────────────────
//
// Os exames anexados pelo paciente (prefix `exames-inicio/`) servem
// apenas para a análise por IA + revisão médica — após processamento,
// os dados extraídos (resultadoHivValidado, dataExameValidado) ficam no
// banco em texto. O arquivo bruto não tem valor permanente e expira em
// 30 dias por princípio de minimização de dados (LGPD art. 6º, III).
//
// Outros prefixes (`pdfs/`, `pedidos/`, `intake/documentos/`) são
// documentos médicos com retenção legal de 20 anos (CFM 2.218/2018) e
// NÃO entram nesta regra.
const LIFECYCLE_RULE_ID = 'expire-exames-inicio-30d'
const EXAMES_RETENTION_DAYS = 30

export async function ensureS3Lifecycle(): Promise<void> {
  const bucket = env.AWS_S3_BUCKET

  // Idempotente: se a regra já existe com mesmo ID, não faz nada.
  try {
    const current = await s3.send(new GetBucketLifecycleConfigurationCommand({ Bucket: bucket }))
    const exists = current.Rules?.some((r) => r.ID === LIFECYCLE_RULE_ID)
    if (exists) {
      logger.info('[ensureS3Lifecycle] Regra já configurada', {
        bucket,
        rule: LIFECYCLE_RULE_ID,
      })
      return
    }
  } catch (err) {
    const code = (err as { name?: string; Code?: string }).name
      ?? (err as { Code?: string }).Code

    if (code === 'NoSuchLifecycleConfiguration') {
      // Esperado quando o bucket ainda não tem nenhuma regra — seguimos para criar.
    } else if (code === 'AccessDenied' || code === 'InvalidAccessKeyId') {
      // Sem permissão para ler o lifecycle — tentamos criar mesmo assim,
      // e o erro de criação abaixo dará as instruções completas.
      logger.warn('[ensureS3Lifecycle] Sem permissão para consultar lifecycle (tentando criar)', {
        bucket,
        rule: LIFECYCLE_RULE_ID,
        errorCode: code,
        errorMessage: (err as { message?: string }).message ?? String(err),
      })
    } else {
      logger.error('[ensureS3Lifecycle] Erro inesperado ao consultar lifecycle (tentando criar)', {
        bucket,
        rule: LIFECYCLE_RULE_ID,
        errorCode: code ?? 'unknown',
        errorMessage: (err as { message?: string }).message ?? String(err),
      })
    }
  }

  try {
    await s3.send(new PutBucketLifecycleConfigurationCommand({
      Bucket: bucket,
      LifecycleConfiguration: {
        Rules: [{
          ID: LIFECYCLE_RULE_ID,
          Status: 'Enabled',
          Filter: { Prefix: 'exames-inicio/' },
          Expiration: { Days: EXAMES_RETENTION_DAYS },
        }],
      },
    }))
    logger.info('[ensureS3Lifecycle] Regra criada — exames-inicio/ expira em 30 dias', {
      bucket,
      rule: LIFECYCLE_RULE_ID,
    })
  } catch (err) {
    // Falta de permissão IAM (s3:PutLifecycleConfiguration) é o caso
    // mais comum de falha aqui. Não derrubamos o boot — o admin pode
    // configurar manualmente no console da AWS.
    const code = (err as { name?: string; Code?: string }).name
      ?? (err as { Code?: string }).Code
    const message = (err as { message?: string }).message ?? String(err)

    logger.error(
      [
        '[ensureS3Lifecycle] ERROR: Falha ao criar lifecycle rule',
        `Bucket: ${bucket}`,
        `Rule ID: ${LIFECYCLE_RULE_ID}`,
        `Error: ${code ?? 'unknown'} — ${message}`,
        '',
        'Para configurar manualmente no AWS Console:',
        `1. Vá para: https://s3.console.aws.amazon.com/s3/buckets/${bucket}`,
        '2. Clique em "Management" → "Lifecycle rules"',
        '3. Clique em "Create lifecycle rule"',
        `4. Nome: ${LIFECYCLE_RULE_ID}`,
        '5. Escopo: Prefix "exames-inicio/"',
        '6. Ações: Expiration → 30 dias',
        '7. Salve',
        '',
        'Ou via AWS CLI:',
        `aws s3api put-bucket-lifecycle-configuration \\`,
        `  --bucket ${bucket} \\`,
        '  --lifecycle-configuration file://lifecycle.json',
        '',
        'Onde lifecycle.json contém:',
        JSON.stringify({
          Rules: [{
            ID: LIFECYCLE_RULE_ID,
            Status: 'Enabled',
            Filter: { Prefix: 'exames-inicio/' },
            Expiration: { Days: EXAMES_RETENTION_DAYS },
          }],
        }, null, 2),
        '',
        'Motivo: imagens de exames devem ser excluídas após 30 dias',
        '(LGPD art. 6º, III — princípio da minimização de dados).',
      ].join('\n'),
      { bucket, rule: LIFECYCLE_RULE_ID, errorCode: code ?? 'unknown', errorMessage: message },
    )
  }
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

      const tipo = req.body.tipo as string | undefined

      // Validate actual file magic bytes — don't trust client-supplied mimetype
      const detected = await fileTypeFromBuffer(req.file.buffer)
      const detectedMime = detected?.mime ?? null
      if (!detectedMime || !(ALLOWED_MIME_TYPES as readonly string[]).includes(detectedMime)) {
        res.status(400).json({ error: 'Tipo de arquivo não permitido' })
        resolve()
        return
      }
      // Use the verified mime type for all downstream operations
      req.file.mimetype = detectedMime

      // documento_intake: pré-cadastro (carteirinha/RG do plano) — sem sessão.
      // Apenas rate-limit (uploadLimiter) e validação de magic bytes protegem.
      if (tipo === 'documento_intake') {
        const ext = MIME_TO_EXT[req.file.mimetype] ?? 'bin'
        const s3Key = `intake/documentos/${randomUUID()}.${ext}`
        try {
          await uploadBuffer(s3Key, req.file.buffer, req.file.mimetype)
          res.json({ ok: true, s3Key })
        } catch (err) {
          logger.error(`[storage] Erro no upload (documento_intake)`, err)
          res.status(500).json({ error: 'Erro ao salvar arquivo' })
        }
        resolve()
        return
      }

      // Demais tipos exigem sessão de paciente válida.
      const ctx = await createContext({ req })
      if (!ctx.session || ctx.session.type !== 'patient') {
        res.status(401).json({ error: 'Sessão inválida' })
        resolve()
        return
      }

      // Uploads que não exigem pacienteId — só s3Key (sem insert no DB)
      if (tipo === 'exame_hiv') {
        const ext = MIME_TO_EXT[req.file.mimetype] ?? 'bin'
        const s3Key = `exames-inicio/${randomUUID()}.${ext}`
        try {
          await uploadBuffer(s3Key, req.file.buffer, req.file.mimetype)
          res.json({ ok: true, s3Key })
        } catch (err) {
          logger.error(`[storage] Erro no upload (exame_hiv)`, err)
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

      const [owned] = await db
        .select({ id: pacientes.id })
        .from(pacientes)
        .where(and(eq(pacientes.id, pacienteId), eq(pacientes.tokenId, ctx.session.tokenId)))
        .limit(1)

      if (!owned) {
        res.status(403).json({ error: 'Acesso negado' })
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
          logger.error(`[storage] Falha ao enfileirar análise do exame ${exameId}`, queueErr)
        })

        res.json({ ok: true, s3Key })
      } catch (uploadErr) {
        logger.error('[storage] Erro no upload', uploadErr)
        res.status(500).json({ error: 'Erro ao salvar arquivo' })
      }

      resolve()
    })
  })
}
