import { z } from 'zod'
import { router, staffProcedure } from '../_core/trpc.ts'
import { env } from '../_core/env.ts'
import { TRPCError } from '@trpc/server'
import { logger } from '../_core/logger.ts'

const resumoSchema = z.object({
  resumoGeral: z.string(),
  participantes: z.array(z.string()),
  pontosPrincipais: z.array(z.string()),
  decisoes: z.array(z.string()),
  proximosPassos: z.array(z.string()),
  destaques: z.array(z.string()),
})

export const meetingRouter = router({
  resumir: staffProcedure
    .input(
      z.object({
        titulo: z.string().max(200).optional(),
        transcricao: z.string().min(20).max(80000),
      }),
    )
    .mutation(async ({ input }) => {
      if (!env.BUILT_IN_FORGE_API_KEY) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'API de IA não configurada (BUILT_IN_FORGE_API_KEY ausente)',
        })
      }

      const tituloCtx = input.titulo ? `Título da reunião: ${input.titulo}\n\n` : ''

      const prompt = `Você é um assistente especializado em resumir reuniões corporativas e médicas. Analise a transcrição abaixo e gere um resumo estruturado em português brasileiro.

${tituloCtx}Retorne um JSON com esta estrutura exata (sem texto adicional fora do JSON):
{
  "resumoGeral": "Parágrafo de 2-3 frases resumindo o contexto e objetivo da reunião",
  "participantes": ["lista de nomes ou papéis mencionados na transcrição, se identificáveis"],
  "pontosPrincipais": ["tópicos e assuntos centrais discutidos"],
  "decisoes": ["decisões concretas tomadas durante a reunião"],
  "proximosPassos": ["ações definidas, tarefas e responsáveis se mencionados"],
  "destaques": ["pontos críticos, alertas ou informações que merecem atenção especial"]
}

Se alguma categoria não tiver conteúdo identificável, retorne um array vazio [].

Transcrição:
${input.transcricao}`

      let response: Response
      try {
        response = await fetch(`${env.BUILT_IN_FORGE_API_URL}/v1/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': env.BUILT_IN_FORGE_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          signal: AbortSignal.timeout(60000),
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 2000,
            messages: [{ role: 'user', content: prompt }],
          }),
        })
      } catch (err) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Falha na requisição à API de IA: ${(err as Error).message}`,
        })
      }

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        logger.warn('[meeting] erro na API de IA', { status: response.status, body })
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Erro na IA (HTTP ${response.status})`,
        })
      }

      const data = (await response.json()) as {
        content: Array<{ text: string }>
        usage?: { input_tokens?: number; output_tokens?: number }
      }

      logger.info('[meeting] resumo gerado', {
        inputTokens: data.usage?.input_tokens,
        outputTokens: data.usage?.output_tokens,
        transcricaoLen: input.transcricao.length,
      })

      const text = data.content[0]?.text ?? '{}'

      // Strip markdown code fences if the model wraps the JSON
      const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

      try {
        return resumoSchema.parse(JSON.parse(cleaned))
      } catch {
        logger.warn('[meeting] falha ao parsear JSON da IA', { text })
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erro ao processar resposta da IA — tente novamente',
        })
      }
    }),
})
