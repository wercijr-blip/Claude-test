import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MESSAGES_PATH = join(__dirname, '../config/messages.json')
const CACHE_TTL_MS = 5000

let _cache = null
let _cacheAt = 0

function load() {
  const now = Date.now()
  if (!_cache || now - _cacheAt > CACHE_TTL_MS) {
    _cache = JSON.parse(readFileSync(MESSAGES_PATH, 'utf-8'))
    _cacheAt = now
  }
  return _cache
}

export function invalidateCache() {
  _cache = null
}

export function msg(chave, vars = {}) {
  const msgs = load()
  let texto = msgs[chave] ?? `[mensagem '${chave}' não encontrada]`
  for (const [k, v] of Object.entries(vars)) {
    texto = texto.replaceAll(`{${k}}`, v ?? '')
  }
  return texto
}

export function getMensagens() {
  return load()
}
