import { z } from "zod";
import { router, adminProcedure } from "../_core/trpc.ts";
import { getDlq, getDlqCount } from "../_core/dlq.ts";
import { logger } from "../_core/logger.ts";

export const adminRouter = router({
  dlqCount: adminProcedure.query(async () => {
    return { count: await getDlqCount() };
  }),

  dlqJobs: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(20) }))
    .query(async ({ input }) => {
      const jobs = await getDlq().getJobs(["waiting"], 0, input.limit - 1);
      return {
        jobs: jobs.map((j) => ({
          id: j.id,
          name: j.name,
          data: j.data,
          timestamp: j.timestamp,
        })),
      };
    }),

  replayDlqJob: adminProcedure
    .input(z.object({ jobId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const dlq = getDlq();
      const job = await dlq.getJob(input.jobId);
      if (!job) {
        return { ok: false, reason: "job_not_found" };
      }

      await job.remove();

      logger.info("[admin] DLQ job removido para replay manual", {
        jobId: input.jobId,
        name: job.name,
        data: job.data,
      });

      return { ok: true, name: job.name, data: job.data };
    }),
});
