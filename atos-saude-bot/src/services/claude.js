import Anthropic from '@anthropic-ai/sdk'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { searchKnowledge } from './knowledge.js'
import { insertAuthQuery } from './db.js'
import { logger } from '../utils/logger.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

let client = null
function getClient() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return client
}

export async function answerAuthorizationQuestion(phone, question) {
  const context = searchKnowledge(question)

  if (!context.trim()) {
    await insertAuthQuery({ phone, question, answer: null, confidence: 'LOW' })
    return { answer: null, confidence: 'LOW' }
  }

  const systemPromptTemplate = readFileSync(
    join(__dirname, '../config/system-prompt.txt'),
    'utf-8'
  )
  const systemPrompt = systemPromptTemplate.replace('{context}', context)

  try {
    const response = await getClient().messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 400,
      system: systemPrompt,
      messages: [{ role: 'user', content: question }]
    })

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
