import { useState } from 'react'
import { useLocation } from 'wouter'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { trpc } from '../lib/trpc.ts'
import DashboardLayout from '../components/DashboardLayout.tsx'
import DoctorProfileModal from '../components/DoctorProfileModal.tsx'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#ef4444']

type Period = 7 | 30 | 90 | 365

export default function AdminDashboard() {
  const [, setLocation]  = useLocation()
  const [period, setPeriod] = useState<Period>(30)
  const [selectedDoctor, setSelectedDoctor] = useState<number | null>(null)

  const meQuery = trpc.auth.me.useQuery()
  const me      = meQuery.data

  if (me && me.role !== 'admin') {
    setLocation('/dashboard')
    return null
  }

  const overview   = trpc.admin.stats.overview.useQuery()
  const timeline   = trpc.admin.stats.timeline.useQuery({ days: period })
  const byDoctor   = trpc.admin.stats.byDoctor.useQuery()
  const byPath     = trpc.admin.stats.byPathology.useQuery({ limit: 10 })
  const platform   = trpc.admin.stats.platform.useQuery()
  const clinical   = trpc.admin.stats.clinicalIndicators.useQuery()

  const ov = overview.data

  return (
    <DashboardLayout>
      <div className="p-6 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-800">Painel Administrativo</h1>
          <PeriodFilter period={period} onChange={setPeriod} />
        </div>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Consultas hoje"  value={ov?.today  ?? '—'} icon="📋" />
          <StatCard label="Consultas/mês"   value={ov?.month  ?? '—'} icon="📅" />
          <StatCard label="Médicos ativos"  value={ov?.activeDoctors ?? '—'} icon="👨‍⚕️" />
          <StatCard label="Tópicos gerados" value={ov?.totalTopics   ?? '—'} icon="📚" />
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-base font-semibold text-slate-700 mb-4">Evolução de Consultas</h2>
          {timeline.data?.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={timeline.data}>
                <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : <Empty />}
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-base font-semibold text-slate-700 mb-4">Por Médico</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="pb-2 font-medium">Nome</th>
                  <th className="pb-2 font-medium">Especialidade</th>
                  <th className="pb-2 font-medium">CRM</th>
                  <th className="pb-2 font-medium">Consultas/mês</th>
                  <th className="pb-2 font-medium">Total</th>
                  <th className="pb-2 font-medium">Tópicos</th>
                  <th className="pb-2 font-medium">Última</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {byDoctor.data?.map((d) => (
                  <tr key={d.userId} className="hover:bg-slate-50">
                    <td className="py-3 font-medium text-slate-800">{d.name ?? '—'}</td>
                    <td className="py-3 text-slate-500">{d.specialty ?? '—'}</td>
                    <td className="py-3 text-slate-500">{d.crm ?? '—'}</td>
                    <td className="py-3">{Number(d.monthCount) || 0}</td>
                    <td className="py-3">{d.total}</td>
                    <td className="py-3">{d.topicsGenerated}</td>
                    <td className="py-3 text-slate-400 text-xs">
                      {d.lastConsultation ? new Date(d.lastConsultation).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="py-3">
                      <button onClick={() => setSelectedDoctor(d.userId)} className="text-blue-600 text-xs hover:underline">Ver perfil</button>
                    </td>
                  </tr>
                ))}
                {!byDoctor.data?.length && (
                  <tr><td colSpan={8} className="py-8 text-center text-slate-400">Sem dados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-base font-semibold text-slate-700 mb-4">Top Patologias</h2>
          <div className="space-y-3">
            {byPath.data?.map((p, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-sm text-slate-700 w-48 truncate">{p.topic}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${p.percentage}%` }} />
                </div>
                <span className="text-xs text-slate-400 w-10 text-right">{p.percentage}%</span>
                <span className="text-xs text-slate-500 w-6 text-right">{p.count}</span>
              </div>
            ))}
            {!byPath.data?.length && <Empty />}
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-base font-semibold text-slate-700 mb-4">Métricas da Plataforma</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard label="Min. transcritos" value={platform.data?.totalAudioMinutes ?? '—'} icon="🎤" />
            <StatCard label="SOAPs gerados"    value={platform.data?.totalSoaps        ?? '—'} icon="📝" />
            <StatCard label="Tópicos/mês"      value={platform.data?.topicsThisMonth   ?? '—'} icon="🔬" />
            <StatCard label="Médicos ativos"   value={ov?.activeDoctors ?? '—'} icon="👤" />
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-medium text-slate-600 mb-3">Distribuição de Qualidade</p>
              {platform.data?.qualityDist?.length ? (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={platform.data.qualityDist} dataKey="count" nameKey="bucket" cx="50%" cy="50%" outerRadius={70} innerRadius={40}>
                      {platform.data.qualityDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Legend />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : <Empty />}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600 mb-3">Distribuição por Status</p>
              {platform.data?.statusDist?.length ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={platform.data.statusDist}>
                    <XAxis dataKey="status" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <Empty />}
            </div>
          </div>
        </section>

        {clinical.data && (
          <section className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-base font-semibold text-slate-700 mb-4">Indicadores Clínicos</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Consultas c/ exames" value={`${clinical.data.withExamsPercentage}%`} icon="🔬" />
              <StatCard label="Tratamento oral"     value={`${clinical.data.treatmentDistribution.oral}%`} icon="💊" />
              <StatCard label="Tratamento IV"       value={`${clinical.data.treatmentDistribution.iv}%`} icon="💉" />
              <StatCard label="Internação"          value={`${clinical.data.hospitalizationPercentage}%`} icon="🏥" />
            </div>
          </section>
        )}
      </div>

      {selectedDoctor != null && (
        <DoctorProfileModal userId={selectedDoctor} open={selectedDoctor != null} onClose={() => setSelectedDoctor(null)} />
      )}
    </DashboardLayout>
  )
}

function PeriodFilter({ period, onChange }: { period: Period; onChange: (p: Period) => void }) {
  const opts: { label: string; value: Period }[] = [
    { label: '7d', value: 7 }, { label: '30d', value: 30 }, { label: '3m', value: 90 }, { label: '1a', value: 365 },
  ]
  return (
    <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
      {opts.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${period === o.value ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
      <p className="text-2xl mb-1">{icon}</p>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  )
}

function Empty() {
  return <p className="text-center text-slate-400 text-sm py-6">Sem dados disponíveis</p>
}
