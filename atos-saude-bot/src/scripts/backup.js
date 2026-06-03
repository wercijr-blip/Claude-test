import { createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, unlinkSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { pipeline } from 'stream/promises'
import { createGzip } from 'zlib'
import { fileURLToPath } from 'url'
import { logger } from '../utils/logger.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR   = process.env.DATA_DIR || join(__dirname, '../..')
const DB_PATH    = process.env.DB_PATH  || join(DATA_DIR, 'atos-saude.db')
const BACKUP_DIR = join(DATA_DIR, 'backups')
const MAX_BACKUPS = 7

async function uploadToS3(filePath, key) {
  const bucket = process.env.AWS_BACKUP_BUCKET
  if (!bucket) return false

  try {
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3')
    const { createReadStream: crs } = await import('fs')
    const { statSync: ss } = await import('fs')

    const client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      ...(process.env.AWS_ACCESS_KEY_ID && {
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        }
      })
    })

    const fileSize = ss(filePath).size
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: crs(filePath),
      ContentType: 'application/gzip',
      ContentLength: fileSize,
      ServerSideEncryption: 'AES256',
      Metadata: {
        'backup-date': new Date().toISOString(),
        'source': 'atos-saude-bot'
      }
    }))
    return true
  } catch (err) {
    logger.warn({ err: err.message, key }, 'Upload S3 falhou — backup local disponível')
    return false
  }
}

async function alertAdmin(message) {
  const adminPhone = process.env.ADMIN_PHONE
  if (!adminPhone) return
  try {
    const { sendText } = await import('../services/whatsapp.js')
    await sendText(adminPhone, `⚠️ *Alerta Atos Saúde Bot*\n${message}`)
  } catch {}
}

export async function runBackup() {
  if (!existsSync(DB_PATH)) {
    const warn = `Backup ignorado — arquivo de banco não encontrado: ${DB_PATH}`
    logger.warn({ dbPath: DB_PATH }, warn)
    await alertAdmin(warn)
    return
  }
  if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true })

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const filename = `atos-saude-${ts}.db.gz`
  const dest = join(BACKUP_DIR, filename)

  try {
    await pipeline(
      createReadStream(DB_PATH),
      createGzip({ level: 6 }),
      createWriteStream(dest)
    )
  } catch (err) {
    logger.error({ err: err.message }, 'Falha ao criar backup local')
    await alertAdmin(`Falha no backup local: ${err.message}`)
    throw err
  }
  logger.info({ dest }, 'Backup diário concluído')

  // Upload offsite para S3 (opcional — requer AWS_BACKUP_BUCKET)
  if (process.env.AWS_BACKUP_BUCKET) {
    const s3Key = `backups/${filename}`
    const uploaded = await uploadToS3(dest, s3Key)
    if (uploaded) {
      logger.info({ bucket: process.env.AWS_BACKUP_BUCKET, key: s3Key }, 'Backup enviado ao S3')
    }
  }

  // Mantém apenas os últimos MAX_BACKUPS arquivos locais
  const files = readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith('.db.gz'))
    .map(f => ({ name: f, mtime: statSync(join(BACKUP_DIR, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)

  for (const { name } of files.slice(MAX_BACKUPS)) {
    unlinkSync(join(BACKUP_DIR, name))
    logger.info({ file: name }, 'Backup antigo removido')
  }
}
