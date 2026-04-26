import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const staticContent = JSON.parse(
  readFileSync(join(__dirname, '../config/static-content.json'), 'utf-8')
)

export function isValidName(text) {
  if (!text || typeof text !== 'string') return false
  const trimmed = text.trim()
  const words = trimmed.split(/\s+/).filter(w => w.length > 0)
  if (words.length < 2) return false
  return /^[a-zA-ZÀ-ÿ\s]+$/.test(trimmed)
}

export function isValidDate(text) {
  if (!text) return false
  const match = text.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return false
  const [, day, month, year] = match.map(Number)
  if (month < 1 || month > 12) return false
  if (day < 1 || day > 31) return false
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return false
  const now = new Date()
  const age = (now - date) / (365.25 * 24 * 60 * 60 * 1000)
  return age >= 0 && age <= 120
}

export function cleanPhone(text) {
  if (!text) return ''
  return text.replace(/[\s\-\(\)\+]/g, '')
}

export function isValidPhone(text) {
  const cleaned = cleanPhone(text)
  return /^[1-9]{2}[2-9]\d{7,8}$/.test(cleaned)
}

export function isQuestion(text) {
  if (!text) return false
  const lower = text.trim().toLowerCase()
  if (lower.includes('?')) return true
  const interrogativeStarts = ['como', 'quando', 'onde', 'qual', 'quais', 'quanto', 'quantos', 'quem', 'por que', 'porque', 'tem', 'aceita', 'aceitar', 'cobre', 'cobrir', 'precisa', 'preciso', 'é necessário', 'posso', 'pode', 'consegue']
  return interrogativeStarts.some(w => lower.startsWith(w))
}

export function isRestartKeyword(text) {
  if (!text) return false
  const lower = text.trim().toLowerCase()
  const keywords = ['oi', 'olá', 'ola', 'menu', 'inicio', 'início', 'reiniciar', 'novo', 'voltar', 'começar', 'comecar', 'start', 'ajuda', 'help']
  return keywords.includes(lower)
}

export function checkConvenio(name) {
  if (!name) return false
  const normalized = name.trim().toUpperCase()
  return staticContent.convenios.some(c => {
    const cn = c.toUpperCase()
    return cn.includes(normalized) || normalized.includes(cn.split(' ')[0])
  })
}
