import { createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, unlinkSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { pipeline } from 'stream/promises'
import { createGzip } from 'zlib'
import { fileURLToPath } from 'url'
import { logger } from '../utils/logger.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.DATA_DIR || join(__dirname, '../..')
const DB_PATH   = process.env.DB_PATH  || join(DATA_DIR, 'atos-saude.db')
const BACKUP_DIR = join(DATA_DIR, 'backups')
const MAX_BACKUPS = 7

export async function runBackup() {
  if (!existsSync(DB_PATH)) {
    logger.warn({ dbPath: DB_PATH }, 'Backup ignorado — arquivo de banco não encontrado')
    return
  }
  if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true })

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const dest = join(BACKUP_DIR, `atos-saude-${ts}.db.gz`)

  await pipeline(
    createReadStream(DB_PATH),
    createGzip({ level: 6 }),
    createWriteStream(dest)
  )
  logger.info({ dest }, 'Backup diário concluído')

  // Mantém apenas os últimos MAX_BACKUPS arquivos
  const files = readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith('.db.gz'))
    .map(f => ({ name: f, mtime: statSync(join(BACKUP_DIR, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)

  for (const { name } of files.slice(MAX_BACKUPS)) {
    unlinkSync(join(BACKUP_DIR, name))
    logger.info({ file: name }, 'Backup antigo removido')
  }
}
