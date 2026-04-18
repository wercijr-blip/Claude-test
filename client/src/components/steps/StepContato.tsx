import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { trpc } from '../../lib/trpc.ts'
import { ESTADOS_BR } from '@shared/const.ts'

const TIPOS_TELEFONE = [
  { value: 'celular_whatsapp', label: 'Celular / WhatsApp' },
  { value: 'fixo', label: 'Fixo' },
  { value: 'comercial', label: 'Comercial' },
] as const

const schema = z.object({
  pacienteId: z.number(),
  email: z.string().email('E-mail inválido'),
  tipoTelefone: z.string().optional(),
  telefone: z.string().min(10, 'Telefone inválido'),
  cep: z.string().length(8, 'CEP deve ter 8 dígitos'),
  logradouro: z.string().min(2),
  numero: z.string().min(1),
  complemento: z.string().optional(),
  bairro: z.string().min(2),
  cidade: z.string().min(2),
  estado: z.string().length(2),
})

type FormData = z.infer<typeof schema>

interface Props {
  pacienteId: number | null
  onNext: () => void
  onBack: () => void
  defaultValues?: { email?: string; telefone?: string }
}

export default function StepContato({ pacienteId, onNext, onBack, defaultValues }: Props) {
  const hasIntakeEmail = !!defaultValues?.email
  const hasIntakeTelefone = !!defaultValues?.telefone

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      pacienteId: pacienteId ?? 0,
      email: defaultValues?.email ?? '',
      tipoTelefone: 'celular_whatsapp',
      telefone: defaultValues?.telefone ?? '',
    },
  })

  const salvar = trpc.paciente.salvarStep3.useMutation({ onSuccess: () => onNext() })

  const buscarCep = async (cep: string) => {
    const digits = cep.replace(/\D/g, '')
    if (digits.length !== 8) return
    try {
      const r = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      const d = await r.json() as { logradouro?: string; bairro?: string; localidade?: string; uf?: string }
      if (d.logradouro) setValue('logradouro', d.logradouro)
      if (d.bairro) setValue('bairro', d.bairro)
      if (d.localidade) setValue('cidade', d.localidade)
      if (d.uf) setValue('estado', d.uf)
    } catch { /* silencioso */ }
  }

  if (!pacienteId) return null

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-800 mb-5">Contato</h2>

      <form onSubmit={handleSubmit((d) => salvar.mutate(d))} className="space-y-4">
        <Field label="E-mail" error={errors.email?.message}>
          <input
            {...register('email')}
            type="email"
            className={inputCls(!!errors.email)}
            placeholder="seu@email.com"
            readOnly={hasIntakeEmail}
            style={hasIntakeEmail ? { background: '#f8fafc', color: '#64748b' } : undefined}
          />
          {hasIntakeEmail && <p className="mt-0.5 text-xs text-slate-400">Preenchido automaticamente do cadastro</p>}
        </Field>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label>
          <div className="flex gap-2">
            <select
              {...register('tipoTelefone')}
              className={`${inputCls(false)} w-44 shrink-0`}
              disabled={hasIntakeTelefone}
              style={hasIntakeTelefone ? { background: '#f8fafc', color: '#64748b' } : undefined}
            >
              {TIPOS_TELEFONE.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <input
              {...register('telefone')}
              className={`${inputCls(!!errors.telefone)} flex-1`}
              placeholder="(00) 00000-0000"
              maxLength={15}
              readOnly={hasIntakeTelefone}
              style={hasIntakeTelefone ? { background: '#f8fafc', color: '#64748b' } : undefined}
            />
          </div>
          {errors.telefone && <p className="mt-1 text-xs text-red-500">{errors.telefone.message}</p>}
          {hasIntakeTelefone && <p className="mt-0.5 text-xs text-slate-400">Preenchido automaticamente do cadastro</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="CEP" error={errors.cep?.message}>
            <input
              {...register('cep')}
              className={inputCls(!!errors.cep)}
              placeholder="00000-000"
              maxLength={9}
              onBlur={(e) => buscarCep(e.target.value)}
            />
          </Field>
          <Field label="Estado" error={errors.estado?.message}>
            <select {...register('estado')} className={inputCls(!!errors.estado)}>
              <option value="">UF</option>
              {ESTADOS_BR.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Logradouro" error={errors.logradouro?.message}>
          <input {...register('logradouro')} className={inputCls(!!errors.logradouro)} placeholder="Rua, Av, etc." />
        </Field>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Número" error={errors.numero?.message}>
            <input {...register('numero')} className={inputCls(!!errors.numero)} />
          </Field>
          <div className="col-span-2">
            <Field label="Complemento" error={undefined}>
              <input {...register('complemento')} className={inputCls(false)} placeholder="Apto, Bloco…" />
            </Field>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Bairro" error={errors.bairro?.message}>
            <input {...register('bairro')} className={inputCls(!!errors.bairro)} />
          </Field>
          <Field label="Cidade" error={errors.cidade?.message}>
            <input {...register('cidade')} className={inputCls(!!errors.cidade)} />
          </Field>
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
