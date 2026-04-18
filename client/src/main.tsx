import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { trpc, createTrpcClient } from './lib/trpc.ts'
import { useAuth } from './_core/hooks/useAuth.ts'
import App from './App.tsx'
import './index.css'

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
    <Root />
  </StrictMode>,
)
