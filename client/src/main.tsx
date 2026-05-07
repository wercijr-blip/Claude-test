import * as Sentry from '@sentry/react'
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { trpc, createTrpcClient } from './lib/trpc.ts'
import { useAuth } from './_core/hooks/useAuth.ts'
import App from './App.tsx'
import './index.css'

const _sentryDsn = import.meta.env.VITE_SENTRY_DSN as string | undefined
const _sentryRelease = (import.meta.env.VITE_RELEASE as string | undefined)
  ?? (import.meta.env.VITE_GIT_SHA as string | undefined)
  ?? 'unknown'

console.info('[Sentry] init check', {
  hasDsn: !!_sentryDsn,
  dsnPrefix: _sentryDsn ? _sentryDsn.slice(0, 30) : null,
  environment: import.meta.env.MODE,
  release: _sentryRelease,
})

if (_sentryDsn) {
  Sentry.init({
    dsn: _sentryDsn,
    environment: import.meta.env.MODE,
    release: _sentryRelease,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        // LGPD — mask all patient text and block media in session replays
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    sendDefaultPii: false,
    debug: !import.meta.env.PROD,
  })
  console.info('[Sentry] initialized successfully')
} else {
  console.warn('[Sentry] VITE_SENTRY_DSN não definida — error reporting desabilitado')
}

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
