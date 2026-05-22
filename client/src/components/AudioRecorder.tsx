import { useState, useRef, useCallback, useEffect } from "react";
import { trpc } from "../lib/trpc.ts";
import { useToast } from "./Toast.tsx";

// ── Types ─────────────────────────────────────────────────────────────────────

type RecordingMode = "presencial" | "teleconsulta" | "app_desktop";
type RecorderState =
  | "idle"
  | "device_pick"
  | "requesting"
  | "recording"
  | "uploading"
  | "transcribing"
  | "done"
  | "error";

interface AudioDevice {
  deviceId: string;
  label: string;
  isVirtualCable: boolean;
}

interface AudioRecorderProps {
  sessionId: number;
  onTranscricao: (texto: string) => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SUPPORTED_MIME =
  [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "audio/mp4",
  ].find((t) => MediaRecorder.isTypeSupported(t)) ?? "audio/webm";

const CONTENT_TYPE = (
  SUPPORTED_MIME.startsWith("audio/mp4")
    ? "audio/mp4"
    : SUPPORTED_MIME.startsWith("audio/ogg")
      ? "audio/ogg"
      : "audio/webm"
) as "audio/webm" | "audio/mp4" | "audio/ogg";

// Keywords that identify virtual audio cables across Mac/Windows/Linux
const VIRTUAL_CABLE_KEYWORDS = [
  "blackhole",
  "vb-cable",
  "vb cable",
  "voicemeeter",
  "virtual cable",
  "virtual audio",
  "loopback",
  "soundflower",
  "jack",
  "wasapi loopback",
];

function isVirtualCable(label: string): boolean {
  const lower = label.toLowerCase();
  return VIRTUAL_CABLE_KEYWORDS.some((kw) => lower.includes(kw));
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// ── Setup guide content ───────────────────────────────────────────────────────

function SetupGuide({ onClose }: { onClose: () => void }) {
  const [os, setOs] = useState<"mac" | "windows">("mac");

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-800">
              Configurar captura de apps desktop
            </h3>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 text-xl leading-none"
            >
              ×
            </button>
          </div>

          <p className="text-sm text-slate-500 mb-4">
            Apps como WhatsApp Desktop, Zoom e Teams usam áudio nativo do
            sistema. Um <strong>cabo de áudio virtual</strong> (gratuito) cria
            um dispositivo que o CIS consegue capturar como se fosse um
            microfone.
          </p>

          {/* OS selector */}
          <div className="flex gap-2 mb-5">
            {(["mac", "windows"] as const).map((o) => (
              <button
                key={o}
                onClick={() => setOs(o)}
                className={[
                  "flex-1 py-2 rounded-xl text-sm font-medium transition-colors",
                  os === o
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                ].join(" ")}
              >
                {o === "mac" ? "🍎 macOS" : "🪟 Windows"}
              </button>
            ))}
          </div>

          {os === "mac" ? <MacGuide /> : <WindowsGuide />}

          <div className="mt-5 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-xs text-amber-700">
              <strong>Após configurar:</strong> recarregue o CIS, clique em "App
              Desktop" e selecione o cabo virtual na lista de dispositivos. Ele
              aparecerá destacado automaticamente.
            </p>
          </div>

          <button
            onClick={onClose}
            className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl transition-colors text-sm"
          >
            Entendi, vou configurar
          </button>
        </div>
      </div>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 text-sm text-slate-700">
      <span className="shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">
        {n}
      </span>
      <p className="mt-0.5">{children}</p>
    </div>
  );
}

function MacGuide() {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
        BlackHole 2ch (gratuito, sem latência)
      </p>
      <Step n={1}>
        Baixe o <strong>BlackHole 2ch</strong> em{" "}
        <a
          href="https://existential.audio/blackhole/"
          target="_blank"
          rel="noreferrer"
          className="text-blue-600 underline"
        >
          existential.audio/blackhole
        </a>{" "}
        e instale.
      </Step>
      <Step n={2}>
        Abra <strong>Configurações de Som</strong> do macOS → aba{" "}
        <strong>Saída</strong> → selecione <strong>BlackHole 2ch</strong> como
        saída padrão do sistema.
      </Step>
      <Step n={3}>
        Para continuar ouvindo a chamada enquanto grava, abra o{" "}
        <strong>Configuração de MIDI de Áudio</strong> (pasta Utilitários) →
        crie um <strong>Dispositivo de Múltiplas Saídas</strong> marcando seus
        fones/alto-falantes + BlackHole 2ch. Use esse dispositivo como saída.
      </Step>
      <Step n={4}>
        No WhatsApp / Zoom / Teams Desktop: vá em Configurações de Áudio e
        defina a <strong>saída</strong> para <strong>BlackHole 2ch</strong> (ou
        para o dispositivo múltiplas saídas criado).
      </Step>
      <Step n={5}>
        No CIS, clique em <strong>App Desktop</strong> → o BlackHole 2ch
        aparecerá destacado na lista de dispositivos.
      </Step>
    </div>
  );
}

