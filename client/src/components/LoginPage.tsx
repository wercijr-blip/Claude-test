export default function LoginPage() {
  const handleLogin = () => {
    const state = crypto.randomUUID()
    sessionStorage.setItem('oauth_state', state)
    const redirectUri = `${window.location.origin}/auth/callback`
    window.location.href = `${import.meta.env.VITE_OAUTH_SERVER_URL}/auth?app_id=${import.meta.env.VITE_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 w-full max-w-sm text-center">
        <h1 className="text-2xl font-bold text-blue-700 mb-1">Facilita PrEP</h1>
        <p className="text-slate-500 text-sm mb-8">Acesso da equipe clínica</p>
        <button
          onClick={handleLogin}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
        >
          Entrar com conta institucional
        </button>
      </div>
    </div>
  )
}
