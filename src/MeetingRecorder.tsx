import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Mic, Square, Download, FileText, Loader2, Copy, Check,
  Trash2, Monitor, Info, Upload, RefreshCw, X,
} from 'lucide-react'
import type { DesktopSource } from './electron.d.ts'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Config { whisperDisponivel: boolean; iaDisponivel: boolean; authRequired: boolean }

type Mode  = 'mic' | 'reuniao'
type State = 'idle' | 'picking' | 'recording' | 'transcribing' | 'stopped' | 'summarizing' | 'done'

interface Resumo {
  resumoGeral: string
  participantes: string[]
  pontosPrincipais: string[]
  decisoes: string[]
  proximosPassos: string[]
  destaques: string[]
}

// ─── Audio settings ───────────────────────────────────────────────────────────
// 16 kHz · mono · 16 kbps opus → ~7 MB/hour · segments ≤ 2.3 MB (well under Whisper 25 MB limit)

const AUDIO_SAMPLE_RATE   = 16_000
const AUDIO_BITRATE       = 16_000
const SEGMENT_DURATION_MS = 20 * 60 * 1000

// ─── Helpers ─────────────────────────────────────────────────────────────────

const isElectron = typeof window !== 'undefined' && !!window.electronAPI?.isElectron

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySR = any
function getSR(): (new () => AnySR) | null {
  const w = window as unknown as Record<string, unknown>
  return (w['SpeechRecognition'] ?? w['webkitSpeechRecognition'] ?? null) as (new () => AnySR) | null
}

function formatDuration(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
}
function formatBytes(b: number) {
  return b < 1024*1024 ? `${(b/1024).toFixed(0)} KB` : `${(b/(1024*1024)).toFixed(1)} MB`
}

// ─── Source Picker (Electron) ─────────────────────────────────────────────────

