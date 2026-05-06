import * as Sentry from '@sentry/react'
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { trpc, createTrpcClient } from './lib/trpc.ts'
import { useAuth } from './_core/hooks/useAuth.ts'
import App from './App.tsx'
import './index.css'

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN
    ?? 'https://f4f68f71e452d5211be7c6861c0a0a00@o4511343385444352.ingest.us.sentry.io/4511343524118528',
  environment: import.meta.env.MODE,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      // LGPD — mask all patient text and block media in session replays
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  tracesSampleRate: import.meta.env.DEV ? 0 : 0.05,
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 0.5,
  sendDefaultPii: false,
})

function Root() {
  const { getToken } = useAuth()
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
  }))
  const [trpcClient] = useState(() => createTrpcClient(getToken))

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </trpc.Provider>
  )
}

const root = document.getElementById('root')!
createRoot(root).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<p>Erro inesperado. Recarregue a página.</p>}>
      <Root />
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
