import { useAuth } from "../_core/hooks/useAuth.ts";
import { trpc } from "../lib/trpc.ts";
import { LogoWordmark } from "./Logo.tsx";

const DEV_ROLES = [
  {
    role: "admin" as const,
    label: "Entrar como Admin",
    color: "bg-fp-accent hover:bg-fp-dark-soft",
    goto: "/admin",
  },
  {
    role: "medico" as const,
    label: "Entrar como Médico",
    color: "bg-fp-blue hover:bg-fp-info",
    goto: "/medico",
  },
  {
    role: "secretaria" as const,
    label: "Entrar como Secretaria",
    color: "bg-sage hover:bg-sage-dark",
    goto: "/secretaria",
  },
];

export default function LoginPage() {
  const { setToken } = useAuth();
  const isDev = import.meta.env.DEV;

  const { data: publicConfig, isLoading: isConfigLoading } =
    trpc.config.getPublicConfig.useQuery();

  const handleLogin = () => {
    if (!publicConfig?.googleClientId) return;
    const state = crypto.randomUUID();
    sessionStorage.setItem("oauth_state", state);
    const redirectUri = `${window.location.origin}/auth/callback`;
    const params = new URLSearchParams({
      client_id: publicConfig.googleClientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      access_type: "offline",
      prompt: "consent",
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  };

  const devLogin = trpc.auth.devLogin.useMutation();

  const enterAs = async (
    role: (typeof DEV_ROLES)[number]["role"],
    goto: string,
  ) => {
    try {
      const result = await devLogin.mutateAsync({ role });
      setToken(result.token);
      window.location.href = goto;
    } catch (err) {
      console.error(err);
      alert("Erro no login dev — verifique se o backend está rodando.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-warm-bg p-4">
      <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-10 w-full max-w-sm text-center">
        <div className="flex justify-center mb-6">
          <LogoWordmark size={56} mode="light" layout="stacked" />
        </div>
        <p className="text-slate-500 text-sm mb-8">Acesso da equipe clínica</p>

        <button
          onClick={handleLogin}
          disabled={isConfigLoading || !publicConfig?.googleClientId}
          className="w-full bg-fp-accent hover:bg-fp-dark-soft text-white font-medium py-3 px-4 rounded-full transition-colors shadow-sm disabled:opacity-50"
        >
          {isConfigLoading ? "Carregando…" : "Entrar com conta institucional"}
        </button>

        {isDev && (
          <div className="mt-8 pt-6 border-t border-slate-100">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-3">
              Modo desenvolvimento
            </p>
            <div className="space-y-2">
              {DEV_ROLES.map(({ role, label, color, goto }) => (
                <button
                  key={role}
                  onClick={() => enterAs(role, goto)}
                  disabled={devLogin.isPending}
                  className={`w-full ${color} text-white text-sm font-medium py-2.5 px-4 rounded-full transition-colors disabled:opacity-50`}
                >
                  {devLogin.isPending && devLogin.variables?.role === role
                    ? "Entrando…"
                    : label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-3 italic leading-relaxed">
              Atalhos disponíveis apenas em ambiente local —<br />
              não aparecem em produção.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
