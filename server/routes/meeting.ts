import { z } from 'zod'
import multer from 'multer'
import { router, staffProcedure } from '../_core/trpc.ts'
import { env } from '../_core/env.ts'
import { TRPCError } from '@trpc/server'
import { logger } from '../_core/logger.ts'
import { createContext } from '../_core/context.ts'
import type { Request, Response } from 'express'

// ─── Constants ────────────────────────────────────────────────────────────────

const WHISPER_MAX_BYTES = 25 * 1024 * 1024 // 25 MB — OpenAI limit

// ─── Multer for audio upload ──────────────────────────────────────────────────

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: WHISPER_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('audio/') || file.mimetype === 'application/octet-stream') {
      cb(null, true)
    } else {
      cb(new Error(`Tipo não permitido: ${file.mimetype}`))
    }
  },
}).single('audio')

// ─── REST handler: POST /api/meeting/transcribe ───────────────────────────────

export async function transcribeAudio(req: Request, res: Response): Promise<void> {
  // Auth — same pattern as storage.ts
  const ctx = await createContext({ req })
  if (!ctx.session || ctx.session.type !== 'staff') {
    res.status(401).json({ error: 'Não autorizado' })
    return
  }

  if (!env.OPENAI_API_KEY) {
    res.status(501).json({ error: 'Transcrição via Whisper não configurada (OPENAI_API_KEY ausente)' })
    return
  }

  // Parse multipart upload
  const uploadErr = await new Promise<Error | null>(resolve => {
    audioUpload(req, res, (err) => resolve(err instanceof Error ? err : null))
  })

  if (uploadErr) {
    const status = uploadErr.message.includes('LIMIT_FILE_SIZE') ? 413 : 400
    res.status(status).json({ error: uploadErr.message })
    return
  }

  const file = req.file
  if (!file) {
    res.status(400).json({ error: 'Arquivo de áudio não encontrado' })
    return
  }

  // Build FormData for Whisper (Node 22 native FormData)
  const form = new FormData()
  const ext = (file.originalname.split('.').pop() ?? 'webm').toLowerCase()
  // Copy into a plain ArrayBuffer to avoid SharedArrayBuffer TS mismatch
  const ab = new ArrayBuffer(file.buffer.byteLength)
  new Uint8Array(ab).set(file.buffer)
  const blob = new Blob([ab], { type: file.mimetype || `audio/${ext}` })
  form.append('file', blob, `audio.${ext}`)
  form.append('model', 'whisper-1')
  form.append('language', 'pt')
  form.append('response_format', 'text')

  let whisperRes: globalThis.Response
  try {
    whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
      body: form,
      signal: AbortSignal.timeout(120000),
    })
  } catch (err) {
    logger.warn('[meeting] falha ao contatar Whisper', { error: String(err) })
    res.status(502).json({ error: `Falha ao contatar Whisper: ${(err as Error).message}` })
    return
  }

  if (!whisperRes.ok) {
    const body = await whisperRes.text().catch(() => '')
    logger.warn('[meeting] Whisper retornou erro', { status: whisperRes.status, body })
    res.status(502).json({ error: `Whisper API ${whisperRes.status}: ${body}` })
    return
  }

  const transcricao = await whisperRes.text()
  logger.info('[meeting] transcrição via Whisper concluída', {
    fileSizeKb: Math.round(file.size / 1024),
    transcLen: transcricao.length,
    user: ctx.session.type === 'staff' ? ctx.session.email : undefined,
  })

  res.json({ transcricao: transcricao.trim() })
}

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const resumoSchema = z.object({
  resumoGeral: z.string(),
  participantes: z.array(z.string()),
  pontosPrincipais: z.array(z.string()),
  decisoes: z.array(z.string()),
  proximosPassos: z.array(z.string()),
  destaques: z.array(z.string()),
})

// ─── tRPC router ─────────────────────────────────────────────────────────────

export const meetingRouter = router({
  config: staffProcedure.query(() => ({
    whisperDisponivel: !!env.OPENAI_API_KEY,
    iaDisponivel: !!env.BUILT_IN_FORGE_API_KEY,
  })),

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

      let response: globalThis.Response
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
