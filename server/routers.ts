import { router } from './_core/trpc.ts'
import { authRouter } from './routes/auth.ts'
import { tokenRouter } from './routes/token.ts'
import { pacienteRouter } from './routes/paciente.ts'
import { medicoRouter } from './routes/medico.ts'
import { adminRouter } from './routes/admin.ts'
import { intakeRouter } from './routes/intake.ts'
import { consultaRouter } from './routes/consulta.ts'
import { pesquisaRouter } from './routes/pesquisa.ts'
import { articlesRouter } from './routes/articles.ts'

export const appRouter = router({
  auth: authRouter,
  token: tokenRouter,
  paciente: pacienteRouter,
  medico: medicoRouter,
  admin: adminRouter,
  intake: intakeRouter,
  consulta: consultaRouter,
  pesquisa: pesquisaRouter,
  articles: articlesRouter,
})

export type AppRouter = typeof appRouter
