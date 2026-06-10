import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "../lib/trpc.ts";
import { useAuth } from "../_core/hooks/useAuth.ts";

export default function TokenEntryPage() {
  const params = new URLSearchParams(window.location.search);
  const tokenFromUrl =
    useLocation()[0].split("/acesso/")[1] ?? params.get("token") ?? "";

  const [token, setToken] = useState(tokenFromUrl);
  const [error, setError] = useState("");
  const [linkExpired, setLinkExpired] = useState(false);
  const { setToken: saveSession } = useAuth();
  const [, navigate] = useLocation();

  const validar = trpc.token.validarEDecidirFase.useMutation({
    onSuccess: (data) => {
      saveSession(data.sessionToken);
      navigate(data.proximaFase);
    },
    onError: (err) => {
      if (err.message === "LINK_EXPIRED") {
        setLinkExpired(true);
      } else {
        setError(err.message);
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLinkExpired(false);
    validar.mutate({ token: token.trim() });
  };

  if (linkExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 w-full max-w-md text-center">
          <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-amber-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">
            Link Expirado
          </h2>
          <p className="text-slate-600 text-sm mb-2">
            Este link tem validade de <strong>7 dias</strong> devido à validade
            dos exames.
          </p>
          <p className="text-slate-600 text-sm mb-6">
            Para reiniciar seu atendimento, será necessário realizar um novo
            pagamento.
          </p>
          <a
            href="/cadastro"
            className="inline-block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors text-center"
          >
            Iniciar novo atendimento
          </a>
          <p className="text-slate-400 text-xs mt-4">
            Dúvidas?{" "}
            <a
              href="mailto:contato@facilitaprep.com.br"
              className="text-blue-600 hover:underline"
            >
              contato@facilitaprep.com.br
            </a>{" "}
            ou WhatsApp (61) 99401-8161
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-blue-700 mb-1">Facilita PrEP</h1>
        <p className="text-slate-500 text-sm mb-6">
          Informe o código de acesso enviado para o seu e-mail.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Código de acesso
            </label>
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Cole aqui o código recebido por e-mail"
              required
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={validar.isPending}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
          >
            {validar.isPending ? "Verificando…" : "Acessar formulário"}
          </button>
        </form>
      </div>
    </div>
  );
}
