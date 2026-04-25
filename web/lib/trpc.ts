import { createTRPCReact } from '@trpc/react-query'
import { httpBatchLink } from '@trpc/client'
import type { AppRouter } from '../../server/routers'

export const trpc = createTRPCReact<AppRouter>()

export function createTrpcClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: '/trpc',
      }),
    ],
  })
}
