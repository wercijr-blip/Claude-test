import { useEffect } from 'react'
import type { UseFormReturn, FieldValues } from 'react-hook-form'

export function useFormDraft<T extends FieldValues>(
  form: UseFormReturn<T>,
  key: string,
) {
  useEffect(() => {
    const saved = sessionStorage.getItem(key)
    if (saved) {
      try {
        form.reset(JSON.parse(saved) as T)
      } catch {
        sessionStorage.removeItem(key)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    const sub = form.watch((values) => {
      sessionStorage.setItem(key, JSON.stringify(values))
    })
    return () => sub.unsubscribe()
  }, [form, key])

  return {
    clearDraft: () => sessionStorage.removeItem(key),
  }
}
