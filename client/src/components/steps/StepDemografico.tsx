import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { trpc } from '../../lib/trpc.ts'
import { COR_RACA_OPTIONS, ESCOLARIDADE_OPTIONS } from '@shared/const.ts'

const schema = z.object({
  pacienteId: z.number(),
  corRaca: z.string().min(1, 'Selecione uma opção'),
  escolaridade: z.string().min(1, 'Selecione uma opção'),
  situacaoConjugal: z.string().optional(),
  rendaFamiliar: z.string().optional(),
  ocupacao: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface Props { pacienteId: number | null; onNext: () => void; onBack: () => void }

export default function StepDemografico({ pacienteId, onNext, onBack }: Props) {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { pacienteId: pacienteId ?? 0 },
  })

  const salvar = trpc.paciente.salvarStep2.useMutation({ onSuccess: () => onNext() })

  if (!pacienteId) return null

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-800 mb-5">Dados Demográficos</h2>

      <form onSubmit={handleSubmit((d) => salvar.mutate(d))} className="space-y-4">
        <Field label="Cor/Raça" error={errors.corRaca?.message}>
          <select {...register('corRaca')} className={inputCls(!!errors.corRaca)}>
            <option value="">Selecione</option>
            {COR_RACA_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>

        <Field label="Escolaridade" error={errors.escolaridade?.message}>
          <select {...register('escolaridade')} className={inputCls(!!errors.escolaridade)}>
            <option value="">Selecione</option>
            {ESCOLARIDADE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>

        <Field label="Situação conjugal" error={errors.situacaoConjugal?.message}>
          <select {...register('situacaoConjugal')} className={inputCls(false)}>
            <option value="">Selecione (opcional)</option>
            <option value="solteiro">Solteiro(a)</option>
            <option value="casado">Casado(a) / União estável</option>
            <option value="separado">Separado(a) / Divorciado(a)</option>
            <option value="viuvo">Viúvo(a)</option>
          </select>
        </Field>

        <Field label="Renda familiar" error={undefined}>
          <select {...register('rendaFamiliar')} className={inputCls(false)}>
            <option value="">Selecione (opcional)</option>
            <option value="ate_1sm">Até 1 salário mínimo</option>
            <option value="1_3sm">1 a 3 salários mínimos</option>
            <option value="3_5sm">3 a 5 salários mínimos</option>
            <option value="acima_5sm">Acima de 5 salários mínimos</option>
          </select>
        </Field>

        <Field label="Ocupação" error={undefined}>
          <input {...register('ocupacao')} className={inputCls(false)} placeholder="Sua profissão ou ocupação atual" />
        </Field>

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

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

const inputCls = (e: boolean) => `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${e ? 'border-red-400' : 'border-slate-300'}`
const btnPrimary = 'bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 px-6 rounded-lg transition-colors'
const btnSecondary = 'text-slate-600 hover:text-slate-800 font-medium py-2 px-4 rounded-lg transition-colors'
