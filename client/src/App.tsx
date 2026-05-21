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
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <div
        role="status"
        aria-label="Carregando"
        className="w-8 h-8 border-3 border-stone-200 border-t-blue-600 rounded-full animate-spin"
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
        <div className="min-h-screen flex items-center justify-center bg-stone-50">
          <div className="text-center px-6">
            <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">⚠️</span>
            </div>
            <h1 className="text-lg font-semibold text-stone-800 mb-1">
              Algo deu errado
            </h1>
            <p className="text-sm text-stone-500 mb-6">
              Um erro inesperado ocorreu na interface.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
                onClick={() => this.setState({ hasError: false })}
              >
                Tentar novamente
              </button>
              <button
                className="bg-stone-100 text-stone-600 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-stone-200 transition-colors"
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

// ─── Skeleton loader para lista de notas ─────────────────────────────────────

function NotesSkeleton() {
  return (
    <div className="animate-pulse space-y-0 divide-y divide-stone-100">
      {[1, 2, 3].map((i) => (
        <div key={i} className="py-3.5 flex items-start gap-3">
          <div className="w-12 h-5 bg-stone-100 rounded-md mt-0.5" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-stone-100 rounded w-3/5" />
            <div className="h-3 bg-stone-100 rounded w-2/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Dashboard principal ──────────────────────────────────────────────────────

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
        data.nova ? "Sessão aberta com sucesso." : "Sessão do dia retomada.",
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

  const TIPO_LABELS = [
    { val: "primeira_consulta" as const, label: "1ª Consulta" },
    { val: "retorno" as const, label: "Retorno" },
    { val: "seguimento" as const, label: "Seguimento" },
  ];

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-sm border-b border-stone-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center shrink-0">
              <span className="text-white text-[11px] font-bold tracking-tight">CIS</span>
            </div>
            <span className="text-sm font-semibold text-stone-800 hidden sm:block">
              Inteligência Clínica
            </span>
          </div>
          <div className="flex items-center gap-4">
            {sessaoId && (
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-xs text-stone-500 hidden sm:block">
                  Sessão #{sessaoId}
                </span>
              </div>
            )}
            {alertaItems.length > 0 && (
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                <span className="text-xs font-medium text-amber-600">
                  {alertaItems.length}
                </span>
              </div>
            )}
            <button
              onClick={logout}
              className="text-xs text-stone-400 hover:text-stone-600 transition-colors px-2 py-1 rounded-lg hover:bg-stone-100"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-4">

        {/* ── Alertas ─────────────────────────────────────────────────────── */}
        {!alertasLoading && alertasError && (
          <div className="bg-white border border-stone-200 rounded-2xl shadow-sm p-4 flex items-center justify-between">
            <p className="text-sm text-stone-500">Não foi possível carregar alertas.</p>
            <button
              onClick={() => utils.scriba.listarAlertas.invalidate()}
              className="text-xs text-blue-600 hover:underline"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {!alertasLoading && !alertasError && alertaItems.length > 0 && (
          <section>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-400 mb-2 px-1">
              {alertaItems.length} alerta{alertaItems.length > 1 ? "s" : ""} pendente{alertaItems.length > 1 ? "s" : ""}
            </p>
            <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
              <ul className="divide-y divide-stone-100 px-4 py-1">
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
          </section>
        )}

        {/* ── Sessão clínica ───────────────────────────────────────────────── */}
        <section>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-400 mb-2 px-1">
            Sessão clínica
          </p>
          <div className="bg-white border border-stone-200 rounded-2xl shadow-sm p-5">

            {!sessaoId ? (
              <div className="flex flex-col items-center py-6 gap-4">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-stone-700">Pronto para atender?</p>
                  <p className="text-xs text-stone-400 mt-0.5">Abra uma sessão para iniciar as consultas do dia.</p>
                </div>
                <button
                  onClick={() => abrirSessao.mutate(void 0)}
                  disabled={abrirSessao.isPending}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-6 rounded-xl transition-colors disabled:opacity-50 text-sm shadow-sm"
                >
                  {abrirSessao.isPending ? "Abrindo…" : "Iniciar Atendimento"}
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Status da sessão */}
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                  <span className="text-xs text-stone-500">
                    Sessão {abrirSessao.data?.nova ? "iniciada" : "retomada"} — ID {sessaoId}
                  </span>
                </div>

                <div className="border-t border-stone-100 pt-4 space-y-4">
                  {/* Tipo de consulta */}
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-400 mb-2">
                      Tipo de consulta
                    </p>
                    <div className="flex gap-2">
                      {TIPO_LABELS.map(({ val, label }) => (
                        <button
                          key={val}
                          onClick={() => setTipoConsulta(val)}
                          className={`flex-1 px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
                            tipoConsulta === val
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-white text-stone-600 border-stone-200 hover:border-blue-300 hover:text-blue-700"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Nome do paciente */}
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-400 mb-2">
                      Paciente
                    </p>
                    <input
                      type="text"
                      value={pacienteNome}
                      onChange={(e) => setPacienteNome(e.target.value)}
                      placeholder="Nome completo"
                      className="w-full text-sm border border-stone-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-stone-700 placeholder-stone-300 bg-stone-50"
                    />
                  </div>

                  {/* Gravar */}
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-400 mb-2">
                      Gravar consulta
                    </p>
                    <AudioRecorder
                      sessionId={sessaoId}
                      onTranscricao={handleTranscricao}
                    />
                  </div>
                </div>

                {/* Processar */}
                {transcricao && (
                  <div className="border-t border-stone-100 pt-4">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 mb-3 flex items-center gap-2">
                      <span className="text-emerald-600 text-sm">✓</span>
                      <p className="text-xs text-emerald-700 font-medium">
                        Transcrição concluída — pronto para processar
                      </p>
                    </div>
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
                      className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors text-sm shadow-sm"
                    >
                      {processarConsulta.isPending
                        ? "Gerando SOAP…"
                        : "Processar Consulta"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ── Notas recentes ───────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-400">
              Notas recentes
            </p>
            {notas?.items && notas.items.length > 0 && (
              <span className="text-[11px] text-stone-300">{notas.items.length} nota{notas.items.length !== 1 ? "s" : ""}</span>
            )}
          </div>
          <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
            {notasLoading ? (
              <div className="px-4 py-1">
                <NotesSkeleton />
              </div>
            ) : notasError ? (
              <div className="px-4 py-5 flex items-center gap-3">
                <p className="text-sm text-stone-400 flex-1">Erro ao carregar notas.</p>
                <button
                  onClick={() => utils.scriba.listarSoapNotes.invalidate()}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Tentar novamente
                </button>
              </div>
            ) : !notas?.items || notas.items.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-stone-400">Nenhuma nota registrada ainda.</p>
                <p className="text-xs text-stone-300 mt-1">As notas aparecem aqui após processar uma consulta.</p>
              </div>
            ) : (
              <ul className="divide-y divide-stone-100">
                {notas.items.map((n) => {
                  const diasDesde = Math.floor(
                    (Date.now() - new Date(n.createdAt).getTime()) / 86_400_000,
                  );
                  const sinteseVelha = n.temSintese && diasDesde > 365;
                  const dataStr = diasDesde === 0
                    ? "hoje"
                    : diasDesde === 1
                      ? "ontem"
                      : `há ${diasDesde}d`;

                  return (
                    <li key={n.id} className="px-4 py-3.5 flex items-start gap-3 hover:bg-stone-50 transition-colors">
                      <span className="mt-0.5 text-[11px] font-mono bg-stone-100 text-stone-500 px-2 py-0.5 rounded shrink-0">
                        {n.cid10 ?? "—"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-sm font-medium text-stone-800 truncate">
                            {n.diagnosticoPrincipal ?? "Diagnóstico não definido"}
                          </p>
                          <span className="text-[11px] text-stone-300 shrink-0">{dataStr}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="text-[11px] text-stone-400">{n.template}</span>
                          {n.tipoConsulta && (
                            <span
                              className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
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
                          )}
                          {n.temSintese ? (
                            <span className="text-[11px] text-emerald-600 font-medium">· síntese ✓</span>
                          ) : pendingSynthesisNoteId === n.id ? (
                            <span className="text-[11px] text-amber-600 flex items-center gap-1">
                              · <span className="animate-pulse">●</span> PubMed
                            </span>
                          ) : (
                            <span className="text-[11px] text-stone-300">· sem síntese</span>
                          )}
                        </div>
                        {sinteseVelha && (
                          <div className="mt-1.5 flex items-center gap-2">
                            <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                              Evidências &gt;1 ano
                            </span>
                            <button
                              onClick={() => refreshEvidencia.mutate({ soapNoteId: n.id })}
                              disabled={refreshingId === n.id}
                              className="text-[11px] text-blue-600 hover:text-blue-800 underline disabled:opacity-50"
                            >
                              {refreshingId === n.id ? "Reagendando…" : "Atualizar"}
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
        </section>

        {/* ── Produções científicas ────────────────────────────────────────── */}
        <PublicacoesPanel />

      </main>
    </div>
  );
}

// ─── Roteamento principal ─────────────────────────────────────────────────────

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

// ─── Auth callback ────────────────────────────────────────────────────────────

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
      <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
        <div className="bg-white border border-stone-200 rounded-3xl shadow-sm p-8 w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-base font-semibold text-stone-800">
              Verificação em duas etapas
            </h1>
            <p className="text-sm text-stone-500 mt-1">
              Digite o código do seu autenticador.
            </p>
          </div>
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
              className="w-full text-center text-2xl tracking-widest border border-stone-200 rounded-2xl px-4 py-3 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-stone-50"
            />
            {totpError && (
              <p className="text-sm text-red-600 text-center mb-3">{totpError}</p>
            )}
            <button
              type="submit"
              disabled={verifyTotp.isPending || totpCode.replace(/\s/g, "").length !== 6}
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
      <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
        <div className="bg-white border border-stone-200 rounded-3xl shadow-sm p-8 w-full max-w-sm text-center">
          <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-base font-semibold text-stone-800 mb-2">
            Falha na autenticação
          </h1>
          <p className="text-sm text-stone-500 mb-6">
            {timedOut && !callbackMutation.isError
              ? "A verificação demorou mais de 15 segundos. Verifique sua conexão e tente novamente."
              : (callbackMutation.error?.message ??
                "Não foi possível completar o login.")}
          </p>
          <a
            href="/login"
            className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-blue-700 transition-colors inline-block text-sm"
          >
            Tentar novamente
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <div className="flex flex-col items-center gap-3">
        <div
          role="status"
          aria-label="Autenticando"
          className="w-6 h-6 border-2 border-stone-200 border-t-blue-600 rounded-full animate-spin"
        />
        <p className="text-sm text-stone-400">Autenticando…</p>
      </div>
    </div>
  );
}

// ─── 404 ──────────────────────────────────────────────────────────────────────

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <div className="text-center">
        <p className="text-6xl font-bold text-stone-200">404</p>
        <p className="text-stone-500 mt-3 mb-6">Página não encontrada</p>
        <a
          href="/"
          className="text-sm text-blue-600 hover:underline"
        >
          Voltar ao início
        </a>
      </div>
    </div>
  );
}
