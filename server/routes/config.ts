import { router, publicProcedure } from '../_core/trpc.ts'
import { env } from '../_core/env.ts'

export const configRouter = router({
  getPublicConfig: publicProcedure.query(() => {
    return {
      googleClientId: env.GOOGLE_CLIENT_ID,
    }
  }),
})
