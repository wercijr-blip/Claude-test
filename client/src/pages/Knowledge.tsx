import { useState } from 'react'
import { useLocation } from 'wouter'
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx'
import { trpc } from '../lib/trpc.ts'
import DashboardLayout from '../components/DashboardLayout.tsx'

type Topic = {
  id:                number
  topic:             string
  pubmedQuery:       string | null
  source:            'auto' | 'manual'
  status:            'pending' | 'sent' | 'done'
  medicalSpecialty:  string | null
  specialtyCategory: string | null
  subtopics:         string | null
  sharedBy:          number | null
  createdAt:         Date | string
}

type ChatMessage = { role: 'user' | 'assistant'; content: string }

export default function Knowledge() {
  const [, setLocation] = useLocation()
  const meQuery = trpc.auth.me.useQuery()
  const me      = meQuery.data

  if (me && me.role !== 'admin') {
    setLocation('/dashboard')
    return null
  }

  const [specialty, setSpecialty] = useState('')
  const [addModal, setAddModal]   = useState(false)
  const utils                     = trpc.useUtils()

  const topicsQuery = trpc.knowledgeTopic.list.useQuery({ medicalSpecialty: specialty || undefined })
  const topics      = (topicsQuery.data ?? []) as Topic[]

  const updateStatus = trpc.knowledgeTopic.updateStatus.useMutation({
    onSuccess: () => utils.knowledgeTopic.list.invalidate(),
  })
  const deleteTopic  = trpc.knowledgeTopic.delete.useMutation({
    onSuccess: () => utils.knowledgeTopic.list.invalidate(),
  })

  const handleExport = async () => {
    const grouped: Record<string, Record<string, Topic[]>> = {}
    topics.forEach((t) => {
      const cat = t.specialtyCategory ?? 'Outras'
      const sp  = t.medicalSpecialty   ?? 'Geral'
      if (!grouped[cat]) grouped[cat] = {}
      if (!grouped[cat][sp]) grouped[cat][sp] = []
      grouped[cat][sp].push(t)
    })

    const children: Paragraph[] = [
      new Paragraph({ text: 'Resumo Semanal de Conhecimento', heading: HeadingLevel.HEADING_1 }),
    ]
    Object.entries(grouped).forEach(([cat, specs]) => {
      children.push(new Paragraph({ text: cat, heading: HeadingLevel.HEADING_2 }))
      Object.entries(specs).forEach(([sp, ts]) => {
        children.push(new Paragraph({ text: sp, heading: HeadingLevel.HEADING_3 }))
        ts.forEach((t) => {
          children.push(
            new Paragraph({ children: [new TextRun({ text: t.topic, bold: true })] }),
            new Paragraph({ children: [new TextRun({ text: `PubMed: ${t.pubmedQuery ?? '—'}`, italics: true })] }),
            new Paragraph({ children: [new TextRun({ text: `Status: ${t.status}` })] }),
            new Paragraph({ text: '' }),
          )
        })
      })
    })

    const doc    = new Document({ sections: [{ properties: {}, children }] })
    const buffer = await Packer.toBlob(doc)
    const url    = URL.createObjectURL(buffer)
    const a      = document.createElement('a')
    a.href       = url
    a.download   = `resumo-${new Date().toISOString().slice(0, 10)}.docx`
    a.click()
    URL.revokeObjectURL(url)
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    sent:    'bg-blue-100 text-blue-700',
    done:    'bg-green-100 text-green-700',
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-800">Conhecimento da Clínica</h1>
          <div className="flex gap-3">
            <button
              onClick={handleExport}
              className="border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm hover:bg-slate-50"
            >
              Exportar semana (.docx)
            </button>
            <button
              onClick={() => setAddModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              + Adicionar manual
            </button>
          </div>
        </div>

        {/* Filtro */}
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Filtrar por especialidade…"
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-60 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Feed de tópicos */}
        <section>
          <h2 className="text-base font-semibold text-slate-700 mb-4">Feed de Tópicos</h2>
          <div className="grid gap-4">
            {topics.map((t) => {
              let subs: string[] = []
              try { subs = JSON.parse(t.subtopics ?? '[]') } catch {}

              return (
                <div key={t.id} className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-slate-800 text-sm leading-snug">{t.topic}</p>
                    <div className="flex gap-2 shrink-0">
                      {t.medicalSpecialty && (
                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs">[{t.medicalSpecialty}]</span>
                      )}
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[t.status]}`}>
                        {t.status}
                      </span>
                    </div>
                  </div>

                  {subs.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {subs.map((s, i) => (
                        <span key={i} className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-xs">{s}</span>
                      ))}
                    </div>
                  )}

                  {t.pubmedQuery && (
                    <p className="text-xs text-slate-400 italic">PubMed: {t.pubmedQuery}</p>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <p className="text-xs text-slate-400">
                      {t.source === 'auto' ? 'Automático' : 'Manual'} {•}{' '}
                      {new Date(t.createdAt).toLocaleDateString('pt-BR')}
                    </p>
                    <div className="flex gap-2">
                      <select
                        value={t.status}
                        onChange={(e) => updateStatus.mutate({ id: t.id, status: e.target.value as 'pending' | 'sent' | 'done' })}
                        className="text-xs border border-slate-200 rounded px-2 py-0.5 focus:outline-none"
                      >
                        <option value="pending">Pendente</option>
                        <option value="sent">Enviado</option>
                        <option value="done">Concluído</option>
                      </select>
                      <button
                        onClick={() => { if (confirm('Deletar tópico?')) deleteTopic.mutate({ id: t.id }) }}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Deletar
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
            {!topics.length && (
              <p className="text-center text-slate-400 py-8">Nenhum tópico encontrado</p>
            )}
          </div>
        </section>

        {/* Chat de evidências */}
        <EvidenceChat clinicId={me?.clinicId} specialty={specialty} />
      </div>

      {addModal && (
        <AddTopicModal
          onClose={() => setAddModal(false)}
          onSuccess={() => { setAddModal(false); utils.knowledgeTopic.list.invalidate() }}
        />
      )}
    </DashboardLayout>
  )
}

function EvidenceChat({ clinicId, specialty }: { clinicId?: string | null; specialty: string }) {
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading]   = useState(false)

  const topicsQuery = trpc.knowledgeTopic.list.useQuery(
    { medicalSpecialty: specialty || undefined },
    { enabled: !!clinicId },
  )

  const handleAsk = async () => {
    if (!question.trim()) return
    const userMsg: ChatMessage = { role: 'user', content: question }
    setMessages((m) => [...m, userMsg])
    setQuestion('')
    setLoading(true)

    try {
      const topicContext = (topicsQuery.data ?? [])
        .slice(0, 20)
        .map((t: Topic) => t.topic)
        .join(', ')

      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method:  'POST',
        headers: {
          'x-api-key':         (import.meta.env.VITE_ANTHROPIC_API_KEY as string) ?? '',
          'anthropic-version': '2023-06-01',
          'content-type':      'application/json',
        },
        body: JSON.stringify({
          model:      'claude-sonnet-4-20250514',
          max_tokens: 600,
          system:     'Você é um especialista em medicina baseada em evidências. Responda citando PMIDs quando disponível.',
          messages: [
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            { role: 'user', content: `Tópicos da clínica: ${topicContext}\n\nPergunta: ${question}` },
          ],
        }),
      })
      const data = await resp.json() as { content: { text: string }[] }
      const answer = data.content?.[0]?.text ?? 'Sem resposta'
      setMessages((m) => [...m, { role: 'assistant', content: answer }])
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'Erro ao consultar IA. Verifique a API Anthropic.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-6">
      <h2 className="text-base font-semibold text-slate-700 mb-4">Chat de Evidências</h2>
      <div className="space-y-3 mb-4 max-h-80 overflow-y-auto">
        {messages.map((m, i) => (
          <div key={i} className={`rounded-lg p-3 text-sm ${m.role === 'user' ? 'bg-blue-50 text-blue-900 ml-8' : 'bg-slate-50 text-slate-800 mr-8'}`}>
            <p className="text-xs font-medium mb-1 text-slate-400">{m.role === 'user' ? 'Você' : 'IA'}</p>
            <p className="whitespace-pre-wrap">{m.content}</p>
          </div>
        ))}
        {!messages.length && <p className="text-slate-400 text-sm text-center py-4">Faça uma pergunta sobre os tópicos da clínica</p>}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
          placeholder="Ex: Qual a conduta para candidemia em UTI?"
          className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleAsk}
          disabled={loading || !question.trim()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? '…' : 'Enviar'}
        </button>
      </div>
    </section>
  )
}

function AddTopicModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [topic, setTopic]             = useState('')
  const [pubmed, setPubmed]           = useState('')
  const [specialty, setSpecialty]     = useState('')
  const [category, setCategory]       = useState('')
  const [error, setError]             = useState('')

  const addMutation = trpc.knowledgeTopic.addManual.useMutation({
    onSuccess,
    onError(err) { setError(err.message) },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    addMutation.mutate({
      topic,
      pubmedQuery:       pubmed || undefined,
      medicalSpecialty:  specialty || undefined,
      specialtyCategory: category || undefined,
    })
  }

  const categories = ['Clínica Médica', 'Cirurgia', 'Pediatria', 'Ginecologia', 'Psiquiatria', 'Emergência', 'Outras']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">Adicionar Tópico Manual</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tema *</label>
            <input value={topic} onChange={(e) => setTopic(e.target.value)} required
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: Candidemia em pacientes imunossuprimidos" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Query PubMed (inglês)</label>
            <input value={pubmed} onChange={(e) => setPubmed(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="candidemia immunocompromised treatment" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Especialidade médica</label>
            <input value={specialty} onChange={(e) => setSpecialty(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Infectologia" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Categoria</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Selecionar…</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-slate-200 text-slate-600 rounded-lg py-2 text-sm hover:bg-slate-50">Cancelar</button>
            <button type="submit" disabled={addMutation.isPending} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {addMutation.isPending ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
