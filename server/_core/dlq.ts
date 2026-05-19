import { Queue } from "bullmq";
import type { Job } from "bullmq";
import { redis, QUEUE_PREFIX } from "./redis.ts";
import { logger } from "./logger.ts";
import { Sentry } from "./instrument.ts";

// Dead Letter Queue — receives jobs that have exhausted all retry attempts.
// Failed jobs are stored here for inspection and potential manual replay.
// Lazily initialized so importing this module doesn't open a Redis connection
// at startup (e.g., in test environments that mock bullmq).
let dlq: Queue | null = null;
function getDlq(): Queue {
  if (!dlq) {
    dlq = new Queue("dlq", {
      connection: redis,
      prefix: QUEUE_PREFIX,
      defaultJobOptions: { removeOnComplete: false, removeOnFail: false },
    });
  }
  return dlq;
}

interface DlqEntry {
  sourceQueue: string;
  jobId: string | undefined;
  jobName: string | undefined;
  jobData: unknown;
  attempts: number;
  error: string;
  failedAt: string;
}

export async function getDlqCount(): Promise<number> {
  try {
    return await getDlq().getWaitingCount();
  } catch {
    return -1;
  }
}

export async function sendToDlq(
  sourceQueue: string,
  job: Job | undefined,
  err: Error,
): Promise<void> {
  const entry: DlqEntry = {
    sourceQueue,
    jobId: job?.id,
    jobName: job?.name,
    jobData: job?.data,
    attempts: job?.attemptsMade ?? 0,
    error: err.message,
    failedAt: new Date().toISOString(),
  };

  logger.error(`[dlq] Job movido para DLQ — ${sourceQueue}`, entry);
  Sentry.captureException(err, {
    tags: { queue: sourceQueue, jobId: job?.id },
  });

  try {
    await getDlq().add(`${sourceQueue}:failed`, entry);
  } catch (dlqErr) {
    // DLQ write failure must not propagate — log only
    logger.error("[dlq] Falha ao gravar na DLQ (Redis indisponível?)", {
      originalError: err.message,
      dlqError: dlqErr instanceof Error ? dlqErr.message : String(dlqErr),
    });
  }
}
