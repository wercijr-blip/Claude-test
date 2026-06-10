import { useEffect, useState } from "react";

type ConsentLevel = "essential" | "all";

export function CookieBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("cookie_consent")) {
      setShow(true);
    }
  }, []);

  const accept = (level: ConsentLevel) => {
    localStorage.setItem("cookie_consent", level);
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-label="Consentimento de cookies"
      aria-modal="false"
      className="fixed bottom-0 inset-x-0 bg-slate-900 text-white p-4 z-50 shadow-lg"
    >
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex-1">
          <p className="text-sm">
            Usamos cookies <strong>essenciais</strong> para o funcionamento do
            sistema e cookies <strong>analíticos</strong> para melhorar a
            experiência. Consulte nossa{" "}
            <a href="/privacidade" className="underline hover:no-underline">
              Política de Privacidade
            </a>
            .
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => accept("essential")}
            className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-1.5 rounded text-sm font-medium transition-colors"
          >
            Só essenciais
          </button>
          <button
            onClick={() => accept("all")}
            className="bg-white text-slate-900 px-4 py-1.5 rounded text-sm font-medium hover:bg-slate-100 transition-colors"
          >
            Aceitar todos
          </button>
        </div>
      </div>
    </div>
  );
}
