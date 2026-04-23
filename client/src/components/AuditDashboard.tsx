import { useLocation } from 'wouter'

// AuditDashboard — redirecionado para o painel admin do MedScribe
export default function AuditDashboard() {
  const [, setLocation] = useLocation()

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="text-center">
        <h1 className="text-xl font-bold text-slate-800 mb-2">Painel Administrativo</h1>
        <p className="text-slate-500 text-sm mb-6">Use o novo painel MedScribe para gerenciar a clínica.</p>
        <button
          onClick={() => setLocation('/admin/dashboard')}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-blue-700 transition-colors"
        >
          Ir para Admin Dashboard
        </button>
      </div>
    </div>
  )
}
