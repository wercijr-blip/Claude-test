import { useState, useRef, useEffect, useCallback } from 'react'
import { Mic, MicOff, Square, Play, Download, FileText, Loader2, Copy, Check, Trash2 } from 'lucide-react'
import { trpc } from '../lib/trpc.ts'
import { toast } from '../lib/use-toast.ts'

// ─── Types ────────────────────────────────────────────────────────────────────

type State = 'idle' | 'recording' | 'stopped' | 'summarizing' | 'done'

interface Resumo {
  resumoGeral: string
  participantes: string[]
  pontosPrincipais: string[]
  decisoes: string[]
  proximosPassos: string[]
  destaques: string[]
}

// ─── Speech Recognition shim ─────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySpeechRecognition = any

function getSpeechRecognition(): (new () => AnySpeechRecognition) | null {
  const w = window as unknown as Record<string, unknown>
  return (w['SpeechRecognition'] ?? w['webkitSpeechRecognition'] ?? null) as (new () => AnySpeechRecognition) | null
}

// ─── Helper: format duration ──────────────────────────────────────────────────

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ title, items, icon }: { title: string; items: string[]; icon: string }) {
  if (items.length === 0) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
        {icon} {title}
      </h3>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm text-slate-700">
            <span className="text-slate-400 mt-0.5 shrink-0">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MeetingRecorder() {
  const [state, setState] = useState<State>('idle')
  const [transcricao, setTranscricao] = useState('')
  const [titulo, setTitulo] = useState('')
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [copied, setCopied] = useState(false)
  const [srSupported, setSrSupported] = useState(true)

  const recognitionRef = useRef<AnySpeechRecognition | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioUrlRef = useRef<string | null>(null)
  const transcricaoRef = useRef(transcricao)
  transcricaoRef.current = transcricao

  const resumirMutation = trpc.meeting.resumir.useMutation({
    onSuccess: (data) => {
      setResumo(data)
      setState('done')
    },
    onError: (err) => {
      toast({ title: 'Erro ao gerar resumo', description: err.message, variant: 'error' })
      setState('stopped')
    },
  })

  useEffect(() => {
    if (!getSpeechRecognition()) setSrSupported(false)
    return () => {
      stopTimer()
      recognitionRef.current?.abort()
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
    }
  }, [])

  // ── Timer ──────────────────────────────────────────────────────────────────

  const startTimer = () => {
    setElapsed(0)
    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
  }

  const stopTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }

  // ── Speech Recognition ─────────────────────────────────────────────────────

  const startSpeechRecognition = useCallback(() => {
    const SR = getSpeechRecognition()
    if (!SR) return

    const recognition = new SR()
    recognition.lang = 'pt-BR'
    recognition.continuous = true
    recognition.interimResults = true
    recognitionRef.current = recognition

    let finalBuffer = ''

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let interimText = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript as string
        if (event.results[i].isFinal) {
          finalBuffer += transcript + ' '
        } else {
          interimText = transcript
        }
      }
      setTranscricao(finalBuffer + (interimText ? `[${interimText}]` : ''))
    }

    recognition.onend = () => {
      // Auto-restart if still recording (browser stops after ~60s of silence)
      if (recognitionRef.current === recognition && timerRef.current !== null) {
        recognition.start()
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (e: any) => {
      if (e.error === 'not-allowed') {
        toast({ title: 'Permissão de microfone negada', variant: 'error' })
        stopRecording()
      }
    }

    recognition.start()
  }, [])

  // ── MediaRecorder ──────────────────────────────────────────────────────────

  const startMediaRecorder = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      audioChunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
        audioUrlRef.current = URL.createObjectURL(blob)
        stream.getTracks().forEach(t => t.stop())
      }
      recorder.start(1000)
      mediaRecorderRef.current = recorder
    } catch {
      // Audio recording is optional — transcription via SR still works
    }
  }, [])

  // ── Start / Stop ───────────────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    setTranscricao('')
    setResumo(null)
    setState('recording')
    startTimer()
    startSpeechRecognition()
    await startMediaRecorder()
  }, [startSpeechRecognition, startMediaRecorder])

  const stopRecording = useCallback(() => {
    stopTimer()
    recognitionRef.current?.stop()
    recognitionRef.current = null
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null
    setState('stopped')
  }, [])

  const gerarResumo = useCallback(() => {
    const texto = transcricaoRef.current.replace(/\[.*?\]/g, '').trim()
    if (texto.length < 20) {
      toast({ title: 'Transcrição muito curta para resumir', variant: 'warning' })
      return
    }
    setState('summarizing')
    resumirMutation.mutate({ titulo: titulo || undefined, transcricao: texto })
  }, [titulo, resumirMutation])

  const resetar = useCallback(() => {
    setState('idle')
    setTranscricao('')
    setResumo(null)
    setElapsed(0)
    setTitulo('')
    if (audioUrlRef.current) { URL.revokeObjectURL(audioUrlRef.current); audioUrlRef.current = null }
  }, [])

  const copiarResumo = useCallback(() => {
    if (!resumo) return
    const texto = [
      resumo.resumoGeral,
      '',
      resumo.participantes.length ? `Participantes:\n${resumo.participantes.map(p => `• ${p}`).join('\n')}` : '',
      resumo.pontosPrincipais.length ? `\nPontos Principais:\n${resumo.pontosPrincipais.map(p => `• ${p}`).join('\n')}` : '',
      resumo.decisoes.length ? `\nDecisões:\n${resumo.decisoes.map(p => `• ${p}`).join('\n')}` : '',
      resumo.proximosPassos.length ? `\nPróximos Passos:\n${resumo.proximosPassos.map(p => `• ${p}`).join('\n')}` : '',
      resumo.destaques.length ? `\nDestaques:\n${resumo.destaques.map(p => `• ${p}`).join('\n')}` : '',
    ].filter(Boolean).join('\n')
    void navigator.clipboard.writeText(texto).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [resumo])

  // ─── Render ────────────────────────────────────────────────────────────────

  const isRecording = state === 'recording'
  const canSummarize = state === 'stopped' && transcricao.replace(/\[.*?\]/g, '').trim().length >= 20

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800">Gravador de Reunião</h1>
          <p className="text-slate-500 text-sm mt-1">
            Transcrição em tempo real + resumo automático com IA
          </p>
        </div>

        {!srSupported && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            <strong>Navegador não suportado.</strong> A transcrição em tempo real requer Chrome ou Edge.
            Você ainda pode digitar ou colar a transcrição manualmente.
          </div>
        )}

        {/* Título */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Título da reunião (opcional)"
            value={titulo}
            onChange={e => setTitulo(e.target.value)}
            disabled={isRecording || state === 'summarizing'}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 text-sm"
          />
        </div>

        {/* Controls */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {isRecording && (
                <span className="flex items-center gap-2 text-sm font-medium text-red-600">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  Gravando
                </span>
              )}
              {state === 'stopped' && (
                <span className="text-sm text-slate-500">Gravação encerrada</span>
              )}
              {state === 'idle' && (
                <span className="text-sm text-slate-400">Pronto para gravar</span>
              )}
            </div>
            {(isRecording || state === 'stopped') && (
              <span className="text-slate-600 font-mono text-sm tabular-nums">
                {formatDuration(elapsed)}
              </span>
            )}
          </div>

          <div className="flex gap-3 flex-wrap">
            {state === 'idle' && (
              <button
                onClick={() => void startRecording()}
                className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-5 py-2.5 rounded-xl font-medium text-sm transition-colors"
              >
                <Mic className="w-4 h-4" />
                Iniciar gravação
              </button>
            )}

            {isRecording && (
              <button
                onClick={stopRecording}
                className="flex items-center gap-2 bg-slate-700 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-medium text-sm transition-colors"
              >
                <Square className="w-4 h-4" />
                Encerrar
              </button>
            )}

            {state === 'stopped' && (
              <>
                <button
                  onClick={() => void startRecording()}
                  className="flex items-center gap-2 border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl font-medium text-sm transition-colors"
                >
                  <Play className="w-4 h-4" />
                  Continuar
                </button>
                {audioUrlRef.current && (
                  <a
                    href={audioUrlRef.current}
                    download={`reuniao-${new Date().toISOString().slice(0, 10)}.webm`}
                    className="flex items-center gap-2 border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl font-medium text-sm transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Baixar áudio
                  </a>
                )}
              </>
            )}

            {(state === 'stopped' || state === 'done') && (
              <button
                onClick={resetar}
                className="flex items-center gap-2 border border-red-100 hover:bg-red-50 text-red-600 px-4 py-2.5 rounded-xl font-medium text-sm transition-colors ml-auto"
              >
                <Trash2 className="w-4 h-4" />
                Limpar
              </button>
            )}
          </div>
        </div>

        {/* Transcript */}
        {(isRecording || state === 'stopped' || state === 'summarizing' || state === 'done') && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-2">
                <Mic className="w-4 h-4" />
                Transcrição
              </h2>
              <span className="text-xs text-slate-400">{transcricao.replace(/\[.*?\]/g, '').trim().length} caracteres</span>
            </div>
            <textarea
              value={transcricao}
              onChange={e => setTranscricao(e.target.value)}
              disabled={isRecording || state === 'summarizing'}
              placeholder={isRecording ? 'Fale — a transcrição aparecerá aqui...' : 'Edite a transcrição se necessário'}
              rows={10}
              className="w-full text-sm text-slate-700 placeholder:text-slate-300 resize-y focus:outline-none disabled:cursor-default leading-relaxed"
            />
          </div>
        )}

        {/* Summarize button */}
        {(state === 'stopped' || state === 'summarizing' || state === 'done') && (
          <div className="mb-4">
            <button
              onClick={gerarResumo}
              disabled={!canSummarize}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-5 py-3 rounded-xl font-medium text-sm transition-colors"
            >
              {resumirMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Gerando resumo...</>
              ) : (
                <><FileText className="w-4 h-4" /> Gerar resumo com IA</>
              )}
            </button>
          </div>
        )}

        {/* Summary */}
        {resumo && state === 'done' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-700">Resumo da Reunião</h2>
              <button
                onClick={copiarResumo}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg transition-colors"
              >
                {copied ? <><Check className="w-3.5 h-3.5 text-green-500" /> Copiado!</> : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
              </button>
            </div>

            {/* Resumo geral */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p className="text-sm text-blue-900 leading-relaxed">{resumo.resumoGeral}</p>
            </div>

            <SectionCard title="Participantes" items={resumo.participantes} icon="👥" />
            <SectionCard title="Pontos Principais" items={resumo.pontosPrincipais} icon="📋" />
            <SectionCard title="Decisões" items={resumo.decisoes} icon="✅" />
            <SectionCard title="Próximos Passos" items={resumo.proximosPassos} icon="🎯" />
            <SectionCard title="Destaques" items={resumo.destaques} icon="⚠️" />
          </div>
        )}

        {/* Manual entry hint */}
        {state === 'idle' && !srSupported && (
          <div className="mt-4">
            <button
              onClick={() => setState('stopped')}
              className="text-sm text-blue-600 hover:underline"
            >
              Colar transcrição manualmente →
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
