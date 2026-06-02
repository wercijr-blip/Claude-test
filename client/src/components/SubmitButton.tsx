interface Props {
  isPending: boolean
  label?: string
  pendingLabel?: string
  className?: string
}

const defaultCls = 'bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 px-6 rounded-lg transition-colors'

export function SubmitButton({ isPending, label = 'Próximo →', pendingLabel = 'Salvando…', className = defaultCls }: Props) {
  return (
    <button type="submit" disabled={isPending} className={className}>
      {isPending ? pendingLabel : label}
    </button>
  )
}
