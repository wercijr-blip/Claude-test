interface Props {
  message: string
  icon?: React.ReactNode
  className?: string
}

export function EmptyState({ message, icon, className = '' }: Props) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 text-center text-slate-400 ${className}`}>
      {icon && <div className="mb-3 opacity-40">{icon}</div>}
      <p className="text-sm">{message}</p>
    </div>
  )
}
