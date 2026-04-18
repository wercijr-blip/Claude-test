import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { trpc } from '../../lib/trpc.ts'

const autorizadoSchema = z.object({ nome: z.string().min(2), parentesco: z.string().min(2), telefone: z.string().optional() })

const schema = z.object({
  pacienteId: z.number(),
  autorizados: z.array(autorizadoSchema),
})

type FormData = z.infer<typeof schema>
interface Props { pacienteId: number | null; onNext: () => void; onBack: () => void }

export default function StepAutorizados({ pacienteId, onNext, onBack }: Props) {
  const { register, handleSubmit, control, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { pacienteId: pacienteId ?? 0, autorizados: [] },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'autorizados' })
  const salvar = trpc.paciente.salvarStep7.useMutation({ onSuccess: () => onNext() })

  if (!pacienteId) return null

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-800 mb-1">Pessoas Autorizadas</h2>
      <p className="text-sm text-slate-500 mb-5">Pessoas autorizadas a receber informações sobre seu tratamento (opcional).</p>

      <form onSubmit={handleSubmit((d) => salvar.mutate(d))} className="space-y-4">
        {fields.map((field, i) => (
          <div key={field.id} className="border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-slate-700">Autorizado {i + 1}</span>
              <button type="button" onClick={() => remove(i)} className="text-red-400 hover:text-red-600 text-sm">Remover</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Nome</label>
                <input {...register(`autorizados.${i}.nome`)} className={inputCls(false)} />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Parentesco</label>
                <input {...register(`autorizados.${i}.parentesco`)} className={inputCls(false)} placeholder="Cônjuge, filho(a)…" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Telefone (opcional)</label>
              <input {...register(`autorizados.${i}.telefone`)} className={inputCls(false)} placeholder="(00) 00000-0000" />
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() => append({ nome: '', parentesco: '', telefone: '' })}
          className="w-full border-2 border-dashed border-slate-300 hover:border-blue-400 text-slate-500 hover:text-blue-600 rounded-xl py-3 text-sm font-medium transition-colors"
        >
          + Adicionar pessoa autorizada
        </button>

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

const inputCls = (e: boolean) => `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${e ? 'border-red-400' : 'border-slate-300'}`
const btnPrimary = 'bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 px-6 rounded-lg transition-colors'
const btnSecondary = 'text-slate-600 hover:text-slate-800 font-medium py-2 px-4 rounded-lg transition-colors'
