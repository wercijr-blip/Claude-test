import { useState } from 'react'
import { useLocation } from 'wouter'
import { trpc } from '../lib/trpc.ts'
import DashboardLayout from '../components/DashboardLayout.tsx'

type Doctor = {
  id: number
  name: string | null
  email: string
  specialty: string | null
  crm: string | null
  active: number
  bulletinEmail: string | null
  receiveMonthlyBulletin: number
}

export default function AdminDoctors() {
  const [, setLocation] = useLocation()
  const meQuery = trpc.auth.me.useQuery()
  const me      = meQuery.data

  if (me && me.role !== 'admin') {
    setLocation('/dashboard')
    return null
  }

  const listQuery  = trpc.user.list.useQuery()
  const doctors    = (listQuery.data ?? []) as Doctor[]
  const utils      = trpc.useUtils()

  const [showNew, setShowNew]       = useState(false)
  const [editDoctor, setEditDoctor] = useState<Doctor | null>(null)

  const deactivate = trpc.user.deactivate.useMutation({ onSuccess: () => utils.user.list.invalidate() })
  const reactivate = trpc.user.reactivate.useMutation({ onSuccess: () => utils.user.list.invalidate() })

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-800">Médicos</h1>
          <button onClick={() => setShowNew(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">+ Novo médico</button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-slate-400">
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Especialidade</th>
                <th className="px-4 py-3 font-medium">CRM</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Boletim</th>
                <th className="px-4 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {doctors.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={d.name} />
                      <div>
                        <p className="font-medium text-slate-800">{d.name ?? '—'}</p>
                        <p className="text-xs text-slate-400">{d.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{d.specialty ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{d.crm ?? '—'}</td>
                  <td className="px-4 py-3">
                    {d.active
                      ? <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium">Ativo</span>
                      : <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full text-xs font-medium">Inativo</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    {d.bulletinEmail ? <span title={d.bulletinEmail}>✅</span> : <span title="Sem email de boletim">⚠️</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => setEditDoctor(d)} className="text-xs text-blue-600 hover:underline">Editar</button>
                      <button
                        onClick={() => { d.active ? deactivate.mutate({ id: d.id }) : reactivate.mutate({ id: d.id }) }}
                        className="text-xs text-slate-500 hover:underline"
                      >
                        {d.active ? 'Desativar' : 'Reativar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!doctors.length && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">Nenhum médico cadastrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showNew && <NewDoctorModal onClose={() => setShowNew(false)} onSuccess={() => { setShowNew(false); utils.user.list.invalidate() }} />}
      {editDoctor && <EditDoctorModal doctor={editDoctor} onClose={() => setEditDoctor(null)} onSuccess={() => { setEditDoctor(null); utils.user.list.invalidate() }} />}
    </DashboardLayout>
  )
}

function Avatar({ name }: { name: string | null }) {
  const initials = name ? name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase() : '?'
  return <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">{initials}</div>
}

function NewDoctorModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [name, setName]           = useState('')
  const [email, setEmail]         = useState('')
  const [crm, setCrm]             = useState('')
  const [specialty, setSpecialty] = useState('')
  const [error, setError]         = useState('')
  const [emailSent, setEmailSent] = useState(false)

  const createMutation = trpc.user.create.useMutation({
    onSuccess() { setEmailSent(true); setTimeout(onSuccess, 2000) },
    onError(err) { setError(err.message) },
  })

  return (
    <Modal title="Novo Médico" onClose={onClose}>
      {emailSent ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-700">Email enviado para {email}! Médico criado com sucesso.</div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); setError(''); createMutation.mutate({ name, email, crm, specialty }) }} className="space-y-4">
          <Field label="Nome completo" value={name} onChange={setName} required placeholder="Dr. João Silva" />
          <Field label="Email" type="email" value={email} onChange={setEmail} required placeholder="joao@clinica.com" />
          <Field label="CRM" value={crm} onChange={setCrm} required placeholder="12345/SP" />
          <Field label="Especialidade" value={specialty} onChange={setSpecialty} required placeholder="Infectologia" />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-slate-200 text-slate-600 rounded-lg py-2 text-sm hover:bg-slate-50">Cancelar</button>
            <button type="submit" disabled={createMutation.isPending} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {createMutation.isPending ? 'Criando…' : 'Criar médico'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}

function EditDoctorModal({ doctor, onClose, onSuccess }: { doctor: Doctor; onClose: () => void; onSuccess: () => void }) {
  const [name, setName]           = useState(doctor.name ?? '')
  const [email, setEmail]         = useState(doctor.email)
  const [crm, setCrm]             = useState(doctor.crm ?? '')
  const [specialty, setSpecialty] = useState(doctor.specialty ?? '')
  const [newPass, setNewPass]     = useState('')
  const [error, setError]         = useState('')

  const updateMutation = trpc.user.update.useMutation({ onSuccess, onError(err) { setError(err.message) } })

  return (
    <Modal title="Editar Médico" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); setError(''); updateMutation.mutate({ id: doctor.id, name, email, crm, specialty, newPassword: newPass || undefined }) }} className="space-y-4">
        <Field label="Nome" value={name} onChange={setName} placeholder="Dr. João" />
        <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="joao@clinica.com" />
        <Field label="CRM" value={crm} onChange={setCrm} placeholder="12345/SP" />
        <Field label="Especialidade" value={specialty} onChange={setSpecialty} placeholder="Infectologia" />
        <Field label="Nova senha (opcional)" type="password" value={newPass} onChange={setNewPass} placeholder="Deixe vazio para não alterar" />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 border border-slate-200 text-slate-600 rounded-lg py-2 text-sm hover:bg-slate-50">Cancelar</button>
          <button type="submit" disabled={updateMutation.isPending} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {updateMutation.isPending ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', required, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} placeholder={placeholder}
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
  )
}
