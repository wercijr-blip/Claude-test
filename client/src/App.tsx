import { Suspense, Component, useEffect, useRef, useState, type ReactNode } from 'react'
import { Route, Switch, useLocation } from 'wouter'
import { useAuth, parseJwtPayload } from './_core/hooks/useAuth.ts'
import LoginPage from './components/LoginPage.tsx'
import { trpc } from './lib/trpc.ts'

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  )
}

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-slate-700 mb-2">Algo deu errado</h1>
            <button
              className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-blue-700 transition-colors"
              onClick={() => window.location.reload()}
            >
              Recarregar
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function CISDashboard() {
  const { logout } = useAuth()
  const abrirSessao = trpc.scriba.abrirSessao.useMutation()
  const { data: notas, refetch: refetchNotas } = trpc.scriba.listarSoapNotes.useQuery(
    { limit: 10 },
    { retry: false },
  )
  const { data: alertas } = trpc.scriba.listarAlertas.useQuery(
    { incluirVistos: false, limit: 5 },
    { retry: false },
  )

  const handleAbrirSessao = () => {
    abrirSessao.mutate(void 0, { onSuccess: () => refetchNotas() })
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-800">CIS — Sistema de Inteligência Clínica</h1>
        <button
          onClick={logout}
          className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          Sair
        </button>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {alertas && alertas.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-sm font-semibold text-amber-800 mb-2">
              ⚠️ {alertas.length} alerta{alertas.length > 1 ? 's' : ''} de conduta pendente{alertas.length > 1 ? 's' : ''}
            </p>
            <ul className="space-y-1">
              {alertas.map((a) => (
                <li key={a.id} className="text-sm text-amber-700">
                  <span className="font-medium capitalize">{a.nivelUrgencia}</span>
                  {a.mensagemMedico ? ` — ${a.mensagemMedico}` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Sessão Clínica</h2>
          <button
            onClick={handleAbrirSessao}
            disabled={abrirSessao.isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-5 rounded-xl transition-colors disabled:opacity-50 text-sm"
          >
            {abrirSessao.isPending ? 'Abrindo…' : 'Iniciar Atendimento'}
          </button>
          {abrirSessao.isSuccess && (
            <p className="mt-3 text-sm text-green-600">
              Sessão {abrirSessao.data.nova ? 'aberta' : 'retomada'} — ID {abrirSessao.data.sessionId}
            </p>
          )}
          {abrirSessao.isError && (
            <p className="mt-3 text-sm text-red-500">{abrirSessao.error.message}</p>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Notas Recentes</h2>
          {!notas?.items || notas.items.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma nota registrada ainda.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {notas.items.map((n) => (
                <li key={n.id} className="py-3 flex items-start gap-3">
                  <span className="mt-0.5 text-xs font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
                    {n.cid10 ?? '—'}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {n.diagnosticoPrincipal ?? 'Diagnóstico não definido'}
                    </p>
                    <p className="text-xs text-slate-400">
                      {n.template} · {new Date(n.createdAt).toLocaleString('pt-BR')}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  )
}

export default function App() {
  const { token } = useAuth()
  const session = token ? parseJwtPayload(token) : null
  const role = session?.type === 'staff' ? session.role : null

  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/auth/callback" component={AuthCallback} />
          <Route path="/medico">
            {role === 'medico' || role === 'admin' ? <CISDashboard /> : <LoginPage />}
          </Route>
          <Route path="/admin">
            {role === 'admin' ? <CISDashboard /> : <LoginPage />}
          </Route>
          <Route path="/login" component={LoginPage} />
          <Route path="/" component={LoginPage} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </ErrorBoundary>
  )
}

function AuthCallback() {
  const { setToken } = useAuth()
  const [, navigate] = useLocation()
  const [timedOut, setTimedOut] = useState(false)

  const [code] = useState(() => {
    const p = new URLSearchParams(window.location.search)
    const c = p.get('code') ?? ''
    if (c) window.history.replaceState({}, '', '/auth/callback')
    return c
  })

  const hasAttempted = useRef(false)

  const callbackMutation = trpc.auth.callback.useMutation({
    onSuccess: (data: { token: string }) => {
      setToken(data.token)
      const session = parseJwtPayload(data.token)
      const role = session?.type === 'staff' ? session.role : null
      navigate(role === 'admin' ? '/admin' : '/medico')
    },
  })

  useEffect(() => {
    if (!code) return
    const storageKey = `oauth_code_used:${code}`
    if (hasAttempted.current || sessionStorage.getItem(storageKey)) return
    hasAttempted.current = true
    sessionStorage.setItem(storageKey, '1')
    callbackMutation.mutate({ code, redirectUri: `${window.location.origin}/auth/callback` })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!callbackMutation.isSuccess) setTimedOut(true)
    }, 15_000)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (callbackMutation.isError || timedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-700 mb-2">Falha na autenticação</h1>
          <p className="text-slate-500 mb-4">
            {timedOut && !callbackMutation.isError
              ? 'O servidor demorou muito. Tente novamente.'
              : (callbackMutation.error?.message ?? 'Não foi possível completar o login.')}
          </p>
          <a href="/login" className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-blue-700 transition-colors inline-block">
            Tentar novamente
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-slate-500">Autenticando…</p>
    </div>
  )
}

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-slate-300">404</h1>
        <p className="text-slate-500 mt-2">Página não encontrada</p>
        <a href="/" className="mt-4 inline-block text-blue-600 underline">Voltar</a>
      </div>
    </div>
  )
}
