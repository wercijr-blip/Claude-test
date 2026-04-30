import { Component, lazy, Suspense, type ReactNode, useEffect } from 'react'
import { Route, Switch, useLocation } from 'wouter'
import { trpc } from './lib/trpc.ts'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createTrpcClient } from './lib/trpc.ts'

import Login          from './pages/Login.tsx'
import ChangePassword from './pages/ChangePassword.tsx'
const Landing        = lazy(() => import('./pages/Landing.tsx'))
const Perfil         = lazy(() => import('./pages/Perfil.tsx'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard.tsx'))
const AdminDoctors   = lazy(() => import('./pages/AdminDoctors.tsx'))
const AdminBulletin  = lazy(() => import('./pages/AdminBulletin.tsx'))
const Knowledge      = lazy(() => import('./pages/Knowledge.tsx'))

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})
const trpcClient = createTrpcClient()

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() { return { hasError: true } }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-slate-700 mb-2">Algo deu errado</h1>
            <button
              className="bg-teal-700 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-teal-800 transition-colors"
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

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-teal-700 border-t-transparent rounded-full animate-spin" />
    </div>
  )
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

  useEffect(() => {
    if (!me) return
    if (!me.mustChangePassword) return
    const path = window.location.pathname
    if (path !== '/change-password' && path !== '/login') {
      setLocation('/change-password')
    }
  }, [me, setLocation])

  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
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
        <Route path="/">
          {me ? (me.role === 'admin' ? <AdminDashboard /> : <DashboardPlaceholder />) : <Landing />}
        </Route>
        <Route component={NotFound} />
      </Switch>
    </Suspense>
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
  const me = trpc.auth.me.useQuery().data
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Dashboard MedScrita</h1>
        <p className="text-slate-500 mb-6">Bem-vindo, Dr(a). {me?.name}!</p>
        <p className="text-sm text-slate-400">Módulo de consultas em desenvolvimento.</p>
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
        <a href="/" className="mt-4 inline-block text-teal-700 underline">Voltar ao início</a>
      </div>
    </div>
  )
}
