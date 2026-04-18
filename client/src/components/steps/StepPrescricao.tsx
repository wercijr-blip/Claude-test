import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { trpc } from '../../lib/trpc.ts'

const schema = z.object({
  pacienteId: z.number(),
  prescricao: z.object({
    medicamento: z.enum(['tenofovir_emtricitabina', 'outro']),
    nomeMedicamento: z.string().optional(),
    posologia: z.string().min(2, 'Informe a posologia'),
    duracao: z.string().min(2, 'Informe a duração'),
    observacoes: z.string().optional(),
  }),
})

type FormData = z.infer<typeof schema>
interface Props { pacienteId: number | null; onNext: () => void; onBack: () => void }

export default function StepPrescricao({ pacienteId, onNext, onBack }: Props) {
  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { pacienteId: pacienteId ?? 0 },
  })

  const salvar = trpc.paciente.salvarStep5.useMutation({ onSuccess: () => onNext() })
  const medicamento = watch('prescricao.medicamento')

  if (!pacienteId) return null

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-800 mb-5">Prescrição</h2>

      <form onSubmit={handleSubmit((d) => salvar.mutate(d))} className="space-y-4">
        <Field label="Medicamento" error={errors.prescricao?.medicamento?.message}>
          <select {...register('prescricao.medicamento')} className={inputCls(false)}>
            <option value="">Selecione</option>
            <option value="tenofovir_emtricitabina">Tenofovir/Emtricitabina (PrEP padrão)</option>
            <option value="outro">Outro</option>
          </select>
        </Field>

        {medicamento === 'outro' && (
          <Field label="Nome do medicamento" error={undefined}>
            <input {...register('prescricao.nomeMedicamento')} className={inputCls(false)} placeholder="Nome do medicamento alternativo" />
          </Field>
        )}

        <Field label="Posologia" error={errors.prescricao?.posologia?.message}>
          <input {...register('prescricao.posologia')} className={inputCls(!!errors.prescricao?.posologia)} placeholder="Ex: 1 comprimido ao dia" />
        </Field>

        <Field label="Duração do tratamento" error={errors.prescricao?.duracao?.message}>
          <input {...register('prescricao.duracao')} className={inputCls(!!errors.prescricao?.duracao)} placeholder="Ex: 30 dias" />
        </Field>

        <Field label="Observações médicas" error={undefined}>
          <textarea {...register('prescricao.observacoes')} rows={3} className={inputCls(false)} placeholder="Orientações adicionais ao paciente" />
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
