import { Component, lazy, Suspense, type ReactNode, useEffect } from 'react'
import { Route, Switch, useLocation } from 'wouter'
import { trpc } from './lib/trpc.ts'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createTrpcClient } from './lib/trpc.ts'

// MedScribe pages — carregadas sob demanda para reduzir bundle inicial
import Login          from './pages/Login.tsx'
import ChangePassword from './pages/ChangePassword.tsx'
const Perfil         = lazy(() => import('./pages/Perfil.tsx'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard.tsx'))
const AdminDoctors   = lazy(() => import('./pages/AdminDoctors.tsx'))
const AdminBulletin  = lazy(() => import('./pages/AdminBulletin.tsx'))
const Knowledge      = lazy(() => import('./pages/Knowledge.tsx'))

// Legacy Facilita PrEP components
import IntakePage          from './components/IntakePage.tsx'
import SegundaParteInicio  from './components/SegundaParteInicio.tsx'
import FormularioPaciente  from './components/FormularioPaciente.tsx'
import MedicoDashboard     from './components/MedicoDashboard.tsx'
import SecretariaDashboard from './components/SecretariaDashboard.tsx'
import AuditDashboard      from './components/AuditDashboard.tsx'
import TokenEntryPage      from './components/TokenEntryPage.tsx'
import PesquisaSatisfacao  from './components/PesquisaSatisfacao.tsx'
import DuvidasPage         from './components/DuvidasPage.tsx'
import FooterCfm           from './components/FooterCfm.tsx'

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})
const trpcClient = createTrpcClient()

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

export default function App() {
  return (
    <ErrorBoundary>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <AppRoutes />
        </QueryClientProvider>
      </trpc.Provider>
    </ErrorBoundary>
  )
}

function AppRoutes() {
  const meQuery = trpc.auth.me.useQuery()
  const me      = meQuery.data
  const [, setLocation] = useLocation()

  // Guard: redirecionar para /change-password se must_change_password
  useEffect(() => {
    if (!me) return
    if (!me.mustChangePassword) return
    const path = window.location.pathname
    if (path !== '/change-password' && path !== '/login') {
      setLocation('/change-password')
    }
  }, [me, setLocation])

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1">
        <Suspense fallback={<PageLoader />}>
          <Switch>
            {/* ── MedScribe routes ─────────────────── */}
            <Route path="/login"           component={Login} />
            <Route path="/change-password" component={ChangePassword} />
            <Route path="/perfil">
              {me ? <Perfil /> : <Login />}
            </Route>
            <Route path="/admin/dashboard">
              {me?.role === 'admin' ? <AdminDashboard /> : me ? <AdminAccessDenied /> : <Login />}
            </Route>
            <Route path="/admin/doctors">
              {me?.role === 'admin' ? <AdminDoctors /> : me ? <AdminAccessDenied /> : <Login />}
            </Route>
            <Route path="/admin/bulletin">
              {me?.role === 'admin' ? <AdminBulletin /> : me ? <AdminAccessDenied /> : <Login />}
            </Route>
            <Route path="/knowledge">
              {me?.role === 'admin' ? <Knowledge /> : me ? <AdminAccessDenied /> : <Login />}
            </Route>
            <Route path="/dashboard">
              {me ? <DashboardPlaceholder /> : <Login />}
            </Route>

            {/* ── Legacy Facilita PrEP routes ──────── */}
            <Route path="/auth/callback" component={AuthCallback} />
            <Route path="/cadastro"      component={IntakePage} />
            <Route path="/acesso/:token" component={TokenEntryPage} />
            <Route path="/inicio"        component={SegundaParteInicio} />
            <Route path="/formulario/:pacienteId?">
              <FormularioPaciente />
            </Route>
            <Route path="/medico">
              {me?.role === 'admin' || me?.role === 'doctor' ? <MedicoDashboard /> : <Login />}
            </Route>
            <Route path="/secretaria">
              <SecretariaDashboard />
            </Route>
            <Route path="/admin">
              {me?.role === 'admin' ? <AuditDashboard /> : <Login />}
            </Route>
            <Route path="/duvidas"                       component={DuvidasPage} />
            <Route path="/pesquisa/:pacienteId/:token"   component={PesquisaSatisfacao} />
            <Route path="/pagamento/sucesso"             component={PagamentoSucesso} />
            <Route path="/pagamento/cancelado"           component={PagamentoCancelado} />
            <Route path="/equipe"                        component={Login} />

            {/* Root: MedScribe login ou legacy intake */}
            <Route path="/">
              {me ? (me.role === 'admin' ? <AdminDashboard /> : <DashboardPlaceholder />) : <Login />}
            </Route>
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </div>
      <FooterCfm />
    </div>
  )
}

function AdminAccessDenied() {
  const [, setLocation] = useLocation()
  useEffect(() => {
    const t = setTimeout(() => setLocation('/dashboard'), 100)
    return () => clearTimeout(t)
  }, [setLocation])
  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-slate-500">Área restrita ao administrador. Redirecionando…</p>
    </div>
  )
}

function DashboardPlaceholder() {
  const meQuery = trpc.auth.me.useQuery()
  const me      = meQuery.data
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Dashboard MedScribe</h1>
        <p className="text-slate-500 mb-6">Bem-vindo, Dr(a). {me?.name}!</p>
        <p className="text-sm text-slate-400">Módulo de consultas em desenvolvimento.</p>
      </div>
    </div>
  )
}

function AuthCallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-slate-500">Processando autenticação…</p>
    </div>
  )
}

function PagamentoSucesso() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Pagamento confirmado!</h2>
        <p className="text-slate-500 text-sm">
          Em instantes você receberá o link de acesso por <strong>e-mail</strong>.
        </p>
      </div>
    </div>
  )
}

function PagamentoCancelado() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md w-full text-center">
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
