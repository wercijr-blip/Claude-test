import { useEffect } from 'react'
import type { UseFormReturn, FieldValues } from 'react-hook-form'

interface UseFormDraftOptions {
  omitFields?: string[]
}

export function useFormDraft<T extends FieldValues>(
  form: UseFormReturn<T>,
  key: string,
  { omitFields = [] }: UseFormDraftOptions = {},
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
      if (omitFields.length > 0) {
        const safe = { ...values }
        for (const field of omitFields) delete safe[field]
        sessionStorage.setItem(key, JSON.stringify(safe))
      } else {
        sessionStorage.setItem(key, JSON.stringify(values))
      }
    })
    return () => sub.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, key])

  return {
    clearDraft: () => sessionStorage.removeItem(key),
  }
}
