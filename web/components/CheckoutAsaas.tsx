"use client";

import { useState, useEffect, useRef } from "react";
import { trpc } from "../lib/trpc";
import { trackConversion } from "../lib/analytics";

interface Props {
  paymentId: string;
  pixQrCode: string;
  pixCopiaECola: string;
}

export default function CheckoutAsaas({
  paymentId,
  pixQrCode,
  pixCopiaECola,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const confirmedRef = useRef(false);

  const { data: statusData } = trpc.intake.consultarStatusPagamento.useQuery(
    { paymentId },
    { refetchInterval: confirmed ? false : 5000 },
  );

  useEffect(() => {
    const status = statusData?.status;
    if (
      (status === "RECEIVED" || status === "CONFIRMED") &&
      !confirmedRef.current
    ) {
      confirmedRef.current = true;
      setConfirmed(true);
      trackConversion(undefined, "BRL");
    }
  }, [statusData?.status]);

  function copiar() {
    navigator.clipboard.writeText(pixCopiaECola).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  }

  if (confirmed) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-emerald-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">
            Pagamento confirmado!
          </h2>
          <p className="text-slate-500 text-sm mb-4">
            Em instantes você receberá o link de acesso ao formulário por{" "}
            <strong>e-mail</strong> e <strong>WhatsApp</strong>.
          </p>
          <p className="text-slate-400 text-xs">
            Verifique também sua caixa de spam.
          </p>
        </div>
      </div>
    );
  }

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

        {pixQrCode && (
          <div className="flex justify-center mb-4">
            <img
              src={`data:image/png;base64,${pixQrCode}`}
              alt="QR Code PIX"
              className="w-48 h-48 border border-slate-200 rounded-xl"
            />
          </div>
        )}

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

        <div className="flex items-center gap-2 justify-center text-slate-400 text-sm">
          <div className="w-4 h-4 border-2 border-slate-200 border-t-slate-400 rounded-full animate-spin" />
          Aguardando confirmação do PIX…
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          Após o pagamento você receberá o link de acesso por e-mail e WhatsApp.
        </p>
      </div>
    </div>
  );
}
