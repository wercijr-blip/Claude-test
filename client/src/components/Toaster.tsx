import * as ToastPrimitive from '@radix-ui/react-toast'
import { useToastDispatch } from '../lib/use-toast.ts'

const variantCls: Record<string, string> = {
  default: 'bg-white border-slate-200 text-slate-900',
  success: 'bg-green-50 border-green-300 text-green-900',
  error: 'bg-red-50 border-red-300 text-red-900',
  warning: 'bg-amber-50 border-amber-300 text-amber-900',
}

export function Toaster() {
  const { toasts, dismiss } = useToastDispatch()

  return (
    <ToastPrimitive.Provider swipeDirection="right">
      {toasts.map((t, idx) => (
        <ToastPrimitive.Root
          key={t.id}
          open
          onOpenChange={(open) => { if (!open) dismiss(t.id) }}
          className={`fixed right-4 z-50 flex w-80 items-start gap-3 rounded-xl border p-4 shadow-lg transition-all ${variantCls[t.variant ?? 'default']}`}
          style={{ bottom: `${idx * 84 + 16}px` }}
        >
          <div className="flex-1">
            <ToastPrimitive.Title className="text-sm font-semibold">{t.title}</ToastPrimitive.Title>
            {t.description && (
              <ToastPrimitive.Description className="mt-0.5 text-xs opacity-80">
                {t.description}
              </ToastPrimitive.Description>
            )}
          </div>
          <ToastPrimitive.Close
            aria-label="Fechar"
            className="text-current opacity-50 hover:opacity-100"
          >
            ×
          </ToastPrimitive.Close>
        </ToastPrimitive.Root>
      ))}
      <ToastPrimitive.Viewport />
    </ToastPrimitive.Provider>
  )
}
