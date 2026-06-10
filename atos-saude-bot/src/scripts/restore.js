#!/usr/bin/env node
/**
 * Restaura o banco de dados a partir de um backup gzip.
 *
 * Uso:
 *   node src/scripts/restore.js --list           # lista backups disponíveis
 *   node src/scripts/restore.js                  # restaura o mais recente
 *   node src/scripts/restore.js <arquivo.db.gz>  # restaura arquivo específico
 *
 * ATENÇÃO: pare o servidor antes de restaurar.
 */
import 'dotenv/config'
import { createReadStream, createWriteStream, existsSync, readdirSync, statSync, renameSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { pipeline } from 'stream/promises'
import { createGunzip } from 'zlib'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR   = process.env.DATA_DIR || join(__dirname, '../..')
const DB_PATH    = process.env.DB_PATH  || join(DATA_DIR, 'atos-saude.db')
const BACKUP_DIR = join(DATA_DIR, 'backups')

function listBackups() {
  if (!existsSync(BACKUP_DIR)) return []
  return readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith('.db.gz'))
    .map(f => ({ name: f, path: join(BACKUP_DIR, f), mtime: statSync(join(BACKUP_DIR, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
}

async function verifyIntegrity(dbPath) {
  const { default: Database } = await import('better-sqlite3')
  const testDb = new Database(dbPath, { readonly: true })
  try {
    const result = testDb.prepare('PRAGMA integrity_check').get()
    return result?.integrity_check === 'ok'
  } finally {
    testDb.close()
  }
}

async function restore(backupPath) {
  if (!existsSync(backupPath)) {
    console.error('❌ Arquivo de backup não encontrado:', backupPath)
    process.exit(1)
  }

  const tmpPath = DB_PATH + '.tmp-restore'

  console.log('📦 Descomprimindo backup:', backupPath)
  await pipeline(
    createReadStream(backupPath),
    createGunzip(),
    createWriteStream(tmpPath)
  )

  console.log('🔍 Verificando integridade...')
  const ok = await verifyIntegrity(tmpPath)
  if (!ok) {
    console.error('❌ Verificação de integridade falhou — backup corrompido.')
    process.exit(1)
  }
  console.log('✅ Integridade OK')

  if (existsSync(DB_PATH)) {
    const emergencyBak = `${DB_PATH}.emergency-${Date.now()}`
    renameSync(DB_PATH, emergencyBak)
    console.log('💾 Banco atual salvo em:', emergencyBak)
  }

  renameSync(tmpPath, DB_PATH)
  console.log('✅ Banco de dados restaurado com sucesso!')
  console.log('   Caminho:', DB_PATH)
  console.log('\n⚠️  Inicie o servidor novamente para aplicar as migrations.')
}

// ─── Main ────────────────────────────────────────────────────────────────────

const arg = process.argv[2]

if (arg === '--list') {
  const backups = listBackups()
  if (backups.length === 0) {
    console.log('Nenhum backup encontrado em', BACKUP_DIR)
  } else {
    console.log(`\nBackups disponíveis em ${BACKUP_DIR}:\n`)
    backups.forEach((b, i) => {
      const date = new Date(b.mtime).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
      const label = i === 0 ? ' ← mais recente' : ''
      console.log(`  ${b.name}  (${date})${label}`)
    })
    console.log()
  }
  process.exit(0)
}

let targetPath
if (!arg) {
  const backups = listBackups()
  if (backups.length === 0) {
    console.error('❌ Nenhum backup encontrado. Execute o backup primeiro:')
    console.error('   node src/scripts/backup.js')
    process.exit(1)
  }
  targetPath = backups[0].path
  console.log('ℹ️  Usando backup mais recente:', backups[0].name)
} else {
  targetPath = arg.startsWith('/') ? arg : join(BACKUP_DIR, arg)
}

console.log('\n⚠️  ATENÇÃO: O servidor deve estar PARADO antes de prosseguir!')
console.log('   Banco de destino:', DB_PATH)
console.log()

await restore(targetPath)
