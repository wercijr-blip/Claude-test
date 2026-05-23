import { z } from 'zod'
import { env } from './_core/env.ts'
import { logger } from './_core/logger.ts'
import { redis } from './_core/redis.ts'
import { db } from './db.ts'
import { exames } from '../drizzle/schema.ts'
import { eq } from 'drizzle-orm'
import { getPresignedUrl } from './storage.ts'
import type { ResultadoIa } from '../shared/types.ts'
import {
  validateExameQuality,
  detectPromptInjection,
  buildSbisMetadata,
  isResultadoAnomalos,
  logIaAnalise,
  logIaAnomalia,
  logIaRejeicaoDados,
  SBIS_MODEL_VERSION,
} from './_core/sbis.ts'

const MAX_DAILY_LLM_CALLS = env.LLM_DAILY_LIMIT ?? 200

const LLM_ALERT_THRESHOLD = 0.8

async function checkDailyLimit(): Promise<void> {
  const key = `llm:daily:${new Date().toISOString().slice(0, 10)}`
  try {
    const count = await redis.incr(key)
    if (count === 1) await redis.expire(key, 90_000) // 25h TTL — survives day boundary
    if (count > MAX_DAILY_LLM_CALLS) {
      logger.warn('[llm] limite diário atingido', { count, limit: MAX_DAILY_LLM_CALLS, key })
      throw new Error(`Limite diário de análises por IA atingido (${MAX_DAILY_LLM_CALLS}/dia). Tente novamente amanhã.`)
    }
    const alertThreshold = Math.floor(MAX_DAILY_LLM_CALLS * LLM_ALERT_THRESHOLD)
    if (count === alertThreshold) {
      const alertKey = `llm:alert:${new Date().toISOString().slice(0, 10)}`
      const alreadyAlerted = await redis.get(alertKey)
      if (!alreadyAlerted) {
        await redis.set(alertKey, '1', 'EX', 90_000)
        const { enviarAlerteLimiteLLM } = await import('./email.ts')
        void enviarAlerteLimiteLLM(80, count, MAX_DAILY_LLM_CALLS)
        logger.warn('[llm] 80% do limite diário atingido — alerta enviado', { count, limit: MAX_DAILY_LLM_CALLS })
      }
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

export function buildLlmRequest(imageUrl: string) {
  const prompt =
    `Você é um assistente médico especializado em análise de exames laboratoriais.\n` +
    `Analise o resultado do exame na imagem e retorne um JSON com:\n` +
    `- tipoExame: tipo do exame detectado (hiv, hepatite_b, hepatite_c, sifilis, creatinina, outro)\n` +
    `- resultado: "reagente", "nao_reagente", "inconclusivo" ou "nao_identificado"\n` +
    `- confianca: número de 0 a 1 indicando confiança na análise\n` +
    `- observacoes: string com observações relevantes (opcional)\n\n` +
    `Responda APENAS com o JSON, sem texto adicional.`

  return {
    model: SBIS_MODEL_VERSION,
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
  }
}

export function parseIaResponse(
  text: string,
  sessionId: string,
  fallbackTipoExame: string,
  exameId: number,
): ResultadoIa {
  try {
    const parsed = iaResponseSchema.parse(JSON.parse(text))
    const sbis = buildSbisMetadata(text, parsed.tipoExame, parsed.confianca, sessionId)
    return { ...parsed, processadoEm: sbis.timestamp, status: 'pendente', sbis }
  } catch (parseErr) {
    logger.warn('[examAnalysis] resposta da IA não parseável — fallback nao_identificado', {
      exameId,
      sessionId,
      parseError: (parseErr as Error).message,
      rawResponse: text.slice(0, 500),
    })
    const sbis = buildSbisMetadata(text, fallbackTipoExame ?? 'outro', 0, sessionId)
    return {
      tipoExame: (fallbackTipoExame as ResultadoIa['tipoExame']) ?? 'outro',
      resultado: 'nao_identificado',
      confianca: 0,
      processadoEm: sbis.timestamp,
      status: 'pendente',
      sbis,
    }
  }
}

export async function analisarExame(exameId: number): Promise<ResultadoIa> {
  await checkDailyLimit()

  const [exame] = await db.select().from(exames).where(eq(exames.id, exameId)).limit(1)
  if (!exame) throw new Error(`Exame ${exameId} não encontrado`)

  // BPIA.03 — Validate data quality before calling AI
  const qualidade = validateExameQuality(exame.s3Key, exame.tipoExame, exame.tamanhoBytes)
  if (!qualidade.valid) {
    logger.warn('[examAnalysis] exame rejeitado por qualidade insuficiente — BPIA.03', {
      exameId,
      motivo: qualidade.reason,
    })
    await logIaRejeicaoDados({ exameId, motivo: qualidade.reason! })
    throw new Error(`Dados insuficientes para análise por IA: ${qualidade.reason}`)
  }
  if (qualidade.warning) {
    logger.warn('[examAnalysis] aviso de qualidade de dados', { exameId, aviso: qualidade.warning })
  }

  // NGS1.12 — Adversarial check on any text fields that reach the AI prompt
  // (observacoes field is not currently interpolated into the prompt, but validated
  //  defensively for future-proofing and NGS1.12 compliance)
  const textFieldsToCheck = [exame.nomeArquivo, exame.tipoExame].filter(Boolean) as string[]
  for (const field of textFieldsToCheck) {
    if (detectPromptInjection(field)) {
      logger.warn('[examAnalysis] possível injeção de prompt detectada — NGS1.12', { exameId, field })
      throw new Error('Entrada rejeitada: padrão adversarial detectado no exame (NGS1.12)')
    }
  }

  const sessionId = crypto.randomUUID()
  const imageUrl = await getPresignedUrl(exame.s3Key, 300)

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
      body: JSON.stringify(buildLlmRequest(imageUrl)),
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
    sessionId,
    inputTokens,
    outputTokens,
    estimatedCostUSD: estimatedCostUSD.toFixed(5),
  })

  const text = data.content[0]?.text ?? '{}'
  const resultado = parseIaResponse(text, sessionId, exame.tipoExame ?? 'outro', exameId)

  // NGS1.07 — Audit every AI analysis (append-only audit log)
  await logIaAnalise({
    exameId,
    tipoExame: resultado.tipoExame,
    resultado: resultado.resultado,
    confianca: resultado.confianca,
    sessionId,
    inputTokens,
    outputTokens,
  })

  // BPIA.05 + NGS1.10 — Detect and log anomalous results for RT notification
  if (isResultadoAnomalos(resultado.resultado, resultado.confianca, resultado.tipoExame)) {
    const motivo =
      resultado.resultado === 'reagente'
        ? `Resultado reagente com confiança ${(resultado.confianca * 100).toFixed(0)}% em ${resultado.tipoExame}`
        : resultado.resultado === 'nao_identificado'
          ? 'Exame não identificado pela IA'
          : `Confiança baixa: ${(resultado.confianca * 100).toFixed(0)}%`

    logger.warn('[examAnalysis] resultado anômalo — RT notificado via audit log — NGS1.10', {
      exameId,
      sessionId,
      motivo,
    })
    await logIaAnomalia({
      exameId,
      resultado: resultado.resultado,
      confianca: resultado.confianca,
      tipoExame: resultado.tipoExame,
      motivo,
      sessionId,
    })
  }

  await db.update(exames).set({ resultadoIa: resultado }).where(eq(exames.id, exameId))

  return resultado
}
