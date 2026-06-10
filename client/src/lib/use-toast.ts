import { useState, useCallback } from "react";

export type ToastVariant = "default" | "success" | "error" | "warning";

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
}

type ToastInput = Omit<Toast, "id">;

let externalDispatch: ((toast: Toast) => void) | null = null;

export function useToastDispatch() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dispatch = useCallback((toast: Toast) => {
    setToasts((prev) => [...prev, toast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toast.id));
    }, 4000);
  }, []);

  externalDispatch = dispatch;

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, dismiss };
}

export function toast(input: ToastInput) {
  const id = Math.random().toString(36).slice(2);
  externalDispatch?.({ id, ...input });
}
