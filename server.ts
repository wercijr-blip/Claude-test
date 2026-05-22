import express from 'express'
import compression from 'compression'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env['PORT'] ?? 3333)

// ─── Env ──────────────────────────────────────────────────────────────────────

const OPENAI_API_KEY       = process.env['OPENAI_API_KEY'] ?? ''
const CLAUDE_API_KEY       = process.env['CLAUDE_API_KEY'] ?? ''
const CLAUDE_API_URL       = process.env['CLAUDE_API_URL'] ?? 'https://api.anthropic.com'
const ACCESS_TOKEN         = process.env['ACCESS_TOKEN'] ?? ''   // optional — empty = no auth
const WHISPER_MAX_BYTES    = 200 * 1024 * 1024                   // 200 MB (segments arrive ≤ 10 MB)
const WHISPER_LIMIT_BYTES  =  25 * 1024 * 1024                   // Whisper API hard limit

// ─── App ──────────────────────────────────────────────────────────────────────

const app = express()
app.use(compression())
app.use(express.json({ limit: '1mb' }))

// ─── Auth middleware ──────────────────────────────────────────────────────────

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!ACCESS_TOKEN) { next(); return }
  const bearer = req.headers['authorization']?.replace('Bearer ', '')
  const header = req.headers['x-access-token'] as string | undefined
  if ((bearer ?? header) !== ACCESS_TOKEN) {
    res.status(401).json({ error: 'Token de acesso inválido' })
    return
  }
  next()
}

// ─── Config endpoint ──────────────────────────────────────────────────────────

app.get('/api/config', requireAuth, (_req, res) => {
  res.json({
    whisperDisponivel: !!OPENAI_API_KEY,
    iaDisponivel:      !!CLAUDE_API_KEY,
    authRequired:      !!ACCESS_TOKEN,
  })
})

// ─── Transcribe (Whisper) ─────────────────────────────────────────────────────

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: WHISPER_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('audio/') || file.mimetype === 'application/octet-stream') cb(null, true)
    else cb(new Error(`Tipo não permitido: ${file.mimetype}`))
  },
}).single('audio')

app.post('/api/transcribe', requireAuth, (req, res, next) => {
  audioUpload(req, res, (err) => {
    if (err) { res.status(err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: String(err.message) }); return }
    next()
  })
}, async (req: express.Request, res: express.Response) => {
  if (!OPENAI_API_KEY) { res.status(501).json({ error: 'OPENAI_API_KEY não configurada' }); return }

  const file = req.file
  if (!file) { res.status(400).json({ error: 'Arquivo de áudio não encontrado' }); return }

  if (file.size > WHISPER_LIMIT_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1)
    res.status(413).json({ error: `Segmento muito grande (${mb} MB). Limite do Whisper é 25 MB. Use a gravação integrada — ela segmenta automaticamente a cada 20 min.` })
    return
  }

  const form = new FormData()
  const ext  = (file.originalname.split('.').pop() ?? 'webm').toLowerCase()
  const ab   = new ArrayBuffer(file.buffer.byteLength)
  new Uint8Array(ab).set(file.buffer)
  form.append('file', new Blob([ab], { type: file.mimetype || `audio/${ext}` }), `audio.${ext}`)
  form.append('model', 'whisper-1')
  form.append('language', 'pt')
  form.append('response_format', 'text')

  try {
    const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: form,
      signal: AbortSignal.timeout(120_000),
    })
    if (!r.ok) { res.status(502).json({ error: `Whisper ${r.status}: ${await r.text()}` }); return }
    res.json({ transcricao: (await r.text()).trim() })
  } catch (err) {
    res.status(502).json({ error: `Falha ao contatar Whisper: ${(err as Error).message}` })
  }
})

// ─── Summarize (Claude) ───────────────────────────────────────────────────────

app.post('/api/summarize', requireAuth, async (req: express.Request, res: express.Response) => {
  if (!CLAUDE_API_KEY) { res.status(501).json({ error: 'CLAUDE_API_KEY não configurada' }); return }

  const { titulo, transcricao } = req.body as { titulo?: string; transcricao: string }
  if (!transcricao || transcricao.trim().length < 20) { res.status(400).json({ error: 'Transcrição muito curta' }); return }

  const tituloCtx = titulo ? `Título da reunião: ${titulo}\n\n` : ''
  const prompt = `Você é um assistente especializado em resumir reuniões. Analise a transcrição e gere um resumo estruturado em português brasileiro.

${tituloCtx}Retorne um JSON com esta estrutura exata (sem texto adicional):
{
  "resumoGeral": "Parágrafo de 2-3 frases resumindo a reunião",
  "participantes": ["nomes ou papéis mencionados"],
  "pontosPrincipais": ["tópicos centrais discutidos"],
  "decisoes": ["decisões concretas tomadas"],
  "proximosPassos": ["ações e responsáveis definidos"],
  "destaques": ["pontos críticos ou alertas"]
}

Se alguma categoria não tiver conteúdo, retorne array vazio [].

Transcrição:
${transcricao}`

  try {
    const r = await fetch(`${CLAUDE_API_URL}/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': CLAUDE_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 2000, messages: [{ role: 'user', content: prompt }] }),
      signal: AbortSignal.timeout(60_000),
    })
    if (!r.ok) { res.status(502).json({ error: `Claude ${r.status}: ${await r.text()}` }); return }
    const data = await r.json() as { content: Array<{ text: string }> }
    const text = (data.content[0]?.text ?? '{}').replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    res.json(JSON.parse(text))
  } catch (err) {
    res.status(502).json({ error: `Falha ao contatar Claude: ${(err as Error).message}` })
  }
})

// ─── Serve React SPA ──────────────────────────────────────────────────────────

if (process.env['NODE_ENV'] === 'production') {
  const clientDist = path.resolve(__dirname, 'dist/client')
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist))
    app.get('*', (req, res) => {
      if (/\.[a-zA-Z0-9]+$/.test(req.path)) { res.status(404).end(); return }
      res.sendFile(path.join(clientDist, 'index.html'))
    })
  }
}

app.listen(PORT, () => {
  console.log(`\n🎙️  Gravador de Reunião rodando em http://localhost:${PORT}`)
  if (!OPENAI_API_KEY) console.log('  ⚠️  OPENAI_API_KEY não configurada — transcrição Whisper desabilitada')
  if (!CLAUDE_API_KEY) console.log('  ⚠️  CLAUDE_API_KEY não configurada — resumo com IA desabilitado')
  if (ACCESS_TOKEN)    console.log('  🔒 Autenticação por token ativada')
  else                 console.log('  ℹ️  Sem autenticação — rode atrás de VPN ou firewall')
})
