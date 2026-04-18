import { router } from './_core/trpc.ts'
import { authRouter } from './routes/auth.ts'
import { tokenRouter } from './routes/token.ts'
import { pacienteRouter } from './routes/paciente.ts'
import { medicoRouter } from './routes/medico.ts'
import { adminRouter } from './routes/admin.ts'

export const appRouter = router({
  auth: authRouter,
  token: tokenRouter,
  paciente: pacienteRouter,
  medico: medicoRouter,
  admin: adminRouter,
})

export type AppRouter = typeof appRouter
