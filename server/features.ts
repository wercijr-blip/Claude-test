import { nanoid } from 'nanoid'
import { createKnowledgeTopic, createConsultationClinicalData } from './db.ts'

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'

function getOpenAIKey(): string {
  const key = process.env.OPENAI_API_KEY ?? process.env.BUILT_IN_FORGE_API_KEY ?? ''
  return key
}

async function invokeLLM(messages: { role: string; content: string }[], timeoutMs = 60000) {
  const apiKey = getOpenAIKey()
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY não configurado')
  }

  const resp = await fetch(OPENAI_API_URL, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model:       'gpt-4o-mini',
      messages,
      temperature: 0.2,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  })

  if (!resp.ok) {
    const txt = await resp.text().catch(() => '')
    throw new Error(`OpenAI error ${resp.status}: ${txt}`)
  }

  return resp.json() as Promise<{
    choices: { message: { content: string } }[]
  }>
}

function parseJsonSafe<T>(raw: string): T | null {
  try {
    const clean = raw.replace(/```json|```/g, '').trim()
    return JSON.parse(clean) as T
  } catch {
    return null
  }
}

// ─── KNOWLEDGE TOPICS ─────────────────────────────────────────

export async function extractKnowledgeTopics(
  consultationId: number,
  userId: number,
  clinicId: string | null,
  soapAssessment: string,
): Promise<void> {
  if (!soapAssessment?.trim()) return
  if (!clinicId) {
    console.warn(`[KNOWLEDGE] Médico ${userId} sem clinicId — tópicos não salvos`)
    return
  }

  try {
    const result = await invokeLLM([{
      role:    'user',
      content: `Você é um médico especialista em educação médica.
Analise a seção A (Avaliação) do SOAP abaixo e retorne APENAS um JSON válido:
{
  "topics": [{
    "topic": "string",
    "pubmedQuery": "string (em inglês, otimizado para PubMed)",
    "medical_specialty": "especialidade DO TEMA (não do médico)",
    "specialty_category": "Clínica Médica|Cirurgia|Pediatria|Ginecologia|Psiquiatria|Emergência|Outras",
    "subtopics": ["string"]
  }]
}
Máximo 4 tópicos. Retorne apenas JSON.
SOAP Avaliação: ${soapAssessment}`,
    }], 60000)

    const raw  = result.choices?.[0]?.message?.content
    if (!raw) return

    const data = parseJsonSafe<{ topics: Array<{
      topic:             string
      pubmedQuery:       string
      medical_specialty: string
      specialty_category: string
      subtopics:         string[]
    }> }>(raw)

    if (!data?.topics?.length) return

    for (const item of data.topics.slice(0, 4)) {
      await createKnowledgeTopic({
        topic:             item.topic,
        pubmedQuery:       item.pubmedQuery,
        source:            'auto',
        status:            'pending',
        consultationId,
        clinicId,
        visibility:        'clinic',
        sharedBy:          userId,
        medicalSpecialty:  item.medical_specialty,
        specialtyCategory: item.specialty_category,
        subtopics:         JSON.stringify(item.subtopics ?? []),
      })
    }

    console.log(`[KNOWLEDGE] ${data.topics.length} tópico(s) extraído(s) para consulta ${consultationId}`)
  } catch (err) {
    console.error(`[KNOWLEDGE] Erro na consulta ${consultationId}: ${err}`)
  }
}

// ─── CLINICAL DATA EXTRACTION ─────────────────────────────────