function WindowsGuide() {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
        VB-CABLE (gratuito, donationware)
      </p>
      <Step n={1}>
        Baixe o <strong>VB-CABLE Driver</strong> em{" "}
        <a
          href="https://vb-audio.com/Cable/"
          target="_blank"
          rel="noreferrer"
          className="text-blue-600 underline"
        >
          vb-audio.com/Cable
        </a>
        , extraia o zip e execute <strong>VBCABLE_Setup_x64.exe</strong> como
        administrador. Reinicie se pedido.
      </Step>
      <Step n={2}>
        Clique com botão direito no ícone de som na barra de tarefas →{" "}
        <strong>Sons</strong> → aba <strong>Reprodução</strong> → defina{" "}
        <strong>CABLE Input</strong> como dispositivo padrão.
      </Step>
      <Step n={3}>
        Para continuar ouvindo: aba <strong>Gravação</strong> → clique duas
        vezes em <strong>CABLE Output</strong> → aba <strong>Ouvir</strong> →
        marque "Ouvir este dispositivo" e selecione seus fones/caixas.
      </Step>
      <Step n={4}>
        No WhatsApp / Zoom / Teams Desktop: Configurações de Áudio → defina{" "}
        <strong>Alto-Falante</strong> para{" "}
        <strong>CABLE Input (VB-Audio)</strong>.
      </Step>
      <Step n={5}>
        No CIS, clique em <strong>App Desktop</strong> → o VB-Cable aparecerá
        destacado na lista.
      </Step>
    </div>
  );
}

// ── Device Picker ─────────────────────────────────────────────────────────────

