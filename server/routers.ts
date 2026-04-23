import { router } from './_core/trpc.ts'
import { authRouter }         from './routes/auth.ts'
import { userRouter }         from './routes/users.ts'
import { adminStatsRouter }   from './routes/admin-stats.ts'
import { knowledgeTopicRouter } from './routes/knowledge.ts'
import { bulletinRouter }     from './routes/bulletin.ts'
import { tokenRouter }        from './routes/token.ts'
import { pacienteRouter }     from './routes/paciente.ts'
import { medicoRouter }       from './routes/medico.ts'
import { adminRouter as legacyAdminRouter } from './routes/admin.ts'
import { intakeRouter }       from './routes/intake.ts'
import { consultaRouter }     from './routes/consulta.ts'
import { pesquisaRouter }     from './routes/pesquisa.ts'

export const appRouter = router({
  // MedScribe routers
  auth:           authRouter,
  user:           userRouter,
  admin:          router({
    stats:    adminStatsRouter,
    bulletin: bulletinRouter,
  }),
  knowledgeTopic: knowledgeTopicRouter,

  // Legacy Facilita PrEP routers (mantidos)
  token:     tokenRouter,
  paciente:  pacienteRouter,
  medico:    medicoRouter,
  legacyAdmin: legacyAdminRouter,
  intake:    intakeRouter,
  consulta:  consultaRouter,
  pesquisa:  pesquisaRouter,
})

export type AppRouter = typeof appRouter
