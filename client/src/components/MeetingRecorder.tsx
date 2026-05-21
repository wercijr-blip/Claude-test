import { useState, useRef, useEffect, useCallback } from 'react'
import { Mic, Square, Download, FileText, Loader2, Copy, Check, Trash2, Monitor, Info, Upload, RefreshCw, X } from 'lucide-react'
import { trpc } from '../lib/trpc.ts'
import { toast } from '../lib/use-toast.ts'
import type { DesktopSource } from '../electron.d.ts'

// ─── Types ────────────────────────────────────────────────────────────────────

type Mode = 'mic' | 'reuniao'
type State = 'idle' | 'picking' | 'recording' | 'transcribing' | 'stopped' | 'summarizing' | 'done'

interface Resumo {
  resumoGeral: string
  participantes: string[]
  pontosPrincipais: string[]
  decisoes: string[]
  proximosPassos: string[]
  destaques: string[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const isElectron = typeof window !== 'undefined' && !!window.electronAPI?.isElectron

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySR = any

function getSR(): (new () => AnySR) | null {
  const w = window as unknown as Record<string, unknown>
  return (w['SpeechRecognition'] ?? w['webkitSpeechRecognition'] ?? null) as (new () => AnySR) | null
}

function formatDuration(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function formatBytes(b: number) {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

// ─── Source Picker (Electron only) ───────────────────────────────────────────

function SourcePicker({
  onSelect,
  onCancel,
}: {
  onSelect: (sourceId: string) => void
  onCancel: () => void
}) {
  const [sources, setSources] = useState<DesktopSource[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const s = await window.electronAPI!.getDesktopSources()
      setSources(s)
    } catch {
      toast({ title: 'Erro ao listar janelas', variant: 'error' })
    }
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Selecionar janela para gravar</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => void load()} disabled={loading} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 disabled:opacity-40">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <p className="px-5 pt-3 pb-1 text-xs text-slate-400">
          Selecione a janela do Zoom, Teams ou outra ferramenta de reunião.
          O áudio do sistema será capturado automaticamente.
        </p>

        <div className="overflow-y-auto flex-1 p-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {sources.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onSelect(s.id)}
                  className="group flex flex-col rounded-xl border border-slate-200 overflow-hidden hover:border-blue-400 hover:shadow-md transition-all text-left"
                >
                  <div className="bg-slate-100 relative aspect-video overflow-hidden">
                    {s.thumbnail ? (
                      <img src={s.thumbnail} alt={s.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Monitor className="w-8 h-8 text-slate-400" />
                      </div>
                    )}
                    {s.appIcon && (
                      <img src={s.appIcon} alt="" className="absolute bottom-1.5 right-1.5 w-5 h-5 rounded" />
                    )}
                  </div>
                  <div className="px-3 py-2">
                    <p className="text-xs font-medium text-slate-700 truncate group-hover:text-blue-700">{s.name}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Summary section ──────────────────────────────────────────────────────────

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
  const [mode, setMode] = useState<Mode>(isElectron ? 'reuniao' : 'reuniao')
  const [state, setState] = useState<State>('idle')
  const [transcricao, setTranscricao] = useState('')
  const [titulo, setTitulo] = useState('')
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [copied, setCopied] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)

  const recognitionRef = useRef<AnySR | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const transcricaoRef = useRef(transcricao)
  transcricaoRef.current = transcricao

  const configQuery = trpc.meeting.config.useQuery()
  const whisperDisponivel = configQuery.data?.whisperDisponivel ?? false

  const resumirMutation = trpc.meeting.resumir.useMutation({
    onSuccess: (data) => { setResumo(data); setState('done') },
    onError: (err) => { toast({ title: 'Erro ao gerar resumo', description: err.message, variant: 'error' }); setState('stopped') },
  })

  useEffect(() => {
    return () => {
      stopTimer()
      recognitionRef.current?.abort()
      audioCtxRef.current?.close()
      if (audioUrl) URL.revokeObjectURL(audioUrl)
    }
  }, [audioUrl])

  // ── Timer ──────────────────────────────────────────────────────────────────

  const startTimer = () => {
    setElapsed(0)
    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
  }
  const stopTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }

  // ── Speech Recognition (live mic preview) ─────────────────────────────────

  const startSR = useCallback((micStream: MediaStream) => {
    const SR = getSR()
    if (!SR) return
    const recognition = new SR()
    recognition.lang = 'pt-BR'
    recognition.continuous = true
    recognition.interimResults = true
    recognitionRef.current = recognition
    try { recognition.stream = micStream } catch { /* ignored */ }

    let finalBuffer = ''

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript as string
        if (event.results[i].isFinal) finalBuffer += t + ' '
        else interim = t
      }
      setTranscricao(finalBuffer + (interim ? `[${interim}]` : ''))
    }

    recognition.onend = () => {
      if (recognitionRef.current === recognition && timerRef.current !== null) recognition.start()
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (e: any) => {
      if (e.error === 'not-allowed') {
        toast({ title: 'Permissão de microfone negada', variant: 'error' })
        void stopRecording()
      }
    }

    recognition.start()
  }, [])

  // ── Electron: build stream from desktopCapturer source ────────────────────

  const buildElectronStream = useCallback(async (sourceId: string) => {
    // Tell main process which source to inject on next getDisplayMedia()
    await window.electronAPI!.selectSource(sourceId)

    // getDisplayMedia() is intercepted by main's setDisplayMediaRequestHandler
    const displayStream = await navigator.mediaDevices.getDisplayMedia({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      video: true as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      audio: true as any,
    })
    // Stop video tracks — we only want audio
    displayStream.getVideoTracks().forEach(t => t.stop())

    const micStream = await navigator.mediaDevices.getUserMedia({ audio: true })

    // Mix both
    const ctx = new AudioContext()
    audioCtxRef.current = ctx
    const dest = ctx.createMediaStreamDestination()
    ctx.createMediaStreamSource(micStream).connect(dest)

    const displayAudio = displayStream.getAudioTracks()
    if (displayAudio.length > 0) {
      ctx.createMediaStreamSource(new MediaStream(displayAudio)).connect(dest)
    } else {
      toast({
        title: 'Áudio do sistema não capturado',
        description: 'A janela selecionada não forneceu áudio. Gravando apenas microfone.',
        variant: 'warning',
      })
    }

    return { mixedStream: dest.stream, micStream }
  }, [])

  // ── Browser: build stream via getDisplayMedia (tab audio) ─────────────────

  const buildBrowserStream = useCallback(async () => {
    const micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    let displayStream: MediaStream | null = null

    if (mode === 'reuniao') {
      try {
        displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          audio: { echoCancellation: false, noiseSuppression: false } as any,
        })
        displayStream.getVideoTracks().forEach(t => t.stop())
      } catch {
        toast({
          title: 'Captura de aba não autorizada',
          description: 'Gravando apenas microfone.',
          variant: 'warning',
        })
      }
    }

    const ctx = new AudioContext()
    audioCtxRef.current = ctx
    const dest = ctx.createMediaStreamDestination()
    ctx.createMediaStreamSource(micStream).connect(dest)
    if (displayStream) {
      const displayAudio = displayStream.getAudioTracks()
      if (displayAudio.length > 0) {
        ctx.createMediaStreamSource(new MediaStream(displayAudio)).connect(dest)
      }
    }

    return { mixedStream: dest.stream, micStream }
  }, [mode])

  // ── Start recording ────────────────────────────────────────────────────────

  const startRecording = useCallback(async (sourceId?: string) => {
    setTranscricao('')
    setResumo(null)
    setAudioBlob(null)
    if (audioUrl) { URL.revokeObjectURL(audioUrl); setAudioUrl(null) }

    let micStream: MediaStream
    let recordStream: MediaStream

    try {
      if (isElectron && sourceId) {
        const r = await buildElectronStream(sourceId)
        micStream = r.micStream
        recordStream = r.mixedStream
      } else {
        const r = await buildBrowserStream()
        micStream = r.micStream
        recordStream = r.mixedStream
      }
    } catch (err) {
      toast({ title: 'Erro ao iniciar captura', description: (err as Error).message, variant: 'error' })
      setState('idle')
      return
    }

    audioChunksRef.current = []
    const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 32000 }
      : {}
    const recorder = new MediaRecorder(recordStream, options)
    recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
    recorder.onstop = () => {
      const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
      setAudioBlob(blob)
      setAudioUrl(URL.createObjectURL(blob))
      micStream.getTracks().forEach(t => t.stop())
    }
    recorder.start(1000)
    mediaRecorderRef.current = recorder

    startSR(micStream)
    setState('recording')
    startTimer()
  }, [audioUrl, buildElectronStream, buildBrowserStream, startSR])

  // ── Source picker callbacks ────────────────────────────────────────────────

  const onSourcePicked = useCallback((sourceId: string) => {
    setState('recording') // transition to recording, start will be called
    void startRecording(sourceId)
  }, [startRecording])

  const onPickerCancel = useCallback(() => {
    setState('idle')
  }, [])

  const handleStartClick = useCallback(() => {
    if (isElectron && mode === 'reuniao') {
      setState('picking') // show picker first
    } else {
      void startRecording()
    }
  }, [mode, startRecording])

  // ── Stop recording ─────────────────────────────────────────────────────────

  const stopRecording = useCallback(async () => {
    stopTimer()
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setTranscricao(t => t.replace(/\[.*?\]/g, '').trim())

    await new Promise<void>(resolve => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') { resolve(); return }
      mediaRecorderRef.current.addEventListener('stop', () => resolve(), { once: true })
      mediaRecorderRef.current.stop()
    })
    mediaRecorderRef.current = null
    audioCtxRef.current?.close()
    audioCtxRef.current = null
    setState('stopped')
  }, [])

  // ── Whisper transcription ──────────────────────────────────────────────────

  const transcreverWhisper = useCallback(async (blob: Blob) => {
    setState('transcribing')
    const form = new FormData()
    form.append('audio', blob, `reuniao-${Date.now()}.webm`)

    // In Electron, the backend URL may differ
    const baseUrl = isElectron ? (process.env['VITE_API_URL'] ?? 'http://localhost:3000') : ''

    try {
      const res = await fetch(`${baseUrl}/api/meeting/transcribe`, {
        method: 'POST',
        body: form,
        credentials: 'include',
      })
      const data = await res.json() as { transcricao?: string; error?: string }
      if (!res.ok || !data.transcricao) throw new Error(data.error ?? `HTTP ${res.status}`)
      setTranscricao(data.transcricao)
      toast({ title: 'Transcrição completa', variant: 'success' })
    } catch (err) {
      toast({ title: 'Erro na transcrição', description: (err as Error).message, variant: 'error' })
    }
    setState('stopped')
  }, [])

  // ── Generate summary ───────────────────────────────────────────────────────

  const gerarResumo = useCallback(() => {
    const texto = transcricaoRef.current.trim()
    if (texto.length < 20) { toast({ title: 'Transcrição muito curta', variant: 'warning' }); return }
    setState('summarizing')
    resumirMutation.mutate({ titulo: titulo || undefined, transcricao: texto })
  }, [titulo, resumirMutation])

  const resetar = useCallback(() => {
    setState('idle')
    setTranscricao('')
    setResumo(null)
    setElapsed(0)
    setTitulo('')
    setAudioBlob(null)
    if (audioUrl) { URL.revokeObjectURL(audioUrl); setAudioUrl(null) }
    audioCtxRef.current?.close()
    audioCtxRef.current = null
  }, [audioUrl])

  const copiarResumo = useCallback(() => {
    if (!resumo) return
    const texto = [
      resumo.resumoGeral,
      resumo.participantes.length ? `\nParticipantes:\n${resumo.participantes.map(p => `• ${p}`).join('\n')}` : '',
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
  const isTranscribing = state === 'transcribing'
  const canSummarize = (state === 'stopped' || state === 'done') && transcricao.trim().length >= 20
  const busy = isRecording || isTranscribing || state === 'summarizing'

  return (
    <>
      {/* Electron source picker overlay */}
      {state === 'picking' && isElectron && (
        <SourcePicker onSelect={onSourcePicked} onCancel={onPickerCancel} />
      )}

      <div className="min-h-screen bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 py-8">

          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-slate-800">Gravador de Reunião</h1>
              {isElectron && (
                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">Desktop</span>
              )}
            </div>
            <p className="text-slate-500 text-sm">
              Transcrição em tempo real + resumo automático com IA
            </p>
          </div>

          {/* Mode selector (only shown before recording starts, and not Electron-only) */}
          {state === 'idle' && !isElectron && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Modo de captura</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setMode('reuniao')}
                  className={`flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-all ${mode === 'reuniao' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Monitor className="w-4 h-4" />
                    Capturar reunião
                    {mode === 'reuniao' && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Recomendado</span>}
                  </span>
                  <span className="text-xs text-slate-400 leading-snug">
                    Aba da reunião (Google Meet, Teams web…) + microfone
                  </span>
                </button>
                <button
                  onClick={() => setMode('mic')}
                  className={`flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-all ${mode === 'mic' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Mic className="w-4 h-4" />
                    Apenas microfone
                  </span>
                  <span className="text-xs text-slate-400 leading-snug">
                    Transcrição ao vivo, captura só o que você fala
                  </span>
                </button>
              </div>

              {mode === 'reuniao' && (
                <div className="mt-3 bg-amber-50 border border-amber-100 rounded-xl p-3 flex gap-2">
                  <Info className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-800 leading-relaxed">
                    O Chrome pedirá para compartilhar uma aba.
                    Selecione a aba da reunião e <strong>marque "Compartilhar áudio da aba"</strong>.
                    {whisperDisponivel
                      ? ' A gravação completa será transcrita pelo Whisper após encerrar.'
                      : ' Configure OPENAI_API_KEY para transcrição completa.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Electron info banner */}
          {state === 'idle' && isElectron && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex gap-2 mb-4">
              <Monitor className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
              <p className="text-xs text-indigo-900 leading-relaxed">
                No modo desktop você seleciona a janela do Zoom, Teams ou qualquer app de reunião.
                O áudio do sistema é capturado diretamente — sem precisar compartilhar aba no browser.
                {whisperDisponivel
                  ? ' Após encerrar, o Whisper transcreve o áudio completo automaticamente.'
                  : ' Configure OPENAI_API_KEY para transcrição automática após a reunião.'}
              </p>
            </div>
          )}

          {/* Título */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Título da reunião (opcional)"
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              disabled={busy}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 text-sm"
            />
          </div>

          {/* Controls */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {isRecording && (
                  <span className="flex items-center gap-2 text-sm font-medium text-red-600">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    Gravando
                    {isElectron ? ' (sistema + mic)' : mode === 'reuniao' ? ' (aba + mic)' : ' (microfone)'}
                  </span>
                )}
                {isTranscribing && (
                  <span className="flex items-center gap-2 text-sm text-blue-600">
                    <Loader2 className="w-4 h-4 animate-spin" /> Transcrevendo com Whisper…
                  </span>
                )}
                {state === 'stopped' && <span className="text-sm text-slate-500">Gravação encerrada</span>}
                {state === 'idle' && <span className="text-sm text-slate-400">Pronto para gravar</span>}
              </div>
              {(isRecording || state === 'stopped' || state === 'done') && elapsed > 0 && (
                <span className="text-slate-600 font-mono text-sm tabular-nums">{formatDuration(elapsed)}</span>
              )}
            </div>

            <div className="flex gap-2 flex-wrap">
              {state === 'idle' && (
                <button
                  onClick={handleStartClick}
                  className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-5 py-2.5 rounded-xl font-medium text-sm transition-colors"
                >
                  {isElectron || mode === 'reuniao' ? <Monitor className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  {isElectron ? 'Selecionar janela e gravar' : 'Iniciar gravação'}
                </button>
              )}

              {isRecording && (
                <button
                  onClick={() => void stopRecording()}
                  className="flex items-center gap-2 bg-slate-700 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-medium text-sm transition-colors"
                >
                  <Square className="w-4 h-4" />
                  Encerrar
                </button>
              )}

              {state === 'stopped' && (
                <>
                  {audioBlob && audioUrl && (
                    <a
                      href={audioUrl}
                      download={`reuniao-${new Date().toISOString().slice(0, 10)}.webm`}
                      className="flex items-center gap-2 border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl font-medium text-sm transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Baixar áudio ({formatBytes(audioBlob.size)})
                    </a>
                  )}
                  {whisperDisponivel && audioBlob && (
                    <button
                      onClick={() => void transcreverWhisper(audioBlob)}
                      className="flex items-center gap-2 border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 py-2.5 rounded-xl font-medium text-sm transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                      Transcrever com Whisper
                    </button>
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
          {state !== 'idle' && state !== 'picking' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-2">
                  <Mic className="w-4 h-4" />
                  Transcrição
                  {isRecording && (
                    <span className="text-xs font-normal text-amber-600 normal-case">
                      {isElectron ? '(ao vivo — microfone; áudio completo via Whisper)' : '(microfone ao vivo)'}
                    </span>
                  )}
                </h2>
                <span className="text-xs text-slate-400">{transcricao.trim().length} chars</span>
              </div>
              <textarea
                value={transcricao}
                onChange={e => setTranscricao(e.target.value)}
                disabled={isRecording || isTranscribing || state === 'summarizing'}
                placeholder={isRecording ? 'O que você fala aparecerá aqui…' : 'Edite a transcrição se necessário'}
                rows={10}
                className="w-full text-sm text-slate-700 placeholder:text-slate-300 resize-y focus:outline-none disabled:cursor-default leading-relaxed"
              />
            </div>
          )}

          {/* Summarize */}
          {(state === 'stopped' || state === 'summarizing' || state === 'done') && (
            <div className="mb-4">
              <button
                onClick={gerarResumo}
                disabled={!canSummarize || resumirMutation.isPending}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-5 py-3 rounded-xl font-medium text-sm transition-colors"
              >
                {resumirMutation.isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando resumo…</>
                  : <><FileText className="w-4 h-4" /> Gerar resumo com IA</>}
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
                  {copied
                    ? <><Check className="w-3.5 h-3.5 text-green-500" /> Copiado!</>
                    : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
                </button>
              </div>

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

        </div>
      </div>
    </>
  )
}
