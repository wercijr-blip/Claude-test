import { router } from "./_core/trpc.ts";
import { authRouter } from "./routes/auth.ts";
import { scribaRouter } from "./routes/scriba.ts";
import { adminRouter } from "./routes/admin.ts";

export const appRouter = router({
  auth: authRouter,
  scriba: scribaRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
