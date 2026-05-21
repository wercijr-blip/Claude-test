import {
  Suspense,
  Component,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { Route, Switch, useLocation } from "wouter";
import { useAuth, parseJwtPayload } from "./_core/hooks/useAuth.ts";
import LoginPage from "./components/LoginPage.tsx";
import { ToastProvider, useToast } from "./components/Toast.tsx";
import AudioRecorder from "./components/AudioRecorder.tsx";
import AlertCard from "./components/AlertCard.tsx";
import PublicacoesPanel from "./components/PublicacoesPanel.tsx";
import { trpc } from "./lib/trpc.ts";

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div
        role="status"
        aria-label="Carregando"
        className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"
      />
    </div>
  );
}

class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-slate-700 mb-2">
              Algo deu errado
            </h1>
            <div className="flex gap-3 justify-center">
              <button
                className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-blue-700 transition-colors"
                onClick={() => this.setState({ hasError: false })}
              >
                Tentar novamente
              </button>
              <button
                className="bg-slate-100 text-slate-700 px-6 py-2.5 rounded-xl font-medium hover:bg-slate-200 transition-colors"
                onClick={() => window.location.reload()}
              >
                Recarregar
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function CISDashboard() {
  const { logout } = useAuth();
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [transcricao, setTranscricao] = useState<string | null>(null);
  const [sessaoId, setSessaoId] = useState<number | null>(null);
  const [refreshingId, setRefreshingId] = useState<number | null>(null);
  const [pendingSynthesisNoteId, setPendingSynthesisNoteIdState] = useState<number | null>(() => {
    const v = sessionStorage.getItem("cis:pendingSynthesis");
    return v ? parseInt(v, 10) : null;
  });
  const setPendingSynthesisNoteId = useCallback((id: number | null) => {
    if (id === null) sessionStorage.removeItem("cis:pendingSynthesis");
    else sessionStorage.setItem("cis:pendingSynthesis", String(id));
    setPendingSynthesisNoteIdState(id);
  }, []);
  const [tipoConsulta, setTipoConsulta] = useState<
    "primeira_consulta" | "retorno" | "seguimento"
  >("primeira_consulta");
  const [pacienteNome, setPacienteNome] = useState("");

  const abrirSessao = trpc.scriba.abrirSessao.useMutation({
    onSuccess: (data) => {
      utils.scriba.listarSoapNotes.invalidate();
      setSessaoId(data.sessionId);
      toast(
        data.nova ? "Sessão aberta com sucesso." : "Sessão retomada.",
        "success",
      );
    },
    onError: (err) => toast(err.message, "error"),
  });

  const handleTranscricao = useCallback(
    (texto: string) => {
      setTranscricao(texto);
      toast("Transcrição concluída.", "success");
    },
    [toast],
  );
  const {
    data: notas,
    isLoading: notasLoading,
    isError: notasError,
  } = trpc.scriba.listarSoapNotes.useQuery(
    { limit: 10 },
    {
      retry: false,
      refetchInterval: pendingSynthesisNoteId ? 15_000 : false,
      refetchIntervalInBackground: false,
    },
  );

  useEffect(() => {
    if (!pendingSynthesisNoteId || !notas?.items) return;
    const nota = notas.items.find((n) => n.id === pendingSynthesisNoteId);
    if (nota?.temSintese) setPendingSynthesisNoteId(null);
  }, [pendingSynthesisNoteId, notas?.items]);
  const {
    data: alertas,
    isLoading: alertasLoading,
    isError: alertasError,
  } = trpc.scriba.listarAlertas.useQuery(
    { incluirVistos: false, limit: 5 },
    { retry: false },
  );
  const marcarVisto = trpc.scriba.marcarAlertaVisto.useMutation({
    onSuccess: () => {
      utils.scriba.listarAlertas.invalidate();
      toast("Alerta marcado como visto.", "success");
    },
    onError: (err) => toast(err.message, "error"),
  });

  const refreshEvidencia = trpc.scriba.refreshEvidencia.useMutation({
    onMutate: ({ soapNoteId }) => setRefreshingId(soapNoteId),
    onSettled: () => setRefreshingId(null),
    onSuccess: () => toast("Síntese de evidências reagendada.", "success"),
    onError: (err) => toast(err.message, "error"),
  });

  const processarConsulta = trpc.scriba.processarConsulta.useMutation({
    onSuccess: (data) => {
      utils.scriba.listarSoapNotes.invalidate();
      utils.scriba.listarAlertas.invalidate();
      toast(`SOAP gerada — nota #${data.soapNoteId}`, "success");
      setTranscricao(null);
      setPacienteNome("");
      setPendingSynthesisNoteId(data.soapNoteId);
    },
    onError: (err) => toast(err.message, "error"),
  });

  const alertaItems = alertas?.items ?? [];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-800">
          CIS — Sistema de Inteligência Clínica
        </h1>
        <button
          onClick={logout}
          className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          Sair
        </button>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {alertasLoading && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-1/3 mb-2" />
            <div className="h-3 bg-slate-200 rounded w-2/3" />
          </div>
        )}

        {!alertasLoading && alertasError && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center justify-between">
            <p className="text-sm text-red-600">
              Não foi possível carregar alertas.
            </p>
            <button
              onClick={() => utils.scriba.listarAlertas.invalidate()}
              className="text-xs text-red-600 underline hover:text-red-800"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {!alertasLoading && !alertasError && alertaItems.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-sm font-semibold text-amber-800 mb-2">
              ⚠️ {alertaItems.length} alerta{alertaItems.length > 1 ? "s" : ""}{" "}
              de conduta pendente{alertaItems.length > 1 ? "s" : ""}
            </p>
            <ul className="space-y-2">
              {alertaItems.map((a) => (
                <AlertCard
                  key={a.id}
                  alerta={a}
                  onVisto={(id) => marcarVisto.mutate({ alertaId: id })}
                  onFeedback={() => utils.scriba.listarAlertas.invalidate()}
                  vistoLoading={marcarVisto.isPending}
                />
              ))}
            </ul>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
          <h2 className="text-sm font-semibold text-slate-700">
            Sessão Clínica
          </h2>

          {!sessaoId ? (
            <button
              onClick={() => abrirSessao.mutate(void 0)}
              disabled={abrirSessao.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-5 rounded-xl transition-colors disabled:opacity-50 text-sm"
            >
              {abrirSessao.isPending ? "Abrindo…" : "Iniciar Atendimento"}
            </button>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span className="w-2 h-2 bg-green-500 rounded-full" />
                Sessão {abrirSessao.data?.nova ? "aberta" : "retomada"} — ID{" "}
                {sessaoId}
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-4">
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-2">
                    Tipo de consulta
                  </p>
                  <div className="flex gap-2">
                    {(
                      [
                        ["primeira_consulta", "Primeira Consulta"],
                        ["retorno", "Retorno"],
                        ["seguimento", "Seguimento"],
                      ] as const
                    ).map(([val, label]) => (
                      <button
                        key={val}
                        onClick={() => setTipoConsulta(val)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                          tipoConsulta === val
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white text-slate-600 border-slate-200 hover:border-blue-400 hover:text-blue-700"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-slate-600 mb-2">
                    Nome do paciente
                  </p>
                  <input
                    type="text"
                    value={pacienteNome}
                    onChange={(e) => setPacienteNome(e.target.value)}
                    placeholder="Nome completo"
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 placeholder-slate-300"
                  />
                </div>

                <div>
                  <p className="text-xs font-medium text-slate-600 mb-3">
                    Gravar consulta
                  </p>
                  <AudioRecorder
                    sessionId={sessaoId}
                    onTranscricao={handleTranscricao}
                  />
                </div>
              </div>

              {transcricao && (
                <div className="border-t border-slate-100 pt-4 space-y-3">
                  <p className="text-xs font-medium text-slate-600">
                    Transcrição concluída — pronto para processar
                  </p>
                  <button
                    onClick={() => {
                      if (!pacienteNome.trim()) {
                        toast("Informe o nome do paciente.", "error");
                        return;
                      }
                      processarConsulta.mutate({
                        sessionId: sessaoId,
                        pacienteNome: pacienteNome.trim(),
                        transcricao,
                        tipoConsulta,
                      });
                    }}
                    disabled={processarConsulta.isPending}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl transition-colors text-sm"
                  >
                    {processarConsulta.isPending
                      ? "Processando consulta…"
                      : "Processar Consulta"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">
            Notas Recentes
          </h2>
          {notasLoading ? (
            <div className="flex justify-center py-4">
              <div
                role="status"
                aria-label="Carregando notas"
                className="w-5 h-5 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin"
              />
            </div>
          ) : notasError ? (
            <div className="flex items-center gap-3">
              <p className="text-sm text-red-500">Erro ao carregar notas.</p>
              <button
                onClick={() => utils.scriba.listarSoapNotes.invalidate()}
                className="text-xs text-red-500 underline hover:text-red-700"
              >
                Tentar novamente
              </button>
            </div>
          ) : !notas?.items || notas.items.length === 0 ? (
            <p className="text-sm text-slate-400">
              Nenhuma nota registrada ainda.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {notas.items.map((n) => {
                const diasDesde = Math.floor(
                  (Date.now() - new Date(n.createdAt).getTime()) / 86_400_000,
                );
                const sinteseVelha = n.temSintese && diasDesde > 365;
                return (
                  <li key={n.id} className="py-3 flex items-start gap-3">
                    <span className="mt-0.5 text-xs font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
                      {n.cid10 ?? "—"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800">
                        {n.diagnosticoPrincipal ?? "Diagnóstico não definido"}
                      </p>
                      <p className="text-xs text-slate-400">
                        {n.template}
                        {n.tipoConsulta && (
                          <span
                            className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              n.tipoConsulta === "primeira_consulta"
                                ? "bg-blue-50 text-blue-600"
                                : n.tipoConsulta === "retorno"
                                  ? "bg-amber-50 text-amber-600"
                                  : "bg-emerald-50 text-emerald-600"
                            }`}
                          >
                            {n.tipoConsulta === "primeira_consulta"
                              ? "1ª consulta"
                              : n.tipoConsulta === "retorno"
                                ? "retorno"
                                : "seguimento"}
                          </span>
                        )}{" "}
                        · {new Date(n.createdAt).toLocaleString("pt-BR")}
                        {n.temSintese ? (
                          <span className="ml-1 text-emerald-600">
                            · síntese ✓
                          </span>
                        ) : pendingSynthesisNoteId === n.id ? (
                          <span className="ml-1 text-amber-600">
                            · <span className="animate-pulse">●</span> PubMed em processamento…
                          </span>
                        ) : (
                          <span className="ml-1 text-slate-300">
                            · sem síntese
                          </span>
                        )}
                      </p>
                      {sinteseVelha && (
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                            Evidências &gt;1 ano
                          </span>
                          <button
                            onClick={() =>
                              refreshEvidencia.mutate({ soapNoteId: n.id })
                            }
                            disabled={refreshingId === n.id}
                            className="text-xs text-blue-600 hover:text-blue-800 underline disabled:opacity-50"
                          >
                            {refreshingId === n.id
                              ? "Reagendando…"
                              : "Atualizar"}
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <PublicacoesPanel />
      </main>
    </div>
  );
}

export default function App() {
  const { token } = useAuth();
  const session = token ? parseJwtPayload(token) : null;
  const role = session?.type === "staff" ? session.role : null;

  return (
    <ErrorBoundary>
      <ToastProvider>
        <Suspense fallback={<PageLoader />}>
          <Switch>
            <Route path="/auth/callback" component={AuthCallback} />
            <Route path="/medico">
              {role === "medico" || role === "admin" ? (
                <CISDashboard />
              ) : (
                <LoginPage />
              )}
            </Route>
            <Route path="/admin">
              {role === "admin" ? <CISDashboard /> : <LoginPage />}
            </Route>
            <Route path="/login" component={LoginPage} />
            <Route path="/" component={LoginPage} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </ToastProvider>
    </ErrorBoundary>
  );
}

function AuthCallback() {
  const { setToken } = useAuth();
  const [, navigate] = useLocation();
  const [timedOut, setTimedOut] = useState(false);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [totpError, setTotpError] = useState<string | null>(null);

  const [code] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    const c = p.get("code") ?? "";
    if (c) window.history.replaceState({}, "", "/auth/callback");
    return c;
  });

  const hasAttempted = useRef(false);

  const verifyTotp = trpc.auth.verifyTotp.useMutation({
    onSuccess: (data) => {
      setToken(data.token);
      navigate(data.role === "admin" ? "/admin" : "/medico");
    },
    onError: (err) => {
      setTotpError(err.message ?? "Código inválido. Tente novamente.");
      setTotpCode("");
    },
  });

  const callbackMutation = trpc.auth.callback.useMutation({
    onSuccess: (data) => {
      if (data.requiresTwoFactor) {
        setPendingToken(data.token);
        return;
      }
      setToken(data.token);
      const session = parseJwtPayload(data.token);
      const role = session?.type === "staff" ? session.role : null;
      navigate(role === "admin" ? "/admin" : "/medico");
    },
    onError: (err) => {
      console.error("[auth.callback]", err.message);
    },
  });

  useEffect(() => {
    if (!code) return;
    const storageKey = `oauth_code_used:${code}`;
    if (hasAttempted.current || sessionStorage.getItem(storageKey)) return;
    hasAttempted.current = true;
    sessionStorage.setItem(storageKey, "1");
    callbackMutation.mutate({
      code,
      redirectUri: `${window.location.origin}/auth/callback`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!callbackMutation.isSuccess) setTimedOut(true);
    }, 15_000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (pendingToken) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-full max-w-sm mx-auto px-6">
          <h1 className="text-xl font-semibold text-slate-800 text-center mb-2">
            Verificação em duas etapas
          </h1>
          <p className="text-sm text-slate-500 text-center mb-6">
            Digite o código de 6 dígitos do seu autenticador.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (totpCode.replace(/\s/g, "").length === 6) {
                setTotpError(null);
                verifyTotp.mutate({ pendingToken, code: totpCode });
              }
            }}
          >
            <input
              autoFocus
              type="text"
              inputMode="numeric"
              maxLength={7}
              placeholder="000 000"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              className="w-full text-center text-2xl tracking-widest border border-slate-300 rounded-xl px-4 py-3 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {totpError && (
              <p className="text-sm text-red-600 text-center mb-3">
                {totpError}
              </p>
            )}
            <button
              type="submit"
              disabled={
                verifyTotp.isPending ||
                totpCode.replace(/\s/g, "").length !== 6
              }
              className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {verifyTotp.isPending ? "Verificando…" : "Confirmar"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (callbackMutation.isError || timedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-700 mb-2">
            Falha na autenticação
          </h1>
          <p className="text-slate-500 mb-4">
            {timedOut && !callbackMutation.isError
              ? "A verificação demorou mais de 15 segundos. Verifique sua conexão e tente novamente."
              : (callbackMutation.error?.message ??
                "Não foi possível completar o login.")}
          </p>
          <a
            href="/login"
            className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-blue-700 transition-colors inline-block"
          >
            Tentar novamente
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-slate-500">Autenticando…</p>
    </div>
  );
}

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-slate-300">404</h1>
        <p className="text-slate-500 mt-2">Página não encontrada</p>
        <a href="/" className="mt-4 inline-block text-blue-600 underline">
          Voltar
        </a>
      </div>
    </div>
  );
}
