import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { trpc } from '../../lib/trpc.ts'

const schema = z.object({
  pacienteId: z.number(),
  conduta: z.object({
    temSintomasDst: z.boolean(),
    usoDrogas: z.boolean(),
    // 'prepAdesao' é obrigatório só quando tipoConsulta === 'ja_faco_prep'.
    // A validação cruzada acontece no submit (depende de prop externa).
    prepAdesao: z.enum(['diaria', 'sob_demanda']).optional(),
    outrasInformacoes: z.string().optional(),
  }),
})

type FormData = z.infer<typeof schema>

interface Props {
  pacienteId: number | null
  onNext: () => void
  onBack: () => void
  examData?: { dataExame?: string | null; resultadoHiv?: string | null }
  tipoConsulta?: 'primeiro_atendimento' | 'ja_faco_prep' | null
}

export default function StepConduta({ pacienteId, onNext, onBack, examData, tipoConsulta }: Props) {
  const isJaFazPrep = tipoConsulta === 'ja_faco_prep'

  const { register, handleSubmit, watch, setError, clearErrors, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      pacienteId: pacienteId ?? 0,
      conduta: { temSintomasDst: false, usoDrogas: false },
    },
  })

  const salvar = trpc.paciente.salvarStep4.useMutation({ onSuccess: () => onNext() })

  const onSubmit = (d: FormData) => {
    // Validação cruzada: prepAdesao obrigatório se já faz PrEP
    if (isJaFazPrep && !d.conduta.prepAdesao) {
      setError('conduta.prepAdesao', { message: 'Selecione como tem tomado a PrEP.' })
      return
    }
    clearErrors('conduta.prepAdesao')
    salvar.mutate(d)
  }

  if (!pacienteId) return null

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-800 mb-2">Conduta</h2>
      <p className="text-sm text-slate-500 mb-4">Informações clínicas confidenciais para avaliação médica.</p>

      {(examData?.dataExame || examData?.resultadoHiv) && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-5">
          <p className="text-blue-800 text-xs font-semibold mb-1">Resultado do exame Anti-HIV (validado)</p>
          {examData.dataExame && (
            <p className="text-blue-700 text-xs">Data do exame: <strong>{examData.dataExame}</strong></p>
          )}
          {examData.resultadoHiv && (
            <p className="text-blue-700 text-xs">Resultado: <strong>{examData.resultadoHiv === 'nao_reagente' ? 'Não reagente' : 'Reagente'}</strong></p>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <BoolGroup
          label="Tem sintomas de DST/IST?"
          value={watch('conduta.temSintomasDst')}
          register={register('conduta.temSintomasDst', { setValueAs: (v) => v === 'true' || v === true })}
        />

        <BoolGroup
          label="Faz uso de drogas?"
          value={watch('conduta.usoDrogas')}
          register={register('conduta.usoDrogas', { setValueAs: (v) => v === 'true' || v === true })}
        />

        {isJaFazPrep && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Como tem tomado a PrEP?</label>
            <select
              {...register('conduta.prepAdesao')}
              className={inputCls(!!errors.conduta?.prepAdesao)}
            >
              <option value="">Selecione</option>
              <option value="diaria">Diária (1 comprimido por dia)</option>
              <option value="sob_demanda">Sob demanda (antes/depois da exposição)</option>
            </select>
            {errors.conduta?.prepAdesao && (
              <p className="mt-1 text-xs text-red-500">{errors.conduta.prepAdesao.message}</p>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Outras informações relevantes</label>
          <textarea
            {...register('conduta.outrasInformacoes')}
            rows={3}
            className={inputCls(false)}
            placeholder="Informações adicionais para o médico"
          />
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

function BoolGroup({ label, value, register }: { label: string; value: boolean | undefined; register: ReturnType<ReturnType<typeof useForm>['register']> }) {
  return (
    <div>
      <p className="text-sm font-medium text-slate-700 mb-2">{label}</p>
      <div className="flex gap-3">
        {([['false', 'Não'], ['true', 'Sim']] as const).map(([v, l]) => {
          const checked = value === (v === 'true')
          return (
            <label
              key={v}
              className={`flex-1 flex items-center justify-center gap-2 border rounded-lg py-2.5 px-4 cursor-pointer text-sm font-medium transition-colors ${checked ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
            >
              <input type="radio" value={v} {...register} className="sr-only" />
              {l}
            </label>
          )
        })}
      </div>
    </div>
  )
}

const inputCls = (e: boolean) => `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${e ? 'border-red-400' : 'border-slate-300'}`
const btnPrimary = 'bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 px-6 rounded-lg transition-colors'
const btnSecondary = 'text-slate-600 hover:text-slate-800 font-medium py-2 px-4 rounded-lg transition-colors'
