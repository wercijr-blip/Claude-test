import { useState, useEffect, useRef } from "react";
import { trpc } from "../lib/trpc.ts";
import { useAuth } from "../_core/hooks/useAuth.ts";
import { useLocation } from "wouter";
import { trackPurchase } from "../lib/analytics.ts";

interface Props {
  precadastroId: number;
  paymentId: string;
  pixQrCode: string; // base64 PNG
  pixCopiaECola: string;
}

export default function CheckoutAsaas({
  precadastroId: _precadastroId,
  paymentId,
  pixQrCode,
  pixCopiaECola,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [, navigate] = useLocation();
  const { setToken } = useAuth();
  const confirmed = useRef(false);

  const acessoPosPageamento = trpc.intake.acessoPosPagamento.useMutation({
    onSuccess: (data: { sessionToken: string }) => {
      trackPurchase(paymentId, 250);
      setToken(data.sessionToken);
      navigate("/inicio");
    },
  });

  // Poll payment status every 5 s until RECEIVED or CONFIRMED
  const { data: statusData } = trpc.intake.consultarStatusPagamento.useQuery(
    { paymentId },
    { refetchInterval: 5000, enabled: !confirmed.current },
  );

  useEffect(() => {
    const status = statusData?.status;
    if (
      (status === "RECEIVED" || status === "CONFIRMED") &&
      !confirmed.current
    ) {
      confirmed.current = true;
      acessoPosPageamento.mutate({ paymentId });
    }
  }, [statusData?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  function copiar() {
    navigator.clipboard.writeText(pixCopiaECola).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  }

  const isProcessing = acessoPosPageamento.isPending;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg
              className="w-6 h-6 text-emerald-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800">Pague com PIX</h2>
          <p className="text-slate-500 text-sm mt-1">
            Escaneie o QR Code ou copie o código
          </p>
        </div>

        {/* QR Code */}
        {pixQrCode && (
          <div className="flex justify-center mb-4">
            <img
              src={`data:image/png;base64,${pixQrCode}`}
              alt="QR Code PIX"
              className="w-48 h-48 border border-slate-200 rounded-xl"
            />
          </div>
        )}

        {/* Copia e cola */}
        <div className="bg-slate-50 rounded-xl p-3 mb-4">
          <p className="text-xs text-slate-500 mb-1 font-medium">
            PIX Copia e Cola
          </p>
          <p className="text-xs text-slate-700 break-all font-mono leading-relaxed">
            {pixCopiaECola.length > 80
              ? `${pixCopiaECola.slice(0, 80)}…`
              : pixCopiaECola}
          </p>
        </div>

        <button
          onClick={copiar}
          className="w-full py-3 rounded-xl font-medium text-sm transition-colors mb-4 bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {copied ? "✓ Copiado!" : "Copiar código PIX"}
        </button>

        {isProcessing ? (
          <div className="text-center">
            <div className="w-5 h-5 border-2 border-slate-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-2" />
            <p className="text-slate-500 text-sm">Confirmando pagamento…</p>
          </div>
        ) : (
          <div className="flex items-center gap-2 justify-center text-slate-400 text-sm">
            <div className="w-4 h-4 border-2 border-slate-200 border-t-slate-400 rounded-full animate-spin" />
            Aguardando confirmação do PIX…
          </div>
        )}

        {acessoPosPageamento.isError && (
          <p className="mt-3 text-center text-xs text-amber-600">
            Pagamento confirmado pelo banco — aguarde ou verifique seu e-mail.
          </p>
        )}

        <p className="mt-4 text-center text-xs text-slate-400">
          Após o pagamento você receberá o link de acesso por e-mail e WhatsApp.
        </p>
      </div>
    </div>
  );
}
