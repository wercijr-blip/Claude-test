import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { trpc } from '../../lib/trpc.ts'

const schema = z.object({
  pacienteId: z.number(),
  tipoAtendimento: z.enum(['particular', 'convenio', 'sus']),
  convenio: z.string().optional(),
  numeroConvenio: z.string().optional(),
})

type FormData = z.infer<typeof schema>
interface Props {
  pacienteId: number | null
  onNext: () => void
  onBack: () => void
  defaultValues?: { tipoAtendimento?: 'particular' | 'convenio' | 'sus'; convenio?: string }
}

export default function StepServico({ pacienteId, onNext, onBack, defaultValues }: Props) {
  const hasIntake = !!defaultValues?.tipoAtendimento

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      pacienteId: pacienteId ?? 0,
      tipoAtendimento: defaultValues?.tipoAtendimento,
      convenio: defaultValues?.convenio,
    },
  })

  const salvar = trpc.paciente.salvarStep6.useMutation({ onSuccess: () => onNext() })
  const tipo = watch('tipoAtendimento')

  if (!pacienteId) return null

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-800 mb-5">Serviço</h2>

      <form onSubmit={handleSubmit((d) => salvar.mutate(d))} className="space-y-4">
        {/* Tipo de atendimento — vem do cadastro (intake), oculto se já preenchido */}
        {hasIntake
          ? <input type="hidden" {...register('tipoAtendimento')} />
          : (
            <Field label="Origem do atendimento" error={errors.tipoAtendimento?.message}>
              <div className="grid grid-cols-3 gap-3">
                {([['particular', 'Privado'], ['convenio', 'Convênio'], ['sus', 'SUS']] as const).map(([v, l]) => (
                  <label key={v} className={`flex items-center justify-center gap-2 border rounded-lg py-3 px-4 cursor-pointer text-sm font-medium transition-colors ${tipo === v ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                    <input type="radio" value={v} {...register('tipoAtendimento')} className="sr-only" />
                    {l}
                  </label>
                ))}
              </div>
            </Field>
          )}

        {tipo === 'convenio' && (
          <>
            {hasIntake && defaultValues?.convenio
              ? <input type="hidden" {...register('convenio')} />
              : (
                <Field label="Nome do convênio" error={undefined}>
                  <input
                    {...register('convenio')}
                    className={inputCls(false)}
                    placeholder="Ex: Unimed, Bradesco Saúde"
                  />
                </Field>
              )}
            <Field label="Número da carteirinha" error={undefined}>
              <input {...register('numeroConvenio')} className={inputCls(false)} />
            </Field>
          </>
        )}

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
