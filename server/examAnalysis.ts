import { env } from './_core/env.ts'
import { db } from './db.ts'
import { exames } from '../drizzle/schema.ts'
import { eq } from 'drizzle-orm'
import { getPresignedUrl } from './storage.ts'
import type { ResultadoIa } from '../shared/types.ts'

export async function analisarExame(exameId: number): Promise<ResultadoIa> {
  const [exame] = await db.select().from(exames).where(eq(exames.id, exameId)).limit(1)
  if (!exame) throw new Error(`Exame ${exameId} não encontrado`)

  const imageUrl = await getPresignedUrl(exame.s3Key, 300)

  const prompt = `Você é um assistente médico especializado em análise de exames laboratoriais.
Analise o resultado do exame na imagem e retorne um JSON com:
- tipoExame: tipo do exame detectado (hiv, hepatite_b, hepatite_c, sifilis, creatinina, outro)
- resultado: "reagente", "nao_reagente", "inconclusivo" ou "nao_identificado"
- confianca: número de 0 a 1 indicando confiança na análise
- observacoes: string com observações relevantes (opcional)

Responda APENAS com o JSON, sem texto adicional.`

  const response = await fetch(`${env.BUILT_IN_FORGE_API_URL}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.BUILT_IN_FORGE_API_KEY ?? '',
      'anthropic-version': '2023-06-01',
    },
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

  if (!response.ok) throw new Error('Erro na análise por IA')

  const data = (await response.json()) as { content: Array<{ text: string }> }
  const text = data.content[0]?.text ?? '{}'

  let resultado: ResultadoIa
  try {
    resultado = { ...JSON.parse(text), processadoEm: new Date().toISOString() } as ResultadoIa
  } catch {
    resultado = {
      tipoExame: exame.tipoExame as ResultadoIa['tipoExame'] ?? 'outro',
      resultado: 'nao_identificado',
      confianca: 0,
      processadoEm: new Date().toISOString(),
    }
  }

  await db.update(exames).set({ resultadoIa: resultado }).where(eq(exames.id, exameId))

  return resultado
}
