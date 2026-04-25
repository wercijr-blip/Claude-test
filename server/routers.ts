import { router } from './_core/trpc.ts'
import { authRouter } from './routes/auth.ts'
import { tokenRouter } from './routes/token.ts'
import { pacienteRouter } from './routes/paciente.ts'
import { medicoRouter } from './routes/medico.ts'
import { adminRouter } from './routes/admin.ts'
import { secretariaRouter } from './routes/secretaria.ts'
import { intakeRouter } from './routes/intake.ts'
import { consultaRouter } from './routes/consulta.ts'
import { pesquisaRouter } from './routes/pesquisa.ts'
import { configRouter } from './routes/config.ts'

export const appRouter = router({
  auth: authRouter,
  token: tokenRouter,
  paciente: pacienteRouter,
  medico: medicoRouter,
  admin: adminRouter,
  secretaria: secretariaRouter,
  intake: intakeRouter,
  consulta: consultaRouter,
  pesquisa: pesquisaRouter,
  config: configRouter,
})

export type AppRouter = typeof appRouter
