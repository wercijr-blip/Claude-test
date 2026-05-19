import { z } from 'zod'
import { env } from './_core/env.ts'
import { logger } from './_core/logger.ts'
import { redis } from './_core/redis.ts'
import { db } from './db.ts'
import { exames } from '../drizzle/schema.ts'
import { eq } from 'drizzle-orm'
import { getPresignedUrl } from './storage.ts'
import type { ResultadoIa } from '../shared/types.ts'

const MAX_DAILY_LLM_CALLS = env.LLM_DAILY_LIMIT ?? 200

async function checkDailyLimit(): Promise<void> {
  const key = `llm:daily:${new Date().toISOString().slice(0, 10)}`
  try {
    const count = await redis.incr(key)
    if (count === 1) await redis.expire(key, 90_000) // 25h TTL — survives day boundary
    if (count > MAX_DAILY_LLM_CALLS) {
      logger.warn('[llm] limite diário atingido', { count, limit: MAX_DAILY_LLM_CALLS, key })
      throw new Error(`Limite diário de análises por IA atingido (${MAX_DAILY_LLM_CALLS}/dia). Tente novamente amanhã.`)
    }
  } catch (err) {
    if ((err as Error).message.includes('Limite diário')) throw err
    logger.warn('[llm] Redis indisponível — ignorando limite diário', { error: String(err) })
  }
}

const iaResponseSchema = z.object({
  tipoExame: z.enum(['hiv', 'hepatite_b', 'hepatite_c', 'sifilis', 'creatinina', 'outro']),
  resultado: z.enum(['reagente', 'nao_reagente', 'inconclusivo', 'nao_identificado']),
  confianca: z.number().min(0).max(1),
  observacoes: z.string().optional(),
})

export async function analisarExame(exameId: number): Promise<ResultadoIa> {
  await checkDailyLimit()

  const [exame] = await db.select().from(exames).where(eq(exames.id, exameId)).limit(1)
  if (!exame) throw new Error(`Exame ${exameId} não encontrado`)

  const imageUrl = await getPresignedUrl(exame.s3Key, 300)

  const prompt = `Você é um assistente médico especializado em análise de exames laboratoriais.\nAnalise o resultado do exame na imagem e retorne um JSON com:\n- tipoExame: tipo do exame detectado (hiv, hepatite_b, hepatite_c, sifilis, creatinina, outro)\n- resultado: \"reagente\", \"nao_reagente\", \"inconclusivo\" ou \"nao_identificado\"\n- confianca: número de 0 a 1 indicando confiança na análise\n- observacoes: string com observações relevantes (opcional)\n\nResponda APENAS com o JSON, sem texto adicional.`

  let response: Response
  try {
    response = await fetch(`${env.BUILT_IN_FORGE_API_URL}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.BUILT_IN_FORGE_API_KEY ?? '',
        'anthropic-version': '2023-06-01',
      },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'url', url: imageUrl } },
              { type: 'text', text: prompt },
            ],
          },
        ],
      }),
    })
  } catch (fetchErr) {
    throw new Error(`Falha na requisição à API de IA: ${(fetchErr as Error).message}`)
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Erro na análise por IA (HTTP ${response.status}): ${body}`)
  }

  const data = (await response.json()) as {
    content: Array<{ text: string }>
    usage?: { input_tokens?: number; output_tokens?: number }
  }
  const inputTokens = data.usage?.input_tokens ?? 0
  const outputTokens = data.usage?.output_tokens ?? 0
  // Claude Haiku pricing: $0.80/1M input, $4.00/1M output
  const estimatedCostUSD = (inputTokens / 1_000_000 * 0.80) + (outputTokens / 1_000_000 * 4.00)
  logger.info('[llm] análise de exame concluída', {
    exameId,
    inputTokens,
    outputTokens,
    estimatedCostUSD: estimatedCostUSD.toFixed(5),
  })
  const text = data.content[0]?.text ?? '{}'

  let resultado: ResultadoIa
  try {
    const parsed = iaResponseSchema.parse(JSON.parse(text))
    resultado = {
      ...parsed,
      processadoEm: new Date().toISOString(),
      status: 'pendente',
    }
  } catch {
    resultado = {
      tipoExame: (exame.tipoExame as ResultadoIa['tipoExame']) ?? 'outro',
      resultado: 'nao_identificado',
      confianca: 0,
      processadoEm: new Date().toISOString(),
      status: 'pendente',
    }
  }

  await db.update(exames).set({ resultadoIa: resultado }).where(eq(exames.id, exameId))

  return resultado
}
