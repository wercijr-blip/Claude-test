import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MESSAGES_PATH = join(__dirname, '../config/messages.json')

// Lê o arquivo a cada chamada para permitir edição em produção sem reiniciar
function load() {
  return JSON.parse(readFileSync(MESSAGES_PATH, 'utf-8'))
}

/**
 * Retorna a mensagem com as variáveis substituídas.
 * Uso: msg('lembrete_24h', { nome: 'João', medico: 'Dr. Werciley', ... })
 */
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
