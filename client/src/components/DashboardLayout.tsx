import type { ReactNode } from 'react'
import { useLocation } from 'wouter'
import { trpc } from '../lib/trpc.ts'

interface Props {
  children: ReactNode
}

export default function DashboardLayout({ children }: Props) {
  const [location, setLocation] = useLocation()
  const meQuery  = trpc.auth.me.useQuery()
  const me       = meQuery.data
  const utils    = trpc.useUtils()

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess() {
      utils.auth.me.reset()
      setLocation('/login')
    },
  })

  const initials = me?.name
    ? me.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
    : '?'

  const navItem = (path: string, label: string) => (
    <button
      key={path}
      onClick={() => setLocation(path)}
      className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        location.startsWith(path)
          ? 'bg-blue-50 text-blue-700'
          : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-slate-200 flex flex-col p-4 shrink-0">
        <div className="flex items-center gap-3 mb-6 px-1">
          <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{me?.name ?? '…'}</p>
            <p className="text-xs text-slate-400 truncate">{me?.specialty ?? (me?.role === 'admin' ? 'Admin' : '')}</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          {navItem('/dashboard', 'Dashboard')}
          {navItem('/perfil', 'Meu Perfil')}

          {me?.role === 'admin' && (
            <>
              <hr className="border-slate-100 my-2" />
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide px-3 mb-1">Admin</p>
              {navItem('/admin/dashboard', 'Painel Admin')}
              {navItem('/admin/doctors', 'Médicos')}
              {navItem('/admin/bulletin', 'Boletins')}
              {navItem('/knowledge', 'Conhecimento')}
            </>
          )}
        </nav>

        <button
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
          className="mt-4 w-full text-left px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 font-medium transition-colors"
        >
          {logoutMutation.isPending ? 'Saindo…' : 'Sair'}
        </button>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-auto">
        {children}
      </main>
    </div>
  )
}
