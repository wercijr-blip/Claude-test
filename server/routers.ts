import { router } from './_core/trpc.ts'
import { authRouter } from './routes/auth.ts'
import { scribaRouter } from './routes/scriba.ts'

export const appRouter = router({
  auth: authRouter,
  scriba: scribaRouter,
})

export type AppRouter = typeof appRouter
