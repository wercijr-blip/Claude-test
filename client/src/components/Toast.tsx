import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import * as RadixToast from "@radix-ui/react-toast";

type ToastVariant = "success" | "error" | "info";

interface ToastMessage {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastCtx {
  toast: (message: string, variant?: ToastVariant) => void;
}

const ICONS: Record<ToastVariant, string> = {
  success: "✓",
  error: "✕",
  info: "·",
};

const STYLES: Record<ToastVariant, string> = {
  success: "bg-emerald-600 text-white",
  error:   "bg-red-600 text-white",
  info:    "bg-stone-800 text-white",
};

const ToastContext = createContext<ToastCtx>({ toast: () => undefined });

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const toast = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      const id = ++nextId;
      setToasts((prev) => [...prev, { id, message, variant }]);
    },
    [],
  );

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      <RadixToast.Provider swipeDirection="right">
        {children}
        {toasts.map((t) => (
          <RadixToast.Root
            key={t.id}
            duration={4000}
            onOpenChange={(open) => {
              if (!open) remove(t.id);
            }}
            className={[
              "rounded-2xl px-4 py-3 shadow-lg text-sm font-medium",
              "flex items-center gap-2.5",
              "data-[state=open]:animate-in data-[state=closed]:animate-out",
              "data-[swipe=end]:animate-out data-[state=closed]:fade-out-80",
              "data-[state=open]:slide-in-from-bottom-2",
              STYLES[t.variant],
            ].join(" ")}
          >
            <span className="text-base font-bold opacity-80 shrink-0">
              {ICONS[t.variant]}
            </span>
            <RadixToast.Description className="leading-snug">
              {t.message}
            </RadixToast.Description>
          </RadixToast.Root>
        ))}
        <RadixToast.Viewport className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 w-80" />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
