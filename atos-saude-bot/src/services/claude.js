import Anthropic from '@anthropic-ai/sdk'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { searchKnowledge } from './knowledge.js'
import { insertAuthQuery } from './db.js'
import { logger } from '../utils/logger.js'
import { withRetry } from '../utils/retry.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

let client = null
function getClient() {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY não configurada')
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 25_000 })
  }
  return client
}

const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001'

// Carregado uma vez — evita leitura de disco em cada requisição
const SYSTEM_PROMPT_TEMPLATE = readFileSync(
  join(__dirname, '../config/system-prompt.txt'),
  'utf-8'
)

export async function answerAuthorizationQuestion(phone, question) {
  const context = searchKnowledge(question)

  if (!context.trim()) {
    await insertAuthQuery({ phone, question, answer: null, confidence: 'LOW' })
    return { answer: null, confidence: 'LOW' }
  }

  const systemPrompt = SYSTEM_PROMPT_TEMPLATE.replace('{context}', context)

  try {
    const response = await withRetry(
      () => getClient().messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 400,
        system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: question }]
      }),
      { attempts: 3, baseDelayMs: 1000 }
    )

    const answer = response.content[0]?.text?.trim() || 'NAO_SEI'

    if (answer === 'NAO_SEI') {
      await insertAuthQuery({ phone, question, answer: null, confidence: 'LOW' })
      return { answer: null, confidence: 'LOW' }
    }

    await insertAuthQuery({ phone, question, answer, confidence: 'HIGH' })
    return { answer, confidence: 'HIGH' }
  } catch (err) {
    logger.error({ err: err.message }, 'Erro ao consultar Claude API')
    await insertAuthQuery({ phone, question, answer: null, confidence: 'LOW' })
    return { answer: null, confidence: 'LOW' }
  }
}

