import { useAuth } from "../_core/hooks/useAuth.ts";
import { trpc } from "../lib/trpc.ts";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as
  | string
  | undefined;

const DEV_ROLES = [
  { role: "admin" as const, label: "Admin", goto: "/admin" },
  { role: "medico" as const, label: "Médico", goto: "/medico" },
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
    <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-stone-950 p-4">
      <div className="w-full max-w-sm">

        {/* Card principal */}
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl shadow-sm p-8">

          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-sm shadow-blue-200" aria-hidden="true">
              <span className="text-white text-xl font-bold tracking-tight">CIS</span>
            </div>
            <h1 className="text-lg font-semibold text-stone-800 dark:text-stone-100">
              Bem-vindo, Dr. Werciley
            </h1>
            <p className="text-sm text-stone-400 dark:text-stone-500 text-center mt-1 leading-relaxed">
              Sistema de Inteligência Clínica
            </p>
          </div>

          {/* Google button */}
          <button
            onClick={handleLogin}
            disabled={!GOOGLE_CLIENT_ID}
            aria-label="Entrar com conta Google"
            className="w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium py-3 px-4 rounded-2xl transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed text-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#fff" opacity=".9"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#fff" opacity=".9"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#fff" opacity=".9"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#fff" opacity=".9"/>
            </svg>
            Entrar com Google
          </button>

          {!GOOGLE_CLIENT_ID && (
            <p className="text-xs text-stone-400 dark:text-stone-500 text-center mt-3">
              Configure <code className="bg-stone-100 dark:bg-stone-800 px-1 rounded">VITE_GOOGLE_CLIENT_ID</code>
            </p>
          )}
        </div>

        {/* Dev mode */}
        {isDev && (
          <div className="mt-4 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl shadow-sm px-5 py-4">
            <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-stone-400 dark:text-stone-500 mb-3">
              Desenvolvimento
            </p>
            <div className="flex gap-2" role="group" aria-label="Logins de desenvolvimento">
              {DEV_ROLES.map(({ role, label, goto }) => (
                <button
                  key={role}
                  onClick={() => enterAs(role, goto)}
                  disabled={devLogin.isPending}
                  aria-label={`Entrar como ${label}`}
                  className="flex-1 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs font-medium py-2 px-3 rounded-xl transition-colors disabled:opacity-50"
                >
                  {devLogin.isPending && devLogin.variables?.role === role
                    ? "…"
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
