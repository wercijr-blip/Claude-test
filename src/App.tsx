import { useState, useEffect } from 'react'
import MeetingRecorder from './MeetingRecorder.tsx'

interface Config {
  whisperDisponivel: boolean
  iaDisponivel: boolean
  authRequired: boolean
}

export default function App() {
  const [config, setConfig] = useState<Config | null>(null)
  const [token, setToken] = useState(() => localStorage.getItem('mr_token') ?? '')
  const [tokenInput, setTokenInput] = useState('')
  const [authError, setAuthError] = useState(false)

  const apiBase = (import.meta.env['VITE_API_URL'] as string | undefined) ?? ''

  useEffect(() => {
    void fetch(`${apiBase}/api/config`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async (r) => {
        if (r.status === 401) { setAuthError(true); return }
        setConfig(await r.json() as Config)
      })
      .catch(() => setConfig({ whisperDisponivel: false, iaDisponivel: false, authRequired: false }))
  }, [token, apiBase])

  const handleLogin = () => {
    localStorage.setItem('mr_token', tokenInput)
    setToken(tokenInput)
    setAuthError(false)
  }

  if (authError || (config?.authRequired && !token)) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 w-full max-w-sm shadow-sm">
          <h1 className="text-xl font-bold text-slate-800 mb-2">Gravador de Reunião</h1>
          <p className="text-sm text-slate-500 mb-6">Informe o token de acesso para continuar.</p>
          {authError && <p className="text-xs text-red-600 mb-3">Token inválido. Tente novamente.</p>}
          <input
            type="password"
            placeholder="Token de acesso"
            value={tokenInput}
            onChange={e => setTokenInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleLogin}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-medium text-sm transition-colors"
          >
            Entrar
          </button>
        </div>
      </div>
    )
  }

  if (!config) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
      </div>
    )
  }

  return <MeetingRecorder config={config} apiToken={token} apiBase={apiBase} />
}
