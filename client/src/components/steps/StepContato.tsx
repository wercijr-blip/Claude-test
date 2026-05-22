import { useState, useRef } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { trpc } from '../../lib/trpc.ts'
import { useFormDraft } from '../../hooks/useFormDraft.ts'
import { traduzirErroTrpc } from '../../lib/errorMessages.ts'
import { SubmitButton } from '../SubmitButton.tsx'
import { PhoneInput } from '../PhoneInput.tsx'
import { ESTADOS_BR } from '@shared/const.ts'

const schema = z.object({
  pacienteId: z.number(),
  email: z.string().email('E-mail inválido'),
  telefone: z.string().regex(/^\+\d{8,15}$/, 'Use formato internacional: +5561999998888'),
  cep: z.string().regex(/^\d{8}$/, 'CEP deve ter 8 dígitos'),
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
  const [cepLoading, setCepLoading] = useState(false)
  const [cepErro, setCepErro] = useState<string | null>(null)
  const cepCache = useRef<Record<string, { logradouro?: string; bairro?: string; localidade?: string; uf?: string }>>({})
  const cepAbortRef = useRef<AbortController | null>(null)

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      pacienteId: pacienteId ?? 0,
      email: defaultValues?.email ?? '',
      telefone: defaultValues?.telefone ?? '',
    },
  })
  const { register, handleSubmit, setValue, formState: { errors } } = form
  const { clearDraft } = useFormDraft(form, 'step-contato-draft')

  const salvar = trpc.paciente.salvarStep3.useMutation({ onSuccess: () => { clearDraft(); onNext() } })

  const buscarCep = async (digits: string) => {
    if (digits.length !== 8) return
    setCepErro(null)

    const cached = cepCache.current[digits]
    if (cached) {
      if (cached.logradouro) setValue('logradouro', cached.logradouro, { shouldValidate: true })
      if (cached.bairro) setValue('bairro', cached.bairro, { shouldValidate: true })
      if (cached.localidade) setValue('cidade', cached.localidade, { shouldValidate: true })
      if (cached.uf) setValue('estado', cached.uf, { shouldValidate: true })
      return
    }

    cepAbortRef.current?.abort()
    const controller = new AbortController()
    cepAbortRef.current = controller
    const timeoutId = setTimeout(() => controller.abort(), 5_000)

    setCepLoading(true)
    try {
      const r = await fetch(`https://viacep.com.br/ws/${digits}/json/`, { signal: controller.signal })
      const d = await r.json() as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string }
      if (d.erro) {
        setCepErro('CEP não encontrado.')
        return
      }
      cepCache.current[digits] = d
      if (d.logradouro) setValue('logradouro', d.logradouro, { shouldValidate: true })
      if (d.bairro) setValue('bairro', d.bairro, { shouldValidate: true })
      if (d.localidade) setValue('cidade', d.localidade, { shouldValidate: true })
      if (d.uf) setValue('estado', d.uf, { shouldValidate: true })
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setCepErro('Não foi possível consultar o CEP. Preencha manualmente.')
      }
    } finally {
      clearTimeout(timeoutId)
      setCepLoading(false)
    }
  }

  if (!pacienteId) return null

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-800 mb-5">Contato</h2>

      <form onSubmit={handleSubmit((d) => salvar.mutate(d))} className="space-y-4">
        {/* E-mail e telefone — se vieram do cadastro, mostra como leitura */}
        {hasIntakeEmail ? (
          <Field label="E-mail">
            <ReadonlyValue value={defaultValues!.email!} />
            <input type="hidden" {...register('email')} />
            <p className="mt-1 text-xs text-slate-400">Preenchido automaticamente do cadastro · não editável</p>
          </Field>
        ) : (
          <Field label="E-mail" error={errors.email?.message} name="email">
            <input
              id="email"
              {...register('email')}
              type="email"
              className={inputCls(!!errors.email)}
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? 'email-err' : undefined}
              placeholder="seu@email.com"
            />
          </Field>
        )}

        {hasIntakeTelefone ? (
          <Field label="Telefone celular">
            <ReadonlyValue value={defaultValues!.telefone!} />
            <input type="hidden" {...register('telefone')} />
            <p className="mt-1 text-xs text-slate-400">Preenchido automaticamente do cadastro · não editável</p>
          </Field>
        ) : (
          <Field label="Telefone celular (WhatsApp)" error={errors.telefone?.message} name="telefone">
            <Controller
              name="telefone"
              control={form.control}
              render={({ field }) => (
                <PhoneInput
                  value={field.value}
                  onChange={field.onChange}
                  hasError={!!errors.telefone}
                  required
                />
              )}
            />
          </Field>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field label="CEP" error={errors.cep?.message ?? cepErro ?? undefined} name="cep">
            <div className="relative">
              <input
                id="cep"
                {...register('cep', {
                  onChange: (e) => {
                    const digits = (e.target.value as string).replace(/\D/g, '').slice(0, 8)
                    e.target.value = digits
                    setValue('cep', digits)
                    if (digits.length === 8) buscarCep(digits)
                  },
                })}
                className={inputCls(!!errors.cep || !!cepErro)}
                aria-invalid={errors.cep || cepErro ? true : undefined}
                aria-describedby={errors.cep || cepErro ? 'cep-err' : undefined}
                placeholder="00000000"
                inputMode="numeric"
                maxLength={8}
              />
              {cepLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
                </div>
              )}
            </div>
          </Field>
          <Field label="Estado" error={errors.estado?.message} name="estado">
            <select id="estado" {...register('estado')} className={inputCls(!!errors.estado)} aria-invalid={errors.estado ? true : undefined} aria-describedby={errors.estado ? 'estado-err' : undefined}>
              <option value="">UF</option>
              {ESTADOS_BR.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Logradouro" error={errors.logradouro?.message} name="logradouro">
          <input id="logradouro" {...register('logradouro')} className={inputCls(!!errors.logradouro)} aria-invalid={errors.logradouro ? true : undefined} aria-describedby={errors.logradouro ? 'logradouro-err' : undefined} placeholder="Rua, Av, etc." />
        </Field>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Número" error={errors.numero?.message} name="numero">
            <input id="numero" {...register('numero')} className={inputCls(!!errors.numero)} aria-invalid={errors.numero ? true : undefined} aria-describedby={errors.numero ? 'numero-err' : undefined} />
          </Field>
          <div className="col-span-2">
            <Field label="Complemento" error={undefined}>
              <input {...register('complemento')} className={inputCls(false)} placeholder="Apto, Bloco…" />
            </Field>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Bairro" error={errors.bairro?.message} name="bairro">
            <input id="bairro" {...register('bairro')} className={inputCls(!!errors.bairro)} aria-invalid={errors.bairro ? true : undefined} aria-describedby={errors.bairro ? 'bairro-err' : undefined} />
          </Field>
          <Field label="Cidade" error={errors.cidade?.message} name="cidade">
            <input id="cidade" {...register('cidade')} className={inputCls(!!errors.cidade)} aria-invalid={errors.cidade ? true : undefined} aria-describedby={errors.cidade ? 'cidade-err' : undefined} />
          </Field>
        </div>

        {salvar.error && <p role="alert" className="text-red-500 text-sm">{traduzirErroTrpc(salvar.error)}</p>}

        <div className="flex justify-between pt-2">
          <button type="button" onClick={onBack} className={btnSecondary}>← Anterior</button>
          <SubmitButton isPending={salvar.isPending} />
        </div>
      </form>
    </div>
  )
}

function Field({ label, error, children, name }: { label: string; error?: string; children: React.ReactNode; name?: string }) {
  const errorId = name && error ? `${name}-err` : undefined
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {children}
      {error && <p id={errorId} role="alert" className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

function ReadonlyValue({ value }: { value: string }) {
  return (
    <div className="w-full border border-slate-200 bg-slate-50 text-slate-700 rounded-lg px-3 py-2 text-sm">
      {value}
    </div>
  )
}

const inputCls = (e: boolean) => `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${e ? 'border-red-400' : 'border-slate-300'}`
const btnSecondary = 'text-slate-600 hover:text-slate-800 font-medium py-2 px-4 rounded-lg transition-colors'
