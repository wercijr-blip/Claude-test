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
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">CIS — Dashboard</h1>
        <p className="text-slate-500">Interface do médico em desenvolvimento.</p>
      </div>
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
