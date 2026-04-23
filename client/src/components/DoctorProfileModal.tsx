import { useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { trpc } from '../lib/trpc.ts'

interface Props {
  userId: number
  open:   boolean
  onClose: () => void
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#ef4444']

export default function DoctorProfileModal({ userId, open, onClose }: Props) {
  const [tab, setTab]       = useState<'diagnosticos' | 'conduta'>('diagnosticos')
  const [insight, setInsight] = useState('')
  const [loadingInsight, setLoadingInsight] = useState(false)

  const profileQuery = trpc.admin.stats.doctorProfile.useQuery(
    { userId },
    { enabled: open },
  )

  const profile = profileQuery.data

  const generateInsight = async () => {
    if (!profile) return
    setLoadingInsight(true)
    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method:  'POST',
        headers: {
          'x-api-key':         (import.meta.env.VITE_ANTHROPIC_API_KEY as string) ?? '',
          'anthropic-version': '2023-06-01',
          'content-type':      'application/json',
        },
        body: JSON.stringify({
          model:      'claude-sonnet-4-20250514',
          max_tokens: 500,
          messages: [{
            role:    'user',
            content: `Você é um gestor clínico. Analise o perfil do médico abaixo incluindo diagnósticos, padrão de solicitação de exames e conduta terapêutica (oral vs IV, indicação de internação). Escreva em 4-5 linhas um resumo clínico-gerencial do perfil de prática deste médico comparado com a média da clínica.\n\nDados: ${JSON.stringify(profile)}`,
          }],
        }),
      })
      const data = await resp.json() as { content: { text: string }[] }
      setInsight(data.content?.[0]?.text ?? '')
    } catch (err) {
      setInsight('Erro ao gerar insight. Verifique a configuração da API Anthropic.')
    } finally {
      setLoadingInsight(false)
    }
  }

  if (!open) return null

  const doc    = profile?.doctor
  const stats  = profile?.stats
  const clin   = profile?.clinicalData

  const pieData = profile?.topDiagnoses?.slice(0, 5).map((d) => ({
    name:  d.topic,
    value: d.count,
  })) ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                {doc?.name ?? '—'} {doc?.specialty ? `— ${doc.specialty}` : ''}
                {doc?.crm ? ` — CRM ${doc.crm}` : ''}
              </h2>
              <p className="text-slate-500 text-sm mt-0.5">{doc?.email}</p>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
          </div>

          {stats && (
            <div className="flex gap-6 mt-4 text-sm">
              <Metric label="Consultas" value={String(stats.total ?? 0)} />
              <Metric label="Concluídas" value={String(stats.completed ?? 0)} />
              <Metric label="Score médio" value={stats.avgScore ?? '—'} />
              <Metric label="Média clínica" value={profile?.clinicAvgScore ?? '—'} />
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100">
          {(['diagnosticos', 'conduta'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t === 'diagnosticos' ? 'Diagnósticos' : 'Conduta Clínica'}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-5">
          {profileQuery.isLoading && <p className="text-center text-slate-400">Carregando…</p>}

          {tab === 'diagnosticos' && (
            <>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-slate-400 text-sm text-center py-4">Sem diagnósticos registrados</p>}

              {profile?.topDiagnoses?.length ? (
                <table className="w-full text-sm mt-2">
                  <thead>
                    <tr className="text-left text-slate-400 border-b border-slate-100">
                      <th className="pb-2 font-medium">Diagnóstico</th>
                      <th className="pb-2 font-medium text-right">Ocorrências</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {profile.topDiagnoses.map((d, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-2 text-slate-700">{d.topic}</td>
                        <td className="py-2 text-right text-slate-500">{d.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </>
          )}

          {tab === 'conduta' && clin && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MiniCard label="Oral"      value={`${Math.round(clin.treatmentDistribution.oral / clin.total * 100)}%`} />
                <MiniCard label="IV"        value={`${Math.round(clin.treatmentDistribution.iv   / clin.total * 100)}%`} />
                <MiniCard label="Ambos"     value={`${Math.round(clin.treatmentDistribution.both / clin.total * 100)}%`} />
                <MiniCard label="Internação" value={`${clin.hospitalizationPercentage}%`} />
              </div>
            </div>
          )}

          {tab === 'conduta' && !clin && (
            <p className="text-slate-400 text-sm text-center py-4">Sem dados clínicos extraídos ainda</p>
          )}

          {/* Insight IA */}
          <div className="border-t border-slate-100 pt-4">
            <button
              onClick={generateInsight}
              disabled={loadingInsight}
              className="text-sm text-blue-600 border border-blue-200 rounded-lg px-4 py-2 hover:bg-blue-50 disabled:opacity-50 transition-colors"
            >
              {loadingInsight ? 'Gerando insight…' : '✨ Gerar Insight IA'}
            </button>
            {insight && (
              <div className="mt-3 bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-slate-700 leading-relaxed">
                {insight}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-slate-400 text-xs">{label}</p>
      <p className="font-semibold text-slate-800">{value}</p>
    </div>
  )
}

function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50 rounded-xl p-3 text-center">
      <p className="text-lg font-bold text-slate-800">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  )
}
