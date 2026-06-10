import { Queue, Worker } from "bullmq";
import { logger } from "./_core/logger.ts";
import { db } from "./db.ts";
import { exames } from "../drizzle/schema.ts";
import { eq } from "drizzle-orm";
import { analisarExame } from "./examAnalysis.ts";
import { processarResultadoIa } from "./examApprovalService.ts";
import type { ResultadoIa } from "../shared/types.ts";
import {
  connection,
  QUEUE_PREFIX,
  persistDlq,
  EXAM_WORKER_OPTS,
} from "./workers/queues.ts";

export const EXAM_QUEUE_NAME = "exam-analysis";

export const examQueue = new Queue(EXAM_QUEUE_NAME, {
  connection,
  prefix: QUEUE_PREFIX,
});

export function startExamWorker() {
  const worker = new Worker(
    EXAM_QUEUE_NAME,
    async (job) => {
      const { exameId, requestId, actorId } = job.data as {
        exameId: number;
        requestId?: string;
        actorId?: number;
      };
      const logCtx = { exameId, requestId, actorId };

      // 1. Run AI analysis (updates exames.resultadoIa with status: 'pendente')
      let resultado: ResultadoIa;
      try {
        resultado = await analisarExame(exameId);
      } catch (err) {
        logger.error(`[examQueue] Falha na análise do exame ${exameId}`, {
          ...logCtx,
          error: (err as Error).message,
        });
        throw err; // Let BullMQ retry
      }

      // 2. Fetch the exam to get pacienteId
      const [exame] = await db
        .select()
        .from(exames)
        .where(eq(exames.id, exameId))
        .limit(1);
      if (!exame) {
        logger.error(
          `[examQueue] Exame ${exameId} não encontrado após análise`,
          logCtx,
        );
        return;
      }

      const { pacienteId } = exame;

      // 3. Auto-approval logic (delegated to examApprovalService for single responsibility)
      const resultadoFinal = await processarResultadoIa(
        exameId,
        pacienteId,
        resultado,
        logCtx,
      );

      return {
        exameId,
        requestId,
        resultado: resultadoFinal.resultado,
        status: resultadoFinal.status,
      };
    },
    { ...EXAM_WORKER_OPTS, connection, concurrency: 3, prefix: QUEUE_PREFIX },
  );

  worker.on("failed", (job, err) => {
    logger.error(
      `[examQueue] Job ${job?.id} falhou (${job?.attemptsMade} tentativas)`,
      { error: err.message },
    );
    if ((job?.attemptsMade ?? 0) >= (job?.opts?.attempts ?? 3)) {
      void persistDlq(EXAM_QUEUE_NAME, job, err);
    }
  });

  return worker;
}

// actorId — ECF.02: profissional solicitante vinculado à sessão SBIS
export async function enqueueAnalisarExame(
  exameId: number,
  requestId?: string,
  forceRequeue = false,
  actorId?: number,
) {
  if (forceRequeue) {
    const existing = await examQueue.getJob(`exam-${exameId}`);
    if (existing) {
      const state = await existing.getState();
      if (state === "active") {
        // Job is currently processing — adding with the same jobId would throw.
        // Return the in-flight job so callers don't crash.
        return existing;
      }
      // Remove with catch: worker may have picked up job between getState() and remove()
      await examQueue.remove(`exam-${exameId}`).catch(() => {});
    }
  }
  return examQueue.add(
    "analisar",
    { exameId, requestId, actorId },
    {
      jobId: `exam-${exameId}`,
      attempts: 3,
      // 65s initial delay ensures retries cross the 60s per-minute rate-limit window
      backoff: { type: "exponential", delay: 65_000 },
    },
  );
}
