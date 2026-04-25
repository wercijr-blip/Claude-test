import { env } from './_core/env.ts'
import { getPresignedUrl } from './storage.ts'

export interface ExtracacaoExame {
  nomeExame: string | null
  resultadoHiv: 'reagente' | 'nao_reagente' | 'inconclusivo' | 'nao_identificado'
  dataExame: string | null // DD/MM/YYYY
  confianca: number // 0–1
  processadoEm: string
}

// ─── Utility: fuzzy name similarity (normalized Levenshtein) ─────────────────

function normalizarTexto(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

export function calcularSimilaridadeNome(nomeExame: string, nomeEsperado: string): number {
  const a = normalizarTexto(nomeExame)
  const b = normalizarTexto(nomeEsperado)
  if (a === b) return 1
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return (maxLen - levenshtein(a, b)) / maxLen
}

// ─── AI extraction: nome, resultado, data, confiança ─────────────────────────

export async function extrairDadosExame(s3Key: string): Promise<ExtracacaoExame> {
  const imageUrl = await getPresignedUrl(s3Key, 300)

  const prompt = `Você é especialista em leitura de exames laboratoriais brasileiros.

Analise a imagem e extraia APENAS as seguintes informações do exame de HIV:
1. nomeExame: nome completo do paciente escrito no exame (string ou null se não encontrado)
2. resultadoHiv: resultado do exame HIV — use EXATAMENTE um destes valores:
   "reagente" (positivo), "nao_reagente" (negativo), "inconclusivo", "nao_identificado"
3. dataExame: data de coleta/realização no formato "DD/MM/AAAA" (string ou null se não encontrado)
4. confianca: sua confiança de 0 a 1 na leitura (1 = exame claro e legível)

Responda APENAS com JSON, sem texto adicional:
{
  "nomeExame": "Nome Completo",
  "resultadoHiv": "nao_reagente",
  "dataExame": "15/04/2026",
  "confianca": 0.95
}`

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
        max_tokens: 300,
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

  const data = (await response.json()) as { content: Array<{ text: string }> }
  const text = data.content[0]?.text ?? '{}'

  try {
    const parsed = JSON.parse(text) as Omit<ExtracacaoExame, 'processadoEm'>
    return {
      nomeExame: parsed.nomeExame ?? null,
      resultadoHiv: parsed.resultadoHiv ?? 'nao_identificado',
      dataExame: parsed.dataExame ?? null,
      confianca: typeof parsed.confianca === 'number' ? Math.max(0, Math.min(1, parsed.confianca)) : 0,
      processadoEm: new Date().toISOString(),
    }
  } catch {
    return {
      nomeExame: null,
      resultadoHiv: 'nao_identificado',
      dataExame: null,
      confianca: 0,
      processadoEm: new Date().toISOString(),
    }
  }
}

// ─── Date validation (no AI involved) ────────────────────────────────────────

export function parseDateBR(dataStr: string): Date | null {
  const match = dataStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return null
  const [, dd, mm, yyyy] = match
  const d = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd))
  if (isNaN(d.getTime())) return null
  return d
}

export function isDataValida(dataExame: Date | null, diasMaximos = 7): boolean {
  if (!dataExame) return false
  const hoje = new Date()
  hoje.setHours(23, 59, 59, 999)
  const limite = new Date(hoje)
  limite.setDate(limite.getDate() - diasMaximos)
  limite.setHours(0, 0, 0, 0)
  return dataExame >= limite && dataExame <= hoje
}
