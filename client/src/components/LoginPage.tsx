import { useLocation } from 'wouter'

// Legacy LoginPage — redirecionado para o novo /login do MedScribe
export default function LoginPage() {
  const [, setLocation] = useLocation()

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 w-full max-w-sm text-center">
        <h1 className="text-xl font-bold text-slate-800 mb-2">Facilita PrEP</h1>
        <p className="text-slate-500 text-sm mb-6">Acesso da equipe clínica</p>
        <button
          onClick={() => setLocation('/login')}
          className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700 transition-colors"
        >
          Fazer login
        </button>
      </div>
    </div>
  )
}
