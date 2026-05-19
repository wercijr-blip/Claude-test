import { lazy, Suspense, Component, useEffect, useRef, useState, type ReactNode } from 'react'
import { Route, Switch, useLocation } from 'wouter'
import { useAuth, parseJwtPayload } from './_core/hooks/useAuth.ts'
// Eager: needed immediately for the landing page and core auth flow
import LandingPage from './components/LandingPage.tsx'
import LoginPage from './components/LoginPage.tsx'
import TokenEntryPage from './components/TokenEntryPage.tsx'
import FooterCfm from './components/FooterCfm.tsx'
import CookieConsent from './components/CookieConsent.tsx'
// IntakePage: already bundled with LandingPage (static import there), keep eager here too
import IntakePage from './components/IntakePage.tsx'
import { trpc } from './lib/trpc.ts'
import { initClickListener, trackPageView, trackPurchase } from './lib/analytics.ts'

// Lazy: secondary routes not needed on initial render — each becomes its own JS chunk
const SegundaParteInicio = lazy(() => import('./components/SegundaParteInicio.tsx'))
const FormularioPaciente = lazy(() => import('./components/FormularioPaciente.tsx'))
const MedicoDashboard = lazy(() => import('./components/MedicoDashboard.tsx'))
const SecretariaDashboard = lazy(() => import('./components/SecretariaDashboard.tsx'))
const AuditDashboard = lazy(() => import('./components/AuditDashboard.tsx'))
const AuditoriaPage = lazy(() => import('./components/AuditoriaPage.tsx'))
const DuvidasPage = lazy(() => import('./components/DuvidasPage.tsx'))
const VerificacaoPage = lazy(() => import('./components/VerificacaoPage.tsx'))
const PrivacidadePage = lazy(() => import('./components/PrivacidadePage.tsx'))
const TermosPage = lazy(() => import('./components/TermosPage.tsx'))
const PesquisaSatisfacao = lazy(() => import('./components/PesquisaSatisfacao.tsx'))

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-fp-accent rounded-full animate-spin" />
    </div>
  )
}

/** Fire page_view on every wouter navigation. */
function useTrackPageView() {
  const [location] = useLocation()
  useEffect(() => {
    trackPageView(location)
  }, [location])
}

/** Attach global [data-event] click tracker once. */
function useAnalyticsInit() {
  useEffect(() => {
    initClickListener()
  }, [])
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
            <p className="text-slate-500 mb-4">Ocorreu um erro inesperado.</p>
            <button
              className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-blue-700 transition-colors"
              onClick={() => window.location.reload()}
            >
              Recarregar página
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// Bloqueia acesso ao formulário se o exame ainda não foi aprovado.
function FormularioGate({ pacienteId }: { pacienteId?: number }) {
  const [, navigate] = useLocation()
  const statusQuery = trpc.consulta.status.useQuery(undefined, {
    refetchOnWindowFocus: false,
    retry: false,
  })

  useEffect(() => {
    if (!statusQuery.data) return
    const aprovado = statusQuery.data.status === 'aprovado' || statusQuery.data.status === 'aprovado_ia'
    if (!aprovado) navigate('/inicio')
  }, [statusQuery.data, navigate])

  if (statusQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
      </div>
    )
  }

  const aprovado = statusQuery.data?.status === 'aprovado' || statusQuery.data?.status === 'aprovado_ia'
  if (!aprovado) return null

  return <FormularioPaciente pacienteId={pacienteId} />
}

export default function App() {
  const { token } = useAuth()
  const session = token ? parseJwtPayload(token) : null
  const role = session?.type === 'staff' ? session.role : null

  useTrackPageView()
  useAnalyticsInit()

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col">
        <div className="flex-1">
          <Suspense fallback={<PageLoader />}>
          <Switch>
            <Route path="/auth/callback" component={AuthCallback} />
            <Route path="/cadastro"><IntakePage /></Route>
            <Route path="/acesso/:token" component={TokenEntryPage} />
            <Route path="/inicio" component={SegundaParteInicio} />
            <Route path="/formulario/:pacienteId?">
              {session?.type === 'patient'
                ? <FormularioGate pacienteId={session.pacienteId ?? undefined} />
                : <TokenEntryPage />}
            </Route>
            <Route path="/medico">
              {role === 'medico' || role === 'admin' ? <MedicoDashboard /> : <LoginPage />}
            </Route>
            <Route path="/secretaria">
              {role === 'secretaria' || role === 'admin' ? <SecretariaDashboard /> : <LoginPage />}
            </Route>
            <Route path="/admin">
              {role === 'admin' ? <AuditDashboard /> : <LoginPage />}
            </Route>
            <Route path="/duvidas" component={DuvidasPage} />
            <Route path="/privacidade" component={PrivacidadePage} />
            <Route path="/termos" component={TermosPage} />
            <Route path="/v/:slug" component={VerificacaoPage} />
            <Route path="/pesquisa/:pacienteId/:token" component={PesquisaSatisfacao} />
            <Route path="/pagamento/sucesso" component={PagamentoSucesso} />
            <Route path="/sucesso" component={PagamentoSucesso} />
            <Route path="/pagamento/cancelado" component={PagamentoCancelado} />
            <Route path="/equipe">
              {role === 'admin' ? <AuditDashboard /> : <LoginPage />}
            </Route>
            <Route path="/auditoria">
              {role === 'admin' ? <AuditoriaPage /> : <LoginPage />}
            </Route>
            <Route path="/" component={LandingPage} />
            <Route component={NotFound} />
          </Switch>
          </Suspense>
        </div>
        <FooterCfm />
        <CookieConsent />
      </div>
    </ErrorBoundary>
  )
}

