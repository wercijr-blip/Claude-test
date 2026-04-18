import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { trpc } from '../../lib/trpc.ts'

const schema = z.object({
  pacienteId: z.number(),
  conduta: z.object({
    relacoesSexuais: z.object({
      tipos: z.array(z.enum(['vaginal', 'anal_receptivo', 'anal_insertivo', 'oral'])).min(1, 'Selecione ao menos um'),
      frequencia: z.enum(['diaria', 'semanal', 'mensal', 'esporadica']),
      parceirosUltimos6Meses: z.coerce.number().min(0),
      usaPreservativo: z.enum(['sempre', 'quase_sempre', 'as_vezes', 'nunca']),
    }),
    historicoDst: z.boolean(),
    dstDescricao: z.string().optional(),
    prepAnterior: z.boolean(),
    prepPeriodo: z.string().optional(),
    usoDrogas: z.boolean(),
    drogasDescricao: z.string().optional(),
    outrasInformacoes: z.string().optional(),
  }),
})

type FormData = z.infer<typeof schema>

const TIPOS_RELACAO = [
  { value: 'vaginal', label: 'Vaginal' },
  { value: 'anal_receptivo', label: 'Anal receptivo' },
  { value: 'anal_insertivo', label: 'Anal insertivo' },
  { value: 'oral', label: 'Oral' },
]

interface Props { pacienteId: number | null; onNext: () => void; onBack: () => void }

export default function StepConduta({ pacienteId, onNext, onBack }: Props) {
  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      pacienteId: pacienteId ?? 0,
      conduta: { historicoDst: false, prepAnterior: false, usoDrogas: false },
    },
  })

  const salvar = trpc.paciente.salvarStep4.useMutation({ onSuccess: () => onNext() })
  const historicoDst = watch('conduta.historicoDst')
  const prepAnterior = watch('conduta.prepAnterior')
  const usoDrogas = watch('conduta.usoDrogas')

  if (!pacienteId) return null

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-800 mb-2">Conduta</h2>
      <p className="text-sm text-slate-500 mb-5">Informações clínicas confidenciais para avaliação médica.</p>

      <form onSubmit={handleSubmit((d) => salvar.mutate(d))} className="space-y-5">
        {/* Tipos de relação */}
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">Tipos de relação sexual praticadas</p>
          <div className="grid grid-cols-2 gap-2">
            {TIPOS_RELACAO.map((t) => (
              <label key={t.value} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" value={t.value} {...register('conduta.relacoesSexuais.tipos')} className="rounded" />
                {t.label}
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Frequência</label>
            <select {...register('conduta.relacoesSexuais.frequencia')} className={inputCls(false)}>
              <option value="">Selecione</option>
              <option value="diaria">Diária</option>
              <option value="semanal">Semanal</option>
              <option value="mensal">Mensal</option>
              <option value="esporadica">Esporádica</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Parceiros (últimos 6 meses)</label>
            <input type="number" min={0} {...register('conduta.relacoesSexuais.parceirosUltimos6Meses')} className={inputCls(false)} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Uso de preservativo</label>
          <select {...register('conduta.relacoesSexuais.usaPreservativo')} className={inputCls(false)}>
            <option value="">Selecione</option>
            <option value="sempre">Sempre</option>
            <option value="quase_sempre">Quase sempre</option>
            <option value="as_vezes">Às vezes</option>
            <option value="nunca">Nunca</option>
          </select>
        </div>

        <BoolField label="Histórico de DST/IST?" {...register('conduta.historicoDst')}>
          {historicoDst && (
            <textarea {...register('conduta.dstDescricao')} rows={2} className={inputCls(false)} placeholder="Descreva as DSTs anteriores" />
          )}
        </BoolField>

        <BoolField label="Já usou PrEP anteriormente?" {...register('conduta.prepAnterior')}>
          {prepAnterior && (
            <input {...register('conduta.prepPeriodo')} className={inputCls(false)} placeholder="Período de uso" />
          )}
        </BoolField>

        <BoolField label="Faz uso de drogas?" {...register('conduta.usoDrogas')}>
          {usoDrogas && (
            <input {...register('conduta.drogasDescricao')} className={inputCls(false)} placeholder="Quais drogas?" />
          )}
        </BoolField>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Outras informações relevantes</label>
          <textarea {...register('conduta.outrasInformacoes')} rows={3} className={inputCls(false)} placeholder="Informações adicionais para o médico" />
        </div>

        {salvar.error && <p className="text-red-500 text-sm">{salvar.error.message}</p>}

        <div className="flex justify-between pt-2">
          <button type="button" onClick={onBack} className={btnSecondary}>← Anterior</button>
          <button type="submit" disabled={salvar.isPending} className={btnPrimary}>
            {salvar.isPending ? 'Salvando…' : 'Próximo →'}
          </button>
        </div>
      </form>
    </div>
  )
}

function BoolField({ label, children, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; children?: React.ReactNode }) {
  return (
    <div>
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
        <input type="checkbox" {...props} className="rounded" />
        {label}
      </label>
      {children && <div className="mt-2 pl-6">{children}</div>}
    </div>
  )
}

const inputCls = (e: boolean) => `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${e ? 'border-red-400' : 'border-slate-300'}`
const btnPrimary = 'bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 px-6 rounded-lg transition-colors'
const btnSecondary = 'text-slate-600 hover:text-slate-800 font-medium py-2 px-4 rounded-lg transition-colors'
