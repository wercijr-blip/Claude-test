import { env } from './_core/env.ts'
import { getPresignedUrl } from './storage.ts'

export interface ValidacaoExameResult {
  aprovado: boolean
  legivel: boolean
  dataExame: string | null
  diasDesdeExame: number | null
  primeiroNomeExame: string | null
  resultadoHiv: 'negativo' | 'positivo' | 'reagente' | 'nao_reagente' | 'inconclusivo' | 'nao_identificado'
  motivo: 'ilegivel' | 'data_invalida' | 'nome_divergente' | 'resultado_positivo' | null
  processadoEm: string
}

export async function validarExameHiv(s3Key: string, nomeEsperado?: string): Promise<ValidacaoExameResult> {
  const imageUrl = await getPresignedUrl(s3Key, 300)

  const hoje = new Date()
  const dataLimite = new Date(hoje)
  dataLimite.setDate(dataLimite.getDate() - 7)
  const hojeStr = hoje.toLocaleDateString('pt-BR')
  const dataLimiteStr = dataLimite.toLocaleDateString('pt-BR')

  const prompt = `Você é especialista em validação de exames laboratoriais de HIV para a plataforma Facilita PrEP.

Analise o exame na imagem e responda com JSON exatamente neste formato:
{
  "legivel": true,
  "dataExame": "DD/MM/AAAA",
  "diasDesdeExame": 3,
  "primeiroNomeExame": "João",
  "resultadoHiv": "nao_reagente",
  "aprovado": true,
  "motivo": null
}

Regras obrigatórias (aplique na ordem, pare no primeiro que falhar):
1. Se o exame não estiver legível ou não for um exame de HIV: { "legivel": false, "aprovado": false, "motivo": "ilegivel" }
2. Se a data do exame for anterior a ${dataLimiteStr} ou não encontrada: { "aprovado": false, "motivo": "data_invalida" }
${nomeEsperado ? `3. Se o primeiro nome no exame for diferente de "${nomeEsperado}" (compare sem acento, case-insensitive): { "aprovado": false, "motivo": "nome_divergente" }` : '3. (sem validação de nome)'}
4. Se o resultado do HIV for positivo ou reagente: { "aprovado": false, "motivo": "resultado_positivo" }

Valores válidos para resultadoHiv: "negativo", "positivo", "reagente", "nao_reagente", "inconclusivo", "nao_identificado"
Hoje é ${hojeStr}. Responda APENAS com o JSON, sem texto adicional.`

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

  if (!response.ok) throw new Error('Erro na validação por IA')

  const data = (await response.json()) as { content: Array<{ text: string }> }
  const text = data.content[0]?.text ?? '{}'

  try {
    const parsed = JSON.parse(text) as Omit<ValidacaoExameResult, 'processadoEm'>
    return { ...parsed, processadoEm: new Date().toISOString() }
  } catch {
    return {
      aprovado: false,
      legivel: false,
      dataExame: null,
      diasDesdeExame: null,
      primeiroNomeExame: null,
      resultadoHiv: 'nao_identificado',
      motivo: 'ilegivel',
      processadoEm: new Date().toISOString(),
    }
  }
}
