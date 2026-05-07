import { useAuth } from '../_core/hooks/useAuth.ts'
import { trpc } from '../lib/trpc.ts'
import type { AuthUser } from '@shared/types.ts'

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrador',
  medico: 'Médico(a)',
  secretaria: 'Secretaria',
}

export function LogoutButton() {
  const { logout } = useAuth()
  return (
    <button
      data-event="logout"
      onClick={() => { if (confirm('Deseja realmente sair?')) { logout(); window.location.href = '/' } }}
      className="text-sm text-slate-600 hover:text-red-600 font-medium px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5"
      aria-label="Sair"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
      </svg>
      <span className="hidden sm:inline">Sair</span>
    </button>
  )
}

export default function StaffHeader() {
  const { data: session } = trpc.auth.me.useQuery()

  if (!session || session.type !== 'staff') return null

  const me = session as AuthUser
  const displayName = me.email ?? me.nome ?? 'Usuário'
  const initials = (me.nome ?? me.email ?? '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '?'

  return (
    <header className="border-b border-slate-200 bg-white px-4 py-3 flex items-center justify-between sticky top-0 z-50 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold text-sm select-none">
          {initials}
        </div>
        <div className="hidden sm:block">
          <div className="text-sm font-medium text-slate-700 leading-tight">{displayName}</div>
          <div className="text-xs text-slate-500">{ROLE_LABEL[me.role] ?? me.role}</div>
        </div>
      </div>
      <LogoutButton />
    </header>
  )
}