function DevicePicker({
  onSelect,
  onBack,
}: {
  onSelect: (micId: string | null, cableId: string | null) => void;
  onBack: () => void;
}) {
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [micId, setMicId] = useState<string>("default");
  const [cableId, setCableId] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Need at least one getUserMedia call first so labels are visible
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        stream.getTracks().forEach((t) => t.stop());
        return navigator.mediaDevices.enumerateDevices();
      })
      .then((list) => {
        const inputs = list
          .filter((d) => d.kind === "audioinput")
          .map((d) => ({
            deviceId: d.deviceId,
            label: d.label || `Microfone ${d.deviceId.slice(0, 6)}`,
            isVirtualCable: isVirtualCable(d.label),
          }));
        setDevices(inputs);

        // Auto-select first virtual cable found
        const cable = inputs.find((d) => d.isVirtualCable);
        if (cable) setCableId(cable.deviceId);

        // Auto-select first non-virtual as mic
        const mic = inputs.find((d) => !d.isVirtualCable);
        if (mic) setMicId(mic.deviceId);
      })
      .catch(() => setDevices([]))
      .finally(() => setLoading(false));
  }, []);

  const virtualCables = devices.filter((d) => d.isVirtualCable);
  const microphones = devices.filter((d) => !d.isVirtualCable);

  return (
    <>
      {showGuide && <SetupGuide onClose={() => setShowGuide(false)} />}

      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
            <div className="w-4 h-4 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
            Listando dispositivos…
          </div>
        ) : (
          <>
            {/* Virtual cables */}
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">
                Cabo virtual detectado
              </p>
              {virtualCables.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center">
                  <p className="text-sm text-slate-400 mb-2">
                    Nenhum cabo virtual encontrado
                  </p>
                  <button
                    onClick={() => setShowGuide(true)}
                    className="text-sm text-blue-600 underline"
                  >
                    Ver instruções de instalação
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {virtualCables.map((d) => (
                    <label
                      key={d.deviceId}
                      className={[
                        "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors",
                        cableId === d.deviceId
                          ? "border-violet-400 bg-violet-50"
                          : "border-slate-200 hover:border-violet-300",
                      ].join(" ")}
                    >
                      <input
                        type="checkbox"
                        checked={cableId === d.deviceId}
                        onChange={(e) =>
                          setCableId(e.target.checked ? d.deviceId : null)
                        }
                        className="accent-violet-600"
                      />
                      <span className="text-sm text-slate-700">{d.label}</span>
                      <span className="ml-auto text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
                        cabo virtual
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Microphones */}
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">
                Microfone (voz do médico)
              </p>
              <div className="space-y-1.5">
                {microphones.map((d) => (
                  <label
                    key={d.deviceId}
                    className={[
                      "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors",
                      micId === d.deviceId
                        ? "border-blue-400 bg-blue-50"
                        : "border-slate-200 hover:border-blue-300",
                    ].join(" ")}
                  >
                    <input
                      type="radio"
                      name="mic"
                      checked={micId === d.deviceId}
                      onChange={() => setMicId(d.deviceId)}
                      className="accent-blue-600"
                    />
                    <span className="text-sm text-slate-700">{d.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {virtualCables.length > 0 && !cableId && (
              <p className="text-xs text-amber-600">
                Selecione o cabo virtual para capturar o áudio do app desktop.
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={onBack}
                className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm hover:bg-slate-50 transition-colors"
              >
                Voltar
              </button>
              <button
                onClick={() => onSelect(micId, cableId)}
                disabled={!cableId && virtualCables.length > 0}
                className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white font-medium rounded-xl text-sm transition-colors"
              >
                Iniciar gravação
              </button>
            </div>

            {virtualCables.length === 0 && (
              <button
                onClick={() => setShowGuide(true)}
                className="w-full text-sm text-slate-400 hover:text-slate-600 underline"
              >
                Como instalar cabo virtual?
              </button>
            )}
          </>
        )}
      </div>
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AudioRecorder({
  sessionId,
  onTranscricao,
}: AudioRecorderProps) {
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

  useEffect(
    () => () => {
      stopAllTracks();
      stopTimer();
    },
    [stopAllTracks, stopTimer],
  );

  const startTimer = useCallback(() => {
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  }, []);

  const uploadAndTranscribe = useCallback(
    async (blob: Blob) => {
      setState("uploading");
      try {
        const uploadData = await getUploadUrl.mutateAsync({
          contentType: CONTENT_TYPE,
        });
        await fetch(uploadData.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": CONTENT_TYPE },
          body: blob,
        });
        setState("transcribing");
        const result = await transcreverAudio.mutateAsync({
          s3Key: uploadData.s3Key,
        });
        setTranscricao(result.transcricao);
        onTranscricao(result.transcricao);
        setState("done");
      } catch (err) {
        toast(
          err instanceof Error ? err.message : "Erro ao transcrever",
          "error",
        );
        setState("error");
      }
    },
    [getUploadUrl, transcreverAudio, onTranscricao, toast],
  );

  const startRecordingWithStream = useCallback(
    (finalStream: MediaStream) => {
      const recorder = new MediaRecorder(finalStream, {
        mimeType: SUPPORTED_MIME,
      });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stopTimer();
        stopAllTracks();
        const blob = new Blob(chunksRef.current, { type: CONTENT_TYPE });
        await uploadAndTranscribe(blob);
      };

      recorder.onerror = () => {
        stopTimer();
        stopAllTracks();
        setState("error");
        toast("Erro no gravador de áudio", "error");
      };

      recorder.start(2000);
      setState("recording");
      startTimer();
    },
    [startTimer, stopTimer, stopAllTracks, uploadAndTranscribe, toast],
  );

  const startPresencial = useCallback(async () => {
    setState("requesting");
    chunksRef.current = [];
    setTranscricao("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamsRef.current = [stream];
      startRecordingWithStream(stream);
    } catch (err) {
      setState("idle");
      toast(permissionErrorMsg(err), "error");
    }
  }, [startRecordingWithStream, toast]);

  const startTeleconsulta = useCallback(async () => {
    setState("requesting");
    chunksRef.current = [];
    setTranscricao("");
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        audio: { echoCancellation: false, noiseSuppression: false },
        video: true,
      });
      displayStream.getVideoTracks().forEach((t) => t.stop());

      streamsRef.current = [micStream, displayStream];

      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const dest = audioCtx.createMediaStreamDestination();
      audioCtx.createMediaStreamSource(micStream).connect(dest);

      if (displayStream.getAudioTracks().length > 0) {
        audioCtx.createMediaStreamSource(displayStream).connect(dest);
      } else {
        toast("Aba sem áudio — gravando apenas microfone", "info");
      }

      startRecordingWithStream(dest.stream);
    } catch (err) {
      stopAllTracks();
      setState("idle");
      toast(permissionErrorMsg(err), "error");
    }
  }, [startRecordingWithStream, stopAllTracks, toast]);

  const startAppDesktop = useCallback(
    async (micId: string | null, cableId: string | null) => {
      setState("requesting");
      chunksRef.current = [];
      setTranscricao("");
      try {
        const audioCtx = new AudioContext();
        audioCtxRef.current = audioCtx;
        const dest = audioCtx.createMediaStreamDestination();

        if (micId) {
          const micStream = await navigator.mediaDevices.getUserMedia({
            audio: { deviceId: { exact: micId } },
          });
          streamsRef.current.push(micStream);
          audioCtx.createMediaStreamSource(micStream).connect(dest);
        }

        if (cableId) {
          const cableStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              deviceId: { exact: cableId },
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
            },
          });
          streamsRef.current.push(cableStream);
          audioCtx.createMediaStreamSource(cableStream).connect(dest);
        }

        startRecordingWithStream(dest.stream);
      } catch (err) {
        stopAllTracks();
        setState("idle");
        toast(permissionErrorMsg(err), "error");
      }
    },
    [startRecordingWithStream, stopAllTracks, toast],
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

  // ── Render ──────────────────────────────────────────────────────────────────

  if (state === "idle") {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <ModeButton
            emoji="🎤"
            label="Presencial"
            sub="Microfone"
            color="blue"
            onClick={() => startPresencial()}
          />
          <ModeButton
            emoji="💻"
            label="Teleconsulta"
            sub="Mic + aba web"
            color="indigo"
            onClick={() => {
              setMode("teleconsulta");
              startTeleconsulta();
            }}
          />
          <ModeButton
            emoji="📱"
            label="App Desktop"
            sub="WhatsApp, Zoom…"
            color="violet"
            onClick={() => {
              setMode("app_desktop");
              setState("device_pick");
            }}
          />
        </div>
        <p className="text-[11px] text-stone-400 leading-relaxed">
          <strong className="text-stone-500">App Desktop</strong> requer
          BlackHole (Mac) ou VB-Cable (Windows) — instruções no próximo passo.
        </p>
      </div>
    );
  }

  if (state === "device_pick") {
    return (
      <DevicePicker
        onSelect={(micId, cableId) => startAppDesktop(micId, cableId)}
        onBack={() => setState("idle")}
      />
    );
  }

  if (state === "requesting") {
    return (
      <div className="flex items-center gap-3 py-3">
        <div className="w-4 h-4 border-2 border-stone-200 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-sm text-stone-500">Aguardando permissão de áudio…</p>
      </div>
    );
  }

  if (state === "recording") {
    const modeLabel =
      mode === "teleconsulta"
        ? "💻 Mic + aba"
        : mode === "app_desktop"
          ? "📱 Mic + cabo virtual"
          : "🎤 Microfone";
    return (
      <div className="space-y-3">
        <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center gap-3">
          <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shrink-0" />
          <span className="text-sm font-mono font-semibold text-red-700 tabular-nums">
            {formatTime(elapsed)}
          </span>
          <span className="text-xs text-red-400 ml-auto">{modeLabel}</span>
        </div>
        <button
          onClick={stopRecording}
          className="w-full bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-medium py-3 rounded-xl transition-colors text-sm shadow-sm"
        >
          ■ Parar gravação
        </button>
      </div>
    );
  }

  if (state === "uploading" || state === "transcribing") {
    return (
      <div className="bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 flex items-center gap-3">
        <div className="w-4 h-4 border-2 border-stone-300 border-t-blue-600 rounded-full animate-spin shrink-0" />
        <div>
          <p className="text-sm text-stone-700 font-medium">
            {state === "uploading"
              ? "Enviando áudio…"
              : "Transcrevendo com Whisper…"}
          </p>
          <p className="text-[11px] text-stone-400">
            {state === "uploading"
              ? "Fazendo upload para processamento"
              : "Reconhecimento de fala em pt-BR médico"}
          </p>
        </div>
      </div>
    );
  }

  if (state === "done" || state === "error") {
    return (
      <div className="space-y-3">
        {state === "done" && transcricao && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-400">
                Transcrição
              </p>
              <button
                onClick={() => {
                  navigator.clipboard
                    .writeText(transcricao)
                    .catch(() => undefined);
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
              className="w-full text-sm text-stone-700 border border-stone-200 rounded-xl p-3 resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 bg-stone-50"
            />
          </>
        )}
        {state === "error" && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-sm text-red-600 font-medium">
              Falha na transcrição.
            </p>
            <p className="text-xs text-red-400 mt-0.5">
              Verifique sua conexão e tente novamente.
            </p>
          </div>
        )}
        <button
          onClick={reset}
          className="text-sm text-stone-500 hover:text-stone-700 underline"
        >
          Nova gravação
        </button>
      </div>
    );
  }

  return null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ModeButton({
  emoji,
  label,
  sub,
  color,
  onClick,
}: {
  emoji: string;
  label: string;
  sub: string;
  color: "blue" | "indigo" | "violet";
  onClick: () => void;
}) {
  const activeHover =
    color === "blue"
      ? "hover:border-blue-300 hover:bg-blue-50"
      : color === "indigo"
        ? "hover:border-indigo-300 hover:bg-indigo-50"
        : "hover:border-violet-300 hover:bg-violet-50";

  return (
    <button
      onClick={onClick}
      className={`group flex flex-col items-center gap-1.5 border border-stone-200 ${activeHover} rounded-2xl p-3.5 transition-colors bg-white active:scale-95`}
    >
      <span className="text-xl">{emoji}</span>
      <span className="text-xs font-medium text-stone-700">{label}</span>
      <span className="text-[10px] text-stone-400 text-center leading-tight">
        {sub}
      </span>
    </button>
  );
}

function permissionErrorMsg(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("Permission denied") || msg.includes("NotAllowedError")) {
    return "Permissão de áudio negada — verifique as configurações do browser";
  }
  if (msg.includes("NotFoundError")) {
    return "Dispositivo de áudio não encontrado";
  }
  if (msg.includes("NotSupportedError")) {
    return "Browser não suporta captura de tela com áudio";
  }
  return `Erro ao iniciar gravação: ${msg}`;
}
