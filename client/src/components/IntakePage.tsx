import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { trpc } from '../lib/trpc.ts'
import { PLANOS_VALIDOS, HORARIO_ATENDIMENTO } from '@shared/const.ts'

const ABERTURA = HORARIO_ATENDIMENTO.ABERTURA_HORA
const FECHAMENTO = HORARIO_ATENDIMENTO.FECHAMENTO_HORA

function isDentroHorarioAtendimento(): boolean {
  const agora = new Date()
  const spTime = new Date(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  const hora = spTime.getHours()
  const dia = spTime.getDay()
  return dia >= 1 && dia <= 5 && hora >= ABERTURA && hora < FECHAMENTO
}

const schema = z.object({
  nome: z.string().min(2, 'Nome muito curto'),
  telefone: z.string().min(10, 'Telefone inválido'),
  cpf: z.string().min(11, 'CPF inválido'),
  email: z.string().email('E-mail inválido'),
  plano: z.string().optional(),
})

type FormData = z.infer<typeof schema>

type Etapa = 'escolha' | 'formulario' | 'aguardando' | 'sucesso'
type Tipo = 'particular' | 'plano'

const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
const labelCls = 'block text-sm font-medium text-slate-700 mb-1'
const errCls = 'text-red-500 text-xs mt-1'

export default function IntakePage() {
  const [etapa, setEtapa] = useState<Etapa>('escolha')
  const [tipo, setTipo] = useState<Tipo>('particular')
  const [dentroHorario, setDentroHorario] = useState(isDentroHorarioAtendimento())
  const [precadastroId, setPrecadastroId] = useState<number | null>(null)
  const [carteirinhaKey, setCarteirinhaKey] = useState<string | null>(null)
  const [documentoKey, setDocumentoKey] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  useEffect(() => {
    const interval = setInterval(() => setDentroHorario(isDentroHorarioAtendimento()), 60_000)
    return () => clearInterval(interval)
  }, [])

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const criar = trpc.intake.criar.useMutation()
  const iniciarPagamento = trpc.intake.iniciarPagamento.useMutation({
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url
    },
  })

  function escolher(t: Tipo) {
    setTipo(t)
    setEtapa('formulario')
  }

  async function uploadArquivo(file: File): Promise<string> {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('tipo', 'documento_intake')
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    if (!res.ok) throw new Error('Falha no upload')
    const json = await res.json() as { s3Key: string }
    return json.s3Key
  }

  async function onSubmit(data: FormData) {
    setUploadError(null)

    let cartS3Key = carteirinhaKey
    let docS3Key = documentoKey

    if (tipo === 'plano') {
      if (!cartS3Key || !docS3Key) {
        setUploadError('Envie a carteirinha e o documento de identidade.')
        return
      }
    }

    try {
      const result = await criar.mutateAsync({
        nome: data.nome,
        telefone: data.telefone,
        cpf: data.cpf.replace(/\D/g, ''),
        email: data.email,
        tipo,
        plano: tipo === 'plano' ? data.plano : undefined,
        carteirinhaS3Key: cartS3Key ?? undefined,
        documentoS3Key: docS3Key ?? undefined,
      })

      setPrecadastroId(result.precadastroId)

      if (tipo === 'particular') {
        await iniciarPagamento.mutateAsync({ precadastroId: result.precadastroId })
      } else {
        setEtapa('aguardando')
      }
    } catch (err: unknown) {
      console.error(err)
    }
  }

  if (etapa === 'escolha') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold text-blue-700 mb-2">Facilita PrEP</h1>
            <p className="text-slate-500">Plataforma de saúde digital para prevenção do HIV</p>
          </div>

          <h2 className="text-xl font-semibold text-slate-800 text-center mb-6">Como deseja ser atendido?</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Particular */}
            <button
              onClick={() => escolher('particular')}
              className="bg-white border-2 border-blue-200 hover:border-blue-500 rounded-2xl p-6 text-left transition-all group shadow-sm"
            >
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-800 text-lg mb-1">Particular</h3>
              <p className="text-slate-500 text-sm">Pagamento via PIX, cartão de crédito ou débito. Acesso imediato após confirmação.</p>
            </button>

            {/* Plano de Saúde */}
            <button
              onClick={() => escolher('plano')}
              className="bg-white border-2 border-emerald-200 hover:border-emerald-500 rounded-2xl p-6 text-left transition-all group shadow-sm"
            >
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-emerald-200 transition-colors">
                <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-800 text-lg mb-1">Plano de Saúde</h3>
              <p className="text-slate-500 text-sm">Atendimento coberto pelo convênio. Sujeito a validação pela equipe.</p>
              <p className="text-xs text-amber-600 mt-2 font-medium">Disponível seg–sex, das 08h às 18h</p>
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (etapa === 'aguardando') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Dados enviados!</h2>
          <p className="text-slate-500 text-sm mb-4">
            Seus dados foram recebidos e serão validados pela nossa equipe em breve.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left">
            <p className="text-amber-800 text-sm font-medium mb-1">Próximos passos:</p>
            <ul className="text-amber-700 text-sm space-y-1 list-disc list-inside">
              <li>Nossa secretaria irá verificar seus documentos</li>
              <li>Você receberá um link por e-mail e WhatsApp</li>
              <li>O retorno ocorre em até 1 dia útil</li>
            </ul>
          </div>
        </div>
      </div>
    )
  }

  // etapa === 'formulario'
  const isPlano = tipo === 'plano'
  const foraHorario = isPlano && !dentroHorario
  const errServer = criar.error?.message ?? iniciarPagamento.error?.message ?? null

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-lg mx-auto">
        <button onClick={() => setEtapa('escolha')} className="text-blue-600 text-sm mb-6 flex items-center gap-1">
          ← Voltar
        </button>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-6 ${isPlano ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
            {isPlano ? 'Plano de Saúde' : 'Particular'}
          </div>

          {/* Aviso fora do horário — não bloqueia, apenas informa */}
          {foraHorario && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
              <p className="text-amber-800 text-sm font-medium">⏰ Fora do horário de atendimento</p>
              <p className="text-amber-700 text-sm mt-1">
                O atendimento por plano funciona de <strong>segunda a sexta, das 08h às 18h</strong>.
                Você pode enviar seus dados agora — a validação será realizada no <strong>próximo dia útil</strong> dentro desse horário.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className={labelCls}>Nome completo</label>
              <input {...register('nome')} className={inputCls} placeholder="Seu nome completo" />
              {errors.nome && <p className={errCls}>{errors.nome.message}</p>}
            </div>

            <div>
              <label className={labelCls}>Telefone (WhatsApp)</label>
              <input {...register('telefone')} className={inputCls} placeholder="(11) 99999-9999" />
              {errors.telefone && <p className={errCls}>{errors.telefone.message}</p>}
            </div>

            <div>
              <label className={labelCls}>CPF</label>
              <input {...register('cpf')} className={inputCls} placeholder="000.000.000-00" />
              {errors.cpf && <p className={errCls}>{errors.cpf.message}</p>}
            </div>

            <div>
              <label className={labelCls}>E-mail</label>
              <input {...register('email')} type="email" className={inputCls} placeholder="seu@email.com" />
              {errors.email && <p className={errCls}>{errors.email.message}</p>}
            </div>

            {/* Campos específicos de plano */}
            {isPlano && (
              <>
                <div>
                  <label className={labelCls}>Plano de saúde</label>
                  <select {...register('plano')} className={inputCls}>
                    <option value="">Selecione seu plano</option>
                    {PLANOS_VALIDOS.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-blue-800 text-sm font-medium mb-1">Documentos necessários</p>
                  <p className="text-blue-700 text-sm">Envie sua carteirinha do plano e um documento de identidade (RG ou CNH).</p>
                </div>

                <div>
                  <label className={labelCls}>Carteirinha do plano</label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      try {
                        const key = await uploadArquivo(file)
                        setCarteirinhaKey(key)
                      } catch {
                        setUploadError('Erro ao enviar carteirinha. Tente novamente.')
                      }
                    }}
                  />
                  {carteirinhaKey && <p className="text-emerald-600 text-xs mt-1">Carteirinha enviada</p>}
                </div>

                <div>
                  <label className={labelCls}>Documento de identidade (RG ou CNH)</label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      try {
                        const key = await uploadArquivo(file)
                        setDocumentoKey(key)
                      } catch {
                        setUploadError('Erro ao enviar documento. Tente novamente.')
                      }
                    }}
                  />
                  {documentoKey && <p className="text-emerald-600 text-xs mt-1">Documento enviado</p>}
                </div>
              </>
            )}

            {uploadError && <p className="text-red-500 text-sm">{uploadError}</p>}
            {errServer && <p className="text-red-500 text-sm">{errServer}</p>}

            {isPlano ? (
              <button
                type="submit"
                disabled={foraHorario || criar.isPending}
                className="w-full bg-emerald-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50 hover:bg-emerald-700 transition-colors"
              >
                {criar.isPending ? 'Enviando…' : 'Enviar para validação'}
              </button>
            ) : (
              <button
                type="submit"
                disabled={criar.isPending || iniciarPagamento.isPending}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50 hover:bg-blue-700 transition-colors"
              >
                {criar.isPending || iniciarPagamento.isPending ? 'Aguarde…' : 'Ir para o pagamento →'}
              </button>
            )}

            {!isPlano && (
              <p className="text-center text-xs text-slate-400">
                Aceito: PIX · Cartão de crédito · Cartão de débito
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