function SourcePicker({ onSelect, onCancel }: { onSelect: (id: string) => void; onCancel: () => void }) {
  const [sources, setSources] = useState<DesktopSource[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try { setSources(await window.electronAPI!.getDesktopSources()) } catch { /* ignored */ }
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
            <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><X className="w-4 h-4" /></button>
          </div>
        </div>
        <p className="px-5 pt-3 pb-1 text-xs text-slate-400">Selecione a janela do Zoom, Teams, WhatsApp ou outra ferramenta de reunião.</p>
        <div className="overflow-y-auto flex-1 p-4">
          {loading ? (
            <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {sources.map(s => (
                <button key={s.id} onClick={() => onSelect(s.id)}
                  className="group flex flex-col rounded-xl border border-slate-200 overflow-hidden hover:border-blue-400 hover:shadow-md transition-all text-left">
                  <div className="bg-slate-100 relative aspect-video overflow-hidden">
                    {s.thumbnail
                      ? <img src={s.thumbnail} alt={s.name} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><Monitor className="w-8 h-8 text-slate-400" /></div>}
                    {s.appIcon && <img src={s.appIcon} alt="" className="absolute bottom-1.5 right-1.5 w-5 h-5 rounded" />}
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

// ─── Summary card ─────────────────────────────────────────────────────────────

function SectionCard({ title, items, icon }: { title: string; items: string[]; icon: string }) {
  if (!items.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">{icon} {title}</h3>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm text-slate-700">
            <span className="text-slate-400 mt-0.5 shrink-0">•</span><span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props { config: Config; apiToken: string; apiBase: string }

export default function MeetingRecorder({ config, apiToken, apiBase }: Props) {
  const [mode, setMode]             = useState<Mode>('reuniao')
  const [state, setState]           = useState<State>('idle')
  const [transcricao, setT]         = useState('')
  const [titulo, setTitulo]         = useState('')
  const [resumo, setResumo]         = useState<Resumo | null>(null)
  const [elapsed, setElapsed]       = useState(0)
  const [copied, setCopied]         = useState(false)
  const [txProgress, setTxProgress] = useState('')
  const [audioBlob, setAudioBlob]   = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl]     = useState<string | null>(null)
  const [segmentCount, setSegCount] = useState(0)
  const [summarizing, setSumm]      = useState(false)

  const recognitionRef  = useRef<AnySR | null>(null)
  const mediaRecRef     = useRef<MediaRecorder | null>(null)
  const audioChunksRef  = useRef<Blob[]>([])
  const segmentsRef     = useRef<Blob[]>([])
  const recordStreamRef = useRef<MediaStream | null>(null)
  const recOptsRef      = useRef<MediaRecorderOptions>({})
  const timerRef        = useRef<ReturnType<typeof setInterval> | null>(null)
  const segTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null)
  const audioCtxRef     = useRef<AudioContext | null>(null)
  const tRef            = useRef(transcricao)
  tRef.current = transcricao

  const headers = useCallback((): Record<string, string> =>
    apiToken ? { Authorization: `Bearer ${apiToken}` } : {}, [apiToken])

  useEffect(() => () => {
    stopTimer(); clearSegTimer()
    recognitionRef.current?.abort()
    audioCtxRef.current?.close()
    if (audioUrl) URL.revokeObjectURL(audioUrl)
  }, [audioUrl])

  const startTimer = () => { setElapsed(0); timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000) }
  const stopTimer  = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null } }
  const clearSegTimer = () => { if (segTimerRef.current) { clearTimeout(segTimerRef.current); segTimerRef.current = null } }

  // ── Speech Recognition ────────────────────────────────────────────────────

  const startSR = useCallback((mic: MediaStream) => {
    const SR = getSR(); if (!SR) return
    const r = new SR(); r.lang = 'pt-BR'; r.continuous = true; r.interimResults = true
    recognitionRef.current = r
    let buf = ''
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onresult = (e: any) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript as string
        if (e.results[i].isFinal) buf += t + ' '; else interim = t
      }
      setT(buf + (interim ? `[${interim}]` : ''))
    }
    r.onend = () => { if (recognitionRef.current === r && timerRef.current) r.start() }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onerror = (e: any) => { if (e.error === 'not-allowed') { alert('Permissão de microfone negada.'); void stopRecording() } }
    try { r.stream = mic } catch { /* ignored */ }
    r.start()
  }, [])

  // ── Segment rotation ──────────────────────────────────────────────────────

  const rotateSegment = useCallback(async () => {
    const rec = mediaRecRef.current; const stream = recordStreamRef.current
    if (!rec || rec.state === 'inactive' || !stream) return
    await new Promise<void>(resolve => { rec.addEventListener('stop', () => resolve(), { once: true }); rec.stop() })
    const blob = new Blob(audioChunksRef.current, { type: rec.mimeType || 'audio/webm' })
    segmentsRef.current.push(blob); audioChunksRef.current = []
    setSegCount(segmentsRef.current.length)
    const nr = new MediaRecorder(stream, recOptsRef.current)
    nr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
    nr.start(1000); mediaRecRef.current = nr
    segTimerRef.current = setTimeout(() => void rotateSegment(), SEGMENT_DURATION_MS)
  }, [])

  // ── Build audio stream ────────────────────────────────────────────────────

  const buildStream = useCallback(async (sourceId?: string) => {
    const ctx = new AudioContext({ sampleRate: AUDIO_SAMPLE_RATE })
    audioCtxRef.current = ctx
    const dest = ctx.createMediaStreamDestination()
    const mic = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, sampleRate: AUDIO_SAMPLE_RATE, echoCancellation: true, noiseSuppression: true } })
    ctx.createMediaStreamSource(mic).connect(dest)

    if (isElectron && sourceId) {
      await window.electronAPI!.selectSource(sourceId)
      const ds = await navigator.mediaDevices.getDisplayMedia({ video: true as never, audio: true as never })
      ds.getVideoTracks().forEach(t => t.stop())
      const at = ds.getAudioTracks()
      if (at.length) ctx.createMediaStreamSource(new MediaStream(at)).connect(dest)
    } else if (mode === 'reuniao') {
      try {
        const ds = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: { echoCancellation: false, noiseSuppression: false } as never })
        ds.getVideoTracks().forEach(t => t.stop())
        const at = ds.getAudioTracks()
        if (at.length) ctx.createMediaStreamSource(new MediaStream(at)).connect(dest)
      } catch { /* user cancelled */ }
    }
    return { mixedStream: dest.stream, micStream: mic }
  }, [mode])

  // ── Start / Stop ──────────────────────────────────────────────────────────

  const startRecording = useCallback(async (sourceId?: string) => {
    setT(''); setResumo(null); setAudioBlob(null); setSegCount(0)
    segmentsRef.current = []; audioChunksRef.current = []
    if (audioUrl) { URL.revokeObjectURL(audioUrl); setAudioUrl(null) }
    try {
      const { mixedStream, micStream } = await buildStream(sourceId)
      recordStreamRef.current = mixedStream
      const opts: MediaRecorderOptions = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: AUDIO_BITRATE }
        : { audioBitsPerSecond: AUDIO_BITRATE }
      recOptsRef.current = opts
      const rec = new MediaRecorder(mixedStream, opts)
      rec.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      rec.start(1000); mediaRecRef.current = rec
      segTimerRef.current = setTimeout(() => void rotateSegment(), SEGMENT_DURATION_MS)
      startSR(micStream); setState('recording'); startTimer()
    } catch (err) { alert(`Erro ao iniciar: ${(err as Error).message}`); setState('idle') }
  }, [audioUrl, buildStream, rotateSegment, startSR])

  const stopRecording = useCallback(async () => {
    stopTimer(); clearSegTimer()
    recognitionRef.current?.stop(); recognitionRef.current = null
    setT(t => t.replace(/\[.*?\]/g, '').trim())
    const rec = mediaRecRef.current
    if (rec && rec.state !== 'inactive') {
      await new Promise<void>(r => { rec.addEventListener('stop', () => r(), { once: true }); rec.stop() })
    }
    mediaRecRef.current = null
    if (audioChunksRef.current.length) {
      segmentsRef.current.push(new Blob(audioChunksRef.current, { type: rec?.mimeType || 'audio/webm' }))
      audioChunksRef.current = []
    }
    setSegCount(segmentsRef.current.length)
    const combined = new Blob(segmentsRef.current, { type: segmentsRef.current[0]?.type || 'audio/webm' })
    setAudioBlob(combined); setAudioUrl(URL.createObjectURL(combined))
    audioCtxRef.current?.close(); audioCtxRef.current = null; recordStreamRef.current = null
    setState('stopped')
  }, [])

  // ── Whisper transcription ─────────────────────────────────────────────────

  const transcreverWhisper = useCallback(async () => {
    const segs = segmentsRef.current; if (!segs.length) return
    setState('transcribing'); const parts: string[] = []
    for (let i = 0; i < segs.length; i++) {
      setTxProgress(`Segmento ${i + 1} de ${segs.length} (${formatBytes(segs[i].size)})…`)
      const form = new FormData()
      form.append('audio', segs[i], `seg-${String(i+1).padStart(3,'0')}.webm`)
      try {
        const r = await fetch(`${apiBase}/api/transcribe`, { method: 'POST', headers: headers(), body: form })
        const d = await r.json() as { transcricao?: string; error?: string }
        if (!r.ok || !d.transcricao) throw new Error(d.error ?? `HTTP ${r.status}`)
        parts.push(d.transcricao.trim())
      } catch (err) { alert(`Erro no segmento ${i+1}: ${(err as Error).message}`); setState('stopped'); setTxProgress(''); return }
    }
    setT(parts.join('\n\n')); setTxProgress('')
    setState('stopped')
  }, [apiBase, headers])

  // ── Summarize ─────────────────────────────────────────────────────────────

  const gerarResumo = useCallback(async () => {
    const texto = tRef.current.trim(); if (texto.length < 20) { alert('Transcrição muito curta.'); return }
    setSumm(true); setState('summarizing')
    try {
      const r = await fetch(`${apiBase}/api/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers() },
        body: JSON.stringify({ titulo: titulo || undefined, transcricao: texto }),
      })
      const d = await r.json() as Resumo | { error: string }
      if (!r.ok) throw new Error((d as { error: string }).error)
      setResumo(d as Resumo); setState('done')
    } catch (err) { alert(`Erro ao gerar resumo: ${(err as Error).message}`); setState('stopped') }
    setSumm(false)
  }, [titulo, apiBase, headers])

  const resetar = useCallback(() => {
    setState('idle'); setT(''); setResumo(null); setElapsed(0); setTitulo(''); setAudioBlob(null); setSegCount(0); setTxProgress('')
    segmentsRef.current = []
    if (audioUrl) { URL.revokeObjectURL(audioUrl); setAudioUrl(null) }
    audioCtxRef.current?.close(); audioCtxRef.current = null
  }, [audioUrl])

  const copiarResumo = useCallback(() => {
    if (!resumo) return
    const t = [
      resumo.resumoGeral,
      resumo.participantes.length  ? `\nParticipantes:\n${resumo.participantes.map(p => `• ${p}`).join('\n')}` : '',
      resumo.pontosPrincipais.length ? `\nPontos Principais:\n${resumo.pontosPrincipais.map(p => `• ${p}`).join('\n')}` : '',
      resumo.decisoes.length       ? `\nDecisões:\n${resumo.decisoes.map(p => `• ${p}`).join('\n')}` : '',
      resumo.proximosPassos.length ? `\nPróximos Passos:\n${resumo.proximosPassos.map(p => `• ${p}`).join('\n')}` : '',
      resumo.destaques.length      ? `\nDestaques:\n${resumo.destaques.map(p => `• ${p}`).join('\n')}` : '',
    ].filter(Boolean).join('\n')
    void navigator.clipboard.writeText(t).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }, [resumo])

  const isRecording    = state === 'recording'
  const isTranscribing = state === 'transcribing'
  const canSummarize   = (state === 'stopped' || state === 'done') && transcricao.trim().length >= 20
  const busy           = isRecording || isTranscribing || summarizing

  return (
    <>
      {state === 'picking' && isElectron && (
        <SourcePicker onSelect={(id) => { setState('idle'); void startRecording(id) }} onCancel={() => setState('idle')} />
      )}

      <div className="min-h-screen bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 py-8">

          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-slate-800">Gravador de Reunião</h1>
              {isElectron && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">Desktop</span>}
            </div>
            <p className="text-slate-500 text-sm">Opus 16 kbps · mono · 16 kHz · segmentação automática a cada 20 min</p>
          </div>

          {/* Mode selector — browser only */}
          {state === 'idle' && !isElectron && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Modo de captura</p>
              <div className="grid grid-cols-2 gap-3">
                {(['reuniao', 'mic'] as Mode[]).map(m => (
                  <button key={m} onClick={() => setMode(m)}
                    className={`flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-all ${mode === m ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                    <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      {m === 'reuniao' ? <Monitor className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                      {m === 'reuniao' ? 'Capturar reunião' : 'Apenas microfone'}
                      {m === 'reuniao' && mode === 'reuniao' && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Recomendado</span>}
                    </span>
                    <span className="text-xs text-slate-400 leading-snug">
                      {m === 'reuniao' ? 'Aba do navegador (Meet, Teams web) + microfone' : 'Transcrição ao vivo, só o que você fala'}
                    </span>
                  </button>
                ))}
              </div>
              {mode === 'reuniao' && (
                <div className="mt-3 bg-amber-50 border border-amber-100 rounded-xl p-3 flex gap-2">
                  <Info className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-800 leading-relaxed">
                    Selecione a aba da reunião e <strong>marque "Compartilhar áudio da aba"</strong>.
                    {config.whisperDisponivel ? ' O Whisper transcreverá o áudio completo após encerrar.' : ' Configure OPENAI_API_KEY para transcrição automática.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {state === 'idle' && isElectron && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex gap-2 mb-4">
              <Monitor className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
              <p className="text-xs text-indigo-900 leading-relaxed">
                Selecione a janela do Zoom, Teams, WhatsApp ou qualquer app de reunião. Áudio capturado via loopback do sistema.
                {config.whisperDisponivel ? ' Whisper transcreve cada segmento automaticamente após encerrar.' : ''}
              </p>
            </div>
          )}

          <div className="mb-4">
            <input type="text" placeholder="Título da reunião (opcional)" value={titulo} onChange={e => setTitulo(e.target.value)} disabled={busy}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 text-sm" />
          </div>

          {/* Controls */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3 flex-wrap">
                {isRecording && (
                  <>
                    <span className="flex items-center gap-2 text-sm font-medium text-red-600">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      Gravando{isElectron ? ' (sistema + mic)' : mode === 'reuniao' ? ' (aba + mic)' : ' (microfone)'}
                    </span>
                    {segmentCount > 0 && <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{segmentCount} segmento{segmentCount > 1 ? 's' : ''} salvo{segmentCount > 1 ? 's' : ''}</span>}
                  </>
                )}
                {isTranscribing && <span className="flex items-center gap-2 text-sm text-blue-600"><Loader2 className="w-4 h-4 animate-spin" />{txProgress || 'Transcrevendo…'}</span>}
                {state === 'stopped' && <span className="text-sm text-slate-500">Gravação encerrada</span>}
                {state === 'idle'    && <span className="text-sm text-slate-400">Pronto para gravar</span>}
              </div>
              {(isRecording || state === 'stopped' || state === 'done') && elapsed > 0 && (
                <span className="text-slate-600 font-mono text-sm tabular-nums shrink-0">{formatDuration(elapsed)}</span>
              )}
            </div>

            <div className="flex gap-2 flex-wrap">
              {state === 'idle' && (
                <button onClick={() => isElectron ? setState('picking') : void startRecording()}
                  className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-5 py-2.5 rounded-xl font-medium text-sm transition-colors">
                  {isElectron || mode === 'reuniao' ? <Monitor className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  {isElectron ? 'Selecionar janela e gravar' : 'Iniciar gravação'}
                </button>
              )}
              {isRecording && (
                <button onClick={() => void stopRecording()}
                  className="flex items-center gap-2 bg-slate-700 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-medium text-sm transition-colors">
                  <Square className="w-4 h-4" /> Encerrar
                </button>
              )}
              {state === 'stopped' && (
                <>
                  {audioBlob && audioUrl && (
                    <a href={audioUrl} download={`reuniao-${new Date().toISOString().slice(0,10)}.webm`}
                      className="flex items-center gap-2 border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl font-medium text-sm transition-colors">
                      <Download className="w-4 h-4" />Baixar ({formatBytes(audioBlob.size)}{segmentCount > 1 ? `, ${segmentCount} segs` : ''})
                    </a>
                  )}
                  {config.whisperDisponivel && segmentsRef.current.length > 0 && (
                    <button onClick={() => void transcreverWhisper()}
                      className="flex items-center gap-2 border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 py-2.5 rounded-xl font-medium text-sm transition-colors">
                      <Upload className="w-4 h-4" />Transcrever{segmentCount > 1 ? ` (${segmentCount} segs)` : ''} com Whisper
                    </button>
                  )}
                </>
              )}
              {(state === 'stopped' || state === 'done') && (
                <button onClick={resetar} className="flex items-center gap-2 border border-red-100 hover:bg-red-50 text-red-600 px-4 py-2.5 rounded-xl font-medium text-sm transition-colors ml-auto">
                  <Trash2 className="w-4 h-4" /> Limpar
                </button>
              )}
            </div>
          </div>

          {/* Transcript */}
          {state !== 'idle' && state !== 'picking' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-2">
                  <Mic className="w-4 h-4" /> Transcrição
                  {isRecording && <span className="text-xs font-normal text-amber-600 normal-case">(microfone ao vivo)</span>}
                </h2>
                <span className="text-xs text-slate-400">{transcricao.trim().length} chars</span>
              </div>
              <textarea value={transcricao} onChange={e => setT(e.target.value)}
                disabled={isRecording || isTranscribing || summarizing}
                placeholder={isRecording ? 'O que você fala aparecerá aqui…' : 'Edite a transcrição se necessário'}
                rows={10} className="w-full text-sm text-slate-700 placeholder:text-slate-300 resize-y focus:outline-none disabled:cursor-default leading-relaxed" />
            </div>
          )}

          {/* Summarize */}
          {(state === 'stopped' || state === 'summarizing' || state === 'done') && (
            <div className="mb-4">
              <button onClick={() => void gerarResumo()} disabled={!canSummarize || summarizing || !config.iaDisponivel}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-5 py-3 rounded-xl font-medium text-sm transition-colors">
                {summarizing ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando resumo…</> : <><FileText className="w-4 h-4" /> Gerar resumo com IA</>}
              </button>
              {!config.iaDisponivel && <p className="text-xs text-slate-400 text-center mt-2">Configure CLAUDE_API_KEY para habilitar o resumo.</p>}
            </div>
          )}

          {/* Summary */}
          {resumo && state === 'done' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-slate-700">Resumo da Reunião</h2>
                <button onClick={copiarResumo} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg transition-colors">
                  {copied ? <><Check className="w-3.5 h-3.5 text-green-500" /> Copiado!</> : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
                </button>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <p className="text-sm text-blue-900 leading-relaxed">{resumo.resumoGeral}</p>
              </div>
              <SectionCard title="Participantes"    items={resumo.participantes}   icon="👥" />
              <SectionCard title="Pontos Principais" items={resumo.pontosPrincipais} icon="📋" />
              <SectionCard title="Decisões"          items={resumo.decisoes}        icon="✅" />
              <SectionCard title="Próximos Passos"   items={resumo.proximosPassos}  icon="🎯" />
              <SectionCard title="Destaques"         items={resumo.destaques}       icon="⚠️" />
            </div>
          )}

        </div>
      </div>
    </>
  )
}
