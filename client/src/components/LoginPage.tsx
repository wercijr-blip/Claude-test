import { useAuth } from "../_core/hooks/useAuth.ts";
import { trpc } from "../lib/trpc.ts";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as
  | string
  | undefined;

const DEV_ROLES = [
  { role: "admin" as const, label: "Entrar como Admin", goto: "/admin" },
  { role: "medico" as const, label: "Entrar como Médico", goto: "/medico" },
];

export default function LoginPage() {
  const { setToken } = useAuth();
  const isDev = import.meta.env.DEV;

  const handleLogin = () => {
    if (!GOOGLE_CLIENT_ID) return;
    const state = crypto.randomUUID();
    sessionStorage.setItem("oauth_state", state);
    const redirectUri = `${window.location.origin}/auth/callback`;
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
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
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-10 w-full max-w-sm text-center">
        <h1 className="text-2xl font-bold text-slate-800 mb-1">CIS</h1>
        <p className="text-slate-500 text-sm mb-8">
          Sistema de Inteligência Clínica
        </p>

        <button
          onClick={handleLogin}
          disabled={!GOOGLE_CLIENT_ID}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-xl transition-colors shadow-sm disabled:opacity-50"
        >
          Entrar com Google
        </button>

        {isDev && (
          <div className="mt-8 pt-6 border-t border-slate-100">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-3">
              Modo desenvolvimento
            </p>
            <div className="space-y-2">
              {DEV_ROLES.map(({ role, label, goto }) => (
                <button
                  key={role}
                  onClick={() => enterAs(role, goto)}
                  disabled={devLogin.isPending}
                  className="w-full bg-slate-700 hover:bg-slate-800 text-white text-sm font-medium py-2.5 px-4 rounded-xl transition-colors disabled:opacity-50"
                >
                  {devLogin.isPending && devLogin.variables?.role === role
                    ? "Entrando…"
                    : label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
