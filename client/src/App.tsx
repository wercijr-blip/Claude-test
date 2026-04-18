import { Route, Switch } from 'wouter'
import { useAuth } from './_core/hooks/useAuth.ts'
import IntakePage from './components/IntakePage.tsx'
import FormularioPaciente from './components/FormularioPaciente.tsx'
import MedicoDashboard from './components/MedicoDashboard.tsx'
import SecretariaDashboard from './components/SecretariaDashboard.tsx'
import AuditDashboard from './components/AuditDashboard.tsx'
import LoginPage from './components/LoginPage.tsx'
import TokenEntryPage from './components/TokenEntryPage.tsx'
import { parseJwtPayload } from './_core/hooks/useAuth.ts'
import { trpc } from './lib/trpc.ts'

export default function App() {
  const { token } = useAuth()
  const session = token ? parseJwtPayload(token) : null
  const role = session?.type === 'staff' ? session.role : null

  return (
    <Switch>
      <Route path="/auth/callback" component={AuthCallback} />
      <Route path="/cadastro" component={IntakePage} />
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
      <Route path="/pagamento/sucesso" component={PagamentoSucesso} />
      <Route path="/pagamento/cancelado" component={PagamentoCancelado} />
      <Route path="/equipe" component={LoginPage} />
      <Route path="/" component={IntakePage} />
      <Route component={NotFound} />
    </Switch>
  )
}

function AuthCallback() {
  const { setToken } = useAuth()

  const params = new URLSearchParams(window.location.search)
  const code = params.get('code') ?? ''

  const callbackMutation = trpc.auth.callback.useMutation({
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
          Em instantes você receberá o link de acesso ao formulário por <strong>e-mail</strong> e <strong>WhatsApp</strong>.
        </p>
        <p className="text-slate-400 text-xs mt-4">Verifique também sua caixa de spam.</p>
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
