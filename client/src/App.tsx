import { Route, Switch } from 'wouter'
import { useAuth } from './_core/hooks/useAuth.ts'
import FormularioPaciente from './components/FormularioPaciente.tsx'
import MedicoDashboard from './components/MedicoDashboard.tsx'
import SecretariaDashboard from './components/SecretariaDashboard.tsx'
import AuditDashboard from './components/AuditDashboard.tsx'
import LoginPage from './components/LoginPage.tsx'
import TokenEntryPage from './components/TokenEntryPage.tsx'
import { parseJwtPayload } from './_core/hooks/useAuth.ts'

export default function App() {
  const { token } = useAuth()

  const session = token ? parseJwtPayload(token) : null
  const role = session?.type === 'staff' ? session.role : null

  return (
    <Switch>
      <Route path="/auth/callback" component={AuthCallback} />
      <Route path="/acesso/:token" component={TokenEntryPage} />
      <Route path="/formulario/:pacienteId?">
        {session?.type === 'patient' ? <FormularioPaciente /> : <TokenEntryPage />}
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
      <Route path="/" component={Home} />
      <Route component={NotFound} />
    </Switch>
  )
}

function Home() {
  const { token } = useAuth()
  const session = token ? parseJwtPayload(token) : null

  if (session?.type === 'staff') {
    const role = session.role
    if (role === 'medico') window.location.href = '/medico'
    if (role === 'secretaria') window.location.href = '/secretaria'
    if (role === 'admin') window.location.href = '/admin'
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-blue-700 mb-2">Facilita PrEP</h1>
        <p className="text-slate-500 mb-6">Plataforma de saúde digital para prevenção do HIV</p>
        <a href="/auth/login" className="text-blue-600 underline">Entrar como equipe</a>
      </div>
    </div>
  )
}

function AuthCallback() {
  const { setToken } = useAuth()
  const { trpc: trpcHooks } = require('./lib/trpc.ts')

  const params = new URLSearchParams(window.location.search)
  const code = params.get('code') ?? ''

  const callbackMutation = trpcHooks.auth.callback.useMutation({
    onSuccess: (data: { token: string }) => {
      setToken(data.token)
      window.location.href = '/'
    },
  })

  if (code && !callbackMutation.isPending) {
    callbackMutation.mutate({ code })
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
        <a href="/" className="mt-4 inline-block text-blue-600 underline">Voltar ao início</a>
      </div>
    </div>
  )
}
