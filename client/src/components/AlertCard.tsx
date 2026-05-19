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

const URGENCIA_STYLE: Record<string, string> = {
  alto: "bg-red-100 text-red-700",
  medio: "bg-amber-100 text-amber-700",
  baixo: "bg-yellow-50 text-yellow-700",
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

  return (
    <li className="text-sm text-amber-700 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <span className="flex items-center gap-1.5 flex-wrap">
          <span
            className={`text-xs font-semibold px-1.5 py-0.5 rounded capitalize ${URGENCIA_STYLE[alerta.nivelUrgencia] ?? URGENCIA_STYLE.baixo}`}
          >
            {alerta.nivelUrgencia}
          </span>
          {alerta.mensagemMedico && (
            <span className="text-amber-700">{alerta.mensagemMedico}</span>
          )}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {!jaTemFeedback && (
            <button
              onClick={() => setShowFeedback((v) => !v)}
              className="text-xs text-amber-500 hover:text-amber-700 underline"
            >
              {showFeedback ? "Cancelar" : "Feedback"}
            </button>
          )}
          {jaTemFeedback && (
            <span className="text-xs text-amber-400 italic">
              ✓ {alerta.feedbackMedico}
            </span>
          )}
          <button
            onClick={() => onVisto(alerta.id)}
            disabled={vistoLoading}
            className="text-xs text-amber-600 hover:text-amber-800 underline disabled:opacity-50"
          >
            Marcar visto
          </button>
        </div>
      </div>

      {showFeedback && (
        <div className="bg-white border border-amber-200 rounded-xl p-3 space-y-3">
          <p className="text-xs font-medium text-slate-600">
            Sua opinião alimenta o CIS-06 para reduzir falsos positivos futuros
            neste diagnóstico.
          </p>

          {/* Tipo de feedback */}
          <div className="flex gap-2">
            {(
              [
                { v: "concordo", label: "Concordo", color: "green" },
                { v: "inaplicavel", label: "Não aplicável", color: "slate" },
                { v: "discordo", label: "Discordo", color: "red" },
              ] as const
            ).map(({ v, label, color }) => (
              <button
                key={v}
                onClick={() => setTipo(v)}
                className={[
                  "flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                  tipo === v
                    ? color === "green"
                      ? "bg-green-600 text-white border-green-600"
                      : color === "red"
                        ? "bg-red-600 text-white border-red-600"
                        : "bg-slate-700 text-white border-slate-700"
                    : "border-slate-200 text-slate-600 hover:border-slate-400",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Motivo — obrigatório apenas para discordo */}
          {tipo && (
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder={
                tipo === "discordo"
                  ? "Explique o motivo (ex: paciente imunossuprimido, guideline mais recente…)"
                  : "Observação opcional"
              }
              rows={2}
              className="w-full text-xs text-slate-700 border border-slate-200 rounded-lg p-2 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          )}

          <button
            onClick={submit}
            disabled={
              !tipo ||
              (tipo === "discordo" && !motivo.trim()) ||
              registrar.isPending
            }
            className="w-full py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors"
          >
            {registrar.isPending ? "Registrando…" : "Registrar feedback"}
          </button>
        </div>
      )}
    </li>
  );
}