function AuthCallback() {
  const { setToken } = useAuth()
  const [, navigate] = useLocation()
  const [timedOut, setTimedOut] = useState(false)

  // Read code once from URL, then immediately clear it from the address bar so
  // a page-refresh cannot replay the same code (Google rejects reused codes with
  // invalid_grant). useState lazy initializer runs only on first mount.
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
      if (role === 'admin') {
        navigate('/equipe')
      } else if (role === 'medico') {
        navigate('/medico')
      } else if (role === 'secretaria') {
        navigate('/secretaria')
      } else {
        navigate('/')
      }
    },
  })

  useEffect(() => {
    if (!code) return
    // Guard against React StrictMode double-invoke and page refreshes after the
    // code has already been consumed.
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
              ? 'O servidor demorou muito para responder. Tente novamente.'
              : (callbackMutation.error?.message ?? 'Não foi possível completar o login. Tente novamente.')}
          </p>
          <a
            href="/login"
            className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-blue-700 transition-colors inline-block"
          >
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

function PagamentoSucesso() {
  const params = new URLSearchParams(window.location.search)
  // Flow A: legacy — paymentId present (PIX fallback, old card flow)
  const paymentId = params.get('paymentId') || params.get('asaas_payment_id') || ''
  // Flow B: card checkout — Asaas autoRedirect carries precadastroId
  const precadastroIdParam = params.get('precadastroId')
  const precadastroId = precadastroIdParam ? Number(precadastroIdParam) : null

  const [, navigate] = useLocation()
  const { setToken } = useAuth()
  const hasAttempted = useRef(false)
  const [erro, setErro] = useState<string | null>(null)

  const acesso = trpc.intake.acessoPosPagamento.useMutation({
    onSuccess: (data: { sessionToken: string }) => {
      setToken(data.sessionToken)
      navigate('/inicio')
    },
    onError: (err: { message: string }) => setErro(err.message),
  })

  // Flow A: poll by paymentId (legacy / PIX webhook path)
  const { data: statusData } = trpc.intake.consultarStatusPagamento.useQuery(
    { paymentId },
    { refetchInterval: 3000, enabled: !!paymentId && !hasAttempted.current },
  )

  // Flow B: poll by precadastroId (card checkout — Asaas autoRedirect)
  const { data: statusPrecad } = trpc.intake.consultarStatusPorPrecadastro.useQuery(
    { precadastroId: precadastroId ?? 0 },
    { refetchInterval: 3000, enabled: !!precadastroId && !hasAttempted.current },
  )

  useEffect(() => {
    const status = statusData?.status
    if ((status === 'RECEIVED' || status === 'CONFIRMED') && !hasAttempted.current) {
      hasAttempted.current = true
      acesso.mutate({ paymentId })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusData?.status])

  useEffect(() => {
    const { confirmado } = statusPrecad ?? {}
    if (confirmado && precadastroId && !hasAttempted.current) {
      hasAttempted.current = true
      trackPurchase(`precad-${precadastroId}`, 250)
      acesso.mutate({ precadastroId })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusPrecad?.confirmado])

  const confirmed =
    statusData?.status === 'RECEIVED' || statusData?.status === 'CONFIRMED' ||
    statusPrecad?.confirmado

  // No identifier → friendly message instead of infinite spinner
  if (!paymentId && !precadastroId) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Pagamento não identificado</h2>
          <p className="text-slate-500 text-sm mb-2">
            Se você acabou de pagar, verifique seu e-mail e WhatsApp — o link de acesso é enviado em instantes.
          </p>
          <p className="text-slate-400 text-xs">
            Dúvidas?{' '}
            <a href="mailto:contato@facilitaprep.com.br" className="text-blue-600 hover:underline">
              contato@facilitaprep.com.br
            </a>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md w-full text-center">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${confirmed ? 'bg-emerald-100' : 'bg-blue-50'}`}>
          {confirmed ? (
            <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <div className="w-8 h-8 border-4 border-blue-100 border-t-blue-500 rounded-full animate-spin" />
          )}
        </div>
        {erro ? (
          <>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Pagamento recebido!</h2>
            <p className="text-slate-500 text-sm mb-2">
              Em instantes você receberá o link de acesso ao formulário por <strong>e-mail</strong> e <strong>WhatsApp</strong>.
            </p>
            <p className="text-slate-400 text-xs mt-4">Verifique também sua caixa de spam.</p>
          </>
        ) : confirmed ? (
          <>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Pagamento confirmado!</h2>
            <p className="text-slate-500 text-sm">Te levando para o próximo passo…</p>
            <div className="w-6 h-6 border-2 border-slate-200 border-t-emerald-600 rounded-full animate-spin mx-auto mt-4" />
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Confirmando pagamento…</h2>
            <p className="text-slate-500 text-sm">Aguarde um instante. Não feche esta página.</p>
          </>
        )}
      </div>
    </div>
  )
}

function PagamentoCancelado() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Pagamento cancelado</h2>
        <p className="text-slate-500 text-sm mb-6">Nenhum valor foi cobrado. Você pode tentar novamente.</p>
        <a href="/cadastro" className="inline-block bg-blue-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-blue-700 transition-colors">
          Tentar novamente
        </a>
      </div>
    </div>
  )
}

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-slate-300">404</h1>
        <p className="text-slate-500 mt-2">Página não encontrada</p>
        <a href="/" className="mt-4 inline-block text-blue-600 underline">Voltar ao início</a>
      </div>
    </div>
  )
}
