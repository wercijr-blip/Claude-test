import { useState, useCallback } from "react";
import { trpc } from "../lib/trpc.ts";
import { useToast } from "./Toast.tsx";

type FeedbackTipo = "concordo" | "discordo" | "inaplicavel";

interface Alerta {
  id: number;
  nivelUrgencia: string;
  mensagemMedico: string | null;
  feedbackMedico?: string | null;
}

interface AlertCardProps {
  alerta: Alerta;
  onVisto: (id: number) => void;
  onFeedback: () => void;
  vistoLoading: boolean;
}

const URGENCIA_CONFIG: Record<string, { label: string; border: string; badge: string }> = {
  alto:  { label: "Alto",  border: "border-l-red-400",   badge: "bg-red-50 text-red-600" },
  medio: { label: "Médio", border: "border-l-amber-400",  badge: "bg-amber-50 text-amber-600" },
  baixo: { label: "Baixo", border: "border-l-yellow-300", badge: "bg-yellow-50 text-yellow-700" },
};

export default function AlertCard({
  alerta,
  onVisto,
  onFeedback,
  vistoLoading,
}: AlertCardProps) {
  const { toast } = useToast();
  const [showFeedback, setShowFeedback] = useState(false);
  const [tipo, setTipo] = useState<FeedbackTipo | null>(null);
  const [motivo, setMotivo] = useState("");

  const registrar = trpc.scriba.registrarFeedbackAlerta.useMutation({
    onSuccess: () => {
      toast("Feedback registrado — o CIS aprenderá com esta decisão.", "success");
      setShowFeedback(false);
      setTipo(null);
      setMotivo("");
      onFeedback();
    },
    onError: (err) => toast(err.message, "error"),
  });

  const submit = useCallback(() => {
    if (!tipo) return;
    registrar.mutate({
      alertaId: alerta.id,
      feedback: tipo,
      motivo: motivo.trim() || undefined,
    });
  }, [tipo, motivo, alerta.id, registrar]);

  const jaTemFeedback = !!alerta.feedbackMedico;
  const cfg = URGENCIA_CONFIG[alerta.nivelUrgencia] ?? URGENCIA_CONFIG.baixo;

  return (
    <li className={`py-3 border-l-2 pl-3 -ml-4 ${cfg.border}`}>
      {/* Linha principal */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize mt-0.5 ${cfg.badge}`}>
            {cfg.label}
          </span>
          {alerta.mensagemMedico && (
            <p className="text-sm text-stone-700 leading-snug">{alerta.mensagemMedico}</p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {jaTemFeedback ? (
            <span className="text-[11px] text-stone-400">
              ✓ {alerta.feedbackMedico}
            </span>
          ) : (
            <button
              onClick={() => setShowFeedback((v) => !v)}
              className="text-[11px] text-stone-400 hover:text-stone-600 underline"
            >
              {showFeedback ? "Cancelar" : "Feedback"}
            </button>
          )}
          <button
            onClick={() => onVisto(alerta.id)}
            disabled={vistoLoading}
            className="text-[11px] text-stone-500 hover:text-stone-700 border border-stone-200 hover:border-stone-300 rounded-lg px-2 py-0.5 transition-colors disabled:opacity-40"
          >
            Marcar visto
          </button>
        </div>
      </div>

      {/* Painel de feedback */}
      {showFeedback && (
        <div className="mt-3 bg-stone-50 border border-stone-200 rounded-xl p-3 space-y-3">
          <p className="text-[11px] text-stone-500 leading-relaxed">
            Seu feedback reduz falsos positivos futuros para este diagnóstico.
          </p>

          <div className="flex gap-1.5">
            {(
              [
                { v: "concordo" as const,     label: "Concordo",     active: "bg-emerald-600 text-white border-emerald-600" },
                { v: "inaplicavel" as const,  label: "Não se aplica", active: "bg-stone-700 text-white border-stone-700" },
                { v: "discordo" as const,     label: "Discordo",     active: "bg-red-600 text-white border-red-600" },
              ]
            ).map(({ v, label, active }) => (
              <button
                key={v}
                onClick={() => setTipo(v)}
                className={[
                  "flex-1 py-1.5 rounded-lg text-[11px] font-medium border transition-colors",
                  tipo === v ? active : "border-stone-200 text-stone-600 hover:border-stone-300 bg-white",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>

          {tipo && (
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder={
                tipo === "discordo"
                  ? "Motivo (ex: paciente imunossuprimido, guideline mais recente…)"
                  : "Observação opcional"
              }
              rows={2}
              className="w-full text-xs text-stone-700 border border-stone-200 rounded-xl p-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          )}

          <button
            onClick={submit}
            disabled={!tipo || (tipo === "discordo" && !motivo.trim()) || registrar.isPending}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-medium rounded-xl transition-colors"
          >
            {registrar.isPending ? "Registrando…" : "Registrar feedback"}
          </button>
        </div>
      )}
    </li>
  );
}
