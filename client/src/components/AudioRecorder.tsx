import { useState, useRef, useCallback, useEffect } from "react";
import { trpc } from "../lib/trpc.ts";
import { useToast } from "./Toast.tsx";

type RecordingMode = "presencial" | "teleconsulta";
type RecorderState =
  | "idle"
  | "selecting"
  | "requesting"
  | "recording"
  | "uploading"
  | "transcribing"
  | "done"
  | "error";

interface AudioRecorderProps {
  sessionId: number;
  onTranscricao: (texto: string) => void;
}

const SUPPORTED_MIME =
  ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/ogg", "audio/mp4"]
    .find((t) => MediaRecorder.isTypeSupported(t)) ?? "audio/webm";

const CONTENT_TYPE = (
  SUPPORTED_MIME.startsWith("audio/mp4") ? "audio/mp4"
  : SUPPORTED_MIME.startsWith("audio/ogg") ? "audio/ogg"
  : "audio/webm"
) as "audio/webm" | "audio/mp4" | "audio/ogg";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function AudioRecorder({ sessionId, onTranscricao }: AudioRecorderProps) {
  const { toast } = useToast();
  const [state, setState] = useState<RecorderState>("idle");
  const [mode, setMode] = useState<RecordingMode>("presencial");
  const [elapsed, setElapsed] = useState(0);
  const [transcricao, setTranscricao] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamsRef = useRef<MediaStream[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getUploadUrl = trpc.scriba.getAudioUploadUrl.useMutation();
  const transcreverAudio = trpc.scriba.transcreverAudio.useMutation();

  const stopAllTracks = useCallback(() => {
    streamsRef.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
    streamsRef.current = [];
    audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => () => { stopAllTracks(); stopTimer(); }, [stopAllTracks, stopTimer]);

  const startTimer = useCallback(() => {
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  }, []);

  const uploadAndTranscribe = useCallback(
    async (blob: Blob, s3Key: string) => {
      setState("uploading");
      try {
        const uploadData = await getUploadUrl.mutateAsync({ contentType: CONTENT_TYPE });
        await fetch(uploadData.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": CONTENT_TYPE },
          body: blob,
        });
        setState("transcribing");
        const result = await transcreverAudio.mutateAsync({ s3Key: uploadData.s3Key });
        setTranscricao(result.transcricao);
        onTranscricao(result.transcricao);
        setState("done");
      } catch (err) {
        toast(err instanceof Error ? err.message : "Erro ao transcrever", "error");
        setState("error");
      }
    },
    [getUploadUrl, transcreverAudio, onTranscricao, toast],
  );

  const startRecording = useCallback(
    async (selectedMode: RecordingMode) => {
      setState("requesting");
      chunksRef.current = [];
      setTranscricao("");

      try {
        let finalStream: MediaStream;

        if (selectedMode === "presencial") {
          finalStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          streamsRef.current = [finalStream];
        } else {
          // Captura microfone + áudio da aba (teleconsulta)
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

          // getDisplayMedia precisa de interação do usuário — pede ao usuário
          // para selecionar a aba do WhatsApp/Meet e marcar "Compartilhar áudio da aba"
          const displayStream = await navigator.mediaDevices.getDisplayMedia({
            audio: {
              echoCancellation: false,
              noiseSuppression: false,
              sampleRate: 16000,
            },
            video: true, // obrigatório em Chrome para getDisplayMedia funcionar
          });

          // Remove tracks de vídeo — só queremos o áudio
          displayStream.getVideoTracks().forEach((t) => t.stop());

          streamsRef.current = [micStream, displayStream];

          // Mixa microfone + áudio da aba em um único stream
          const audioCtx = new AudioContext();
          audioCtxRef.current = audioCtx;
          const dest = audioCtx.createMediaStreamDestination();

          audioCtx.createMediaStreamSource(micStream).connect(dest);

          const tabAudioTracks = displayStream.getAudioTracks();
          if (tabAudioTracks.length > 0) {
            audioCtx.createMediaStreamSource(displayStream).connect(dest);
          } else {
            toast("Nenhum áudio da aba detectado — gravando apenas microfone", "info");
          }

          finalStream = dest.stream;
        }

        const recorder = new MediaRecorder(finalStream, { mimeType: SUPPORTED_MIME });
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onstop = async () => {
          stopTimer();
          stopAllTracks();
          const blob = new Blob(chunksRef.current, { type: CONTENT_TYPE });
          // s3Key gerado pelo servidor no próximo passo — passamos placeholder
          await uploadAndTranscribe(blob, "");
        };

        recorder.onerror = () => {
          stopTimer();
          stopAllTracks();
          setState("error");
          toast("Erro no gravador de áudio", "error");
        };

        recorder.start(2000); // chunks a cada 2s para memória eficiente
        setState("recording");
        startTimer();
      } catch (err) {
        stopAllTracks();
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("Permission denied") || msg.includes("NotAllowedError")) {
          toast("Permissão de áudio negada — verifique as configurações do browser", "error");
        } else if (msg.includes("NotSupportedError")) {
          toast("Este browser não suporta captura de tela com áudio", "error");
        } else {
          toast(`Erro ao iniciar gravação: ${msg}`, "error");
        }
        setState("idle");
      }
    },
    [startTimer, stopTimer, stopAllTracks, uploadAndTranscribe, toast],
  );

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
  }, []);

  const reset = useCallback(() => {
    stopAllTracks();
    stopTimer();
    chunksRef.current = [];
    setElapsed(0);
    setTranscricao("");
    setState("idle");
  }, [stopAllTracks, stopTimer]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (state === "idle" || state === "selecting") {
    return (
      <div className="space-y-3">
        <p className="text-xs text-slate-500">
          Selecione o modo de gravação:
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => startRecording("presencial")}
            className="flex flex-col items-center gap-1.5 border-2 border-slate-200 hover:border-blue-400 rounded-xl p-4 transition-colors group"
          >
            <span className="text-2xl">🎤</span>
            <span className="text-sm font-medium text-slate-700 group-hover:text-blue-700">
              Presencial
            </span>
            <span className="text-xs text-slate-400 text-center">
              Apenas microfone
            </span>
          </button>
          <button
            onClick={() => startRecording("teleconsulta")}
            className="flex flex-col items-center gap-1.5 border-2 border-slate-200 hover:border-violet-400 rounded-xl p-4 transition-colors group"
          >
            <span className="text-2xl">💻</span>
            <span className="text-sm font-medium text-slate-700 group-hover:text-violet-700">
              Teleconsulta
            </span>
            <span className="text-xs text-slate-400 text-center">
              Mic + áudio da aba
            </span>
          </button>
        </div>
        {state === "idle" && (
          <p className="text-xs text-slate-400">
            Teleconsulta captura WhatsApp Web, Google Meet, Teams e similares —
            selecione a aba e marque "Compartilhar áudio" quando o browser perguntar.
          </p>
        )}
      </div>
    );
  }

  if (state === "requesting") {
    return (
      <div className="flex items-center gap-3 py-3">
        <div className="w-4 h-4 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-sm text-slate-500">Aguardando permissão de áudio…</p>
      </div>
    );
  }

  if (state === "recording") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
          <span className="text-sm font-mono font-medium text-slate-700">
            {formatTime(elapsed)}
          </span>
          <span className="text-xs text-slate-400 ml-auto">
            {mode === "teleconsulta" ? "💻 Mic + aba" : "🎤 Microfone"}
          </span>
        </div>
        <button
          onClick={stopRecording}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 rounded-xl transition-colors text-sm"
        >
          Parar gravação
        </button>
      </div>
    );
  }

  if (state === "uploading" || state === "transcribing") {
    return (
      <div className="flex items-center gap-3 py-3">
        <div className="w-4 h-4 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-sm text-slate-500">
          {state === "uploading" ? "Enviando áudio…" : "Transcrevendo com Whisper…"}
        </p>
      </div>
    );
  }

  if (state === "done" || state === "error") {
    return (
      <div className="space-y-3">
        {state === "done" && transcricao && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-slate-600">Transcrição</p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(transcricao).catch(() => undefined);
                  toast("Copiado", "success");
                }}
                className="text-xs text-blue-600 hover:underline"
              >
                Copiar
              </button>
            </div>
            <textarea
              value={transcricao}
              onChange={(e) => setTranscricao(e.target.value)}
              rows={6}
              className="w-full text-sm text-slate-700 border border-slate-200 rounded-xl p-3 resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </>
        )}
        {state === "error" && (
          <p className="text-sm text-red-500">Falha na transcrição. Tente novamente.</p>
        )}
        <button
          onClick={reset}
          className="text-sm text-slate-500 hover:text-slate-700 underline"
        >
          Nova gravação
        </button>
      </div>
    );
  }

  return null;
}
