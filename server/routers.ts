import { router } from './_core/trpc.ts'
import { authRouter }       from './routes/auth.ts'
import { userRouter }       from './routes/users.ts'
import { adminRouter }      from './routes/admin.ts'
import { adminStatsRouter } from './routes/admin-stats.ts'
import { knowledgeTopicRouter } from './routes/knowledge.ts'
import { bulletinRouter }   from './routes/bulletin.ts'

export const appRouter = router({
  auth:          authRouter,
  user:          userRouter,
  knowledgeTopic: knowledgeTopicRouter,
  admin: router({
    team:     adminRouter,
    stats:    adminStatsRouter,
    bulletin: bulletinRouter,
  }),
})

export type AppRouter = typeof appRouter