export async function extractClinicalData(
  consultationId: number,
  doctorId: number,
  clinicId: string | null,
  soapPlan: string,
): Promise<void> {
  if (!soapPlan?.trim()) return

  try {
    const result = await invokeLLM([{
      role:    'user',
      content: `Analise o plano (seção P) do SOAP abaixo e retorne APENAS um JSON válido:
{
  "exams_requested": ["string"],
  "treatment_type": "oral|iv|both|none",
  "medications": [{ "name": "string", "dose": "string", "route": "string" }],
  "has_hospitalization_indication": true|false,
  "follow_up_days": null
}
Retorne apenas JSON, sem texto adicional.
SOAP Plano: ${soapPlan}`,
    }], 60000)

    const raw = result.choices?.[0]?.message?.content
    if (!raw) return

    const data = parseJsonSafe<{
      exams_requested:               string[]
      treatment_type:                'oral' | 'iv' | 'both' | 'none'
      medications:                   { name: string; dose: string; route: string }[]
      has_hospitalization_indication: boolean
      follow_up_days:                number | null
    }>(raw)

    if (!data) return

    await createConsultationClinicalData({
      id:                           nanoid(),
      consultationId,
      doctorId,
      clinicId,
      examsRequested:               JSON.stringify(data.exams_requested ?? []),
      treatmentType:                data.treatment_type,
      medications:                  JSON.stringify(data.medications ?? []),
      hasHospitalizationIndication: data.has_hospitalization_indication ? 1 : 0,
      followUpDays:                 data.follow_up_days ?? null,
    })

    console.log(`[CLINICAL] Dados clínicos extraídos para consulta ${consultationId}`)
  } catch (err) {
    console.error(`[CLINICAL] Erro na consulta ${consultationId}: ${err}`)
  }
}

// ─── LLM WRAPPER (OpenAI) ─────────────────────────────────────

export async function generateSOAP(transcription: string): Promise<{
  S: string; O: string; A: string; P: string
} | null> {
  try {
    const result = await invokeLLM([{
      role: 'system',
      content: 'Você é um médico experiente. Gere um SOAP estruturado em português a partir da transcrição da consulta. Retorne JSON com chaves S, O, A, P.',
    }, {
      role:    'user',
      content: `Transcrição: ${transcription}`,
    }], 120000)

    const raw  = result.choices?.[0]?.message?.content
    if (!raw) return null

    return parseJsonSafe<{ S: string; O: string; A: string; P: string }>(raw)
  } catch (err) {
    console.error('[SOAP] Erro ao gerar SOAP:', err)
    return null
  }
}

// ─── AUDIO TRANSCRIPTION (OpenAI Whisper) ────────────────────

export async function transcribeAudio(audioBuffer: Buffer, filename = 'audio.webm'): Promise<string> {
  const apiKey = getOpenAIKey()
  if (!apiKey) throw new Error('OPENAI_API_KEY não configurado')

  const formData = new FormData()
  const ab   = audioBuffer.buffer.slice(audioBuffer.byteOffset, audioBuffer.byteOffset + audioBuffer.byteLength) as ArrayBuffer
  const blob = new Blob([ab], { type: 'audio/webm' })
  formData.append('file', blob, filename)
  formData.append('model', 'gpt-4o-mini-transcribe')
  formData.append('language', 'pt')

  const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method:  'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body:    formData,
    signal:  AbortSignal.timeout(8 * 60 * 1000), // 8 min
  })

  if (!resp.ok) {
    const txt = await resp.text().catch(() => '')
    throw new Error(`Transcription error ${resp.status}: ${txt}`)
  }

  const data = await resp.json() as { text: string }
  return data.text
}

// ─── AUDIO CHUNKING ───────────────────────────────────────────

const CHUNK_SIZE = 10 * 1024 * 1024 // 10MB

export async function transcribeWithChunking(audioUrl: string): Promise<string> {
  const response = await fetch(audioUrl)
  const buffer   = Buffer.from(await response.arrayBuffer())

  if (buffer.length <= CHUNK_SIZE) {
    return transcribeAudio(buffer)
  }

  console.log(`[AUDIO] Arquivo ${(buffer.length / 1024 / 1024).toFixed(1)}MB — dividindo em chunks`)

  const chunks: Buffer[] = []
  for (let offset = 0; offset < buffer.length; offset += CHUNK_SIZE) {
    chunks.push(buffer.subarray(offset, offset + CHUNK_SIZE))
  }

  const transcriptions: string[] = []
  for (let i = 0; i < chunks.length; i++) {
    try {
      const text = await transcribeAudio(chunks[i], `chunk_${i}.webm`)
      transcriptions.push(text)
    } catch (err) {
      console.error(`[AUDIO] Chunk ${i} falhou: ${err}`)
    }
  }

  return transcriptions.join(' ')
}
