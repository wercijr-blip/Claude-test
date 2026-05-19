import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAdd = vi.fn().mockResolvedValue(undefined);
const mockGetWaitingCount = vi.fn().mockResolvedValue(0);

vi.mock("bullmq", () => ({
  Queue: vi.fn(() => ({ add: mockAdd, getWaitingCount: mockGetWaitingCount })),
}));

vi.mock("./_core/redis.ts", () => ({
  redis: { status: "ready" },
  QUEUE_PREFIX: "{cis-test}",
}));

vi.mock("./_core/instrument.ts", () => ({
  Sentry: { captureException: vi.fn() },
}));

vi.mock("./_core/logger.ts", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

const { sendToDlq, getDlqCount } = await import("./_core/dlq.ts");

describe("DLQ", () => {
  beforeEach(() => {
    mockAdd.mockClear();
    mockGetWaitingCount.mockClear();
    mockGetWaitingCount.mockResolvedValue(0);
  });

  it("getDlqCount returns 0 when queue is empty", async () => {
    mockGetWaitingCount.mockResolvedValue(0);
    const count = await getDlqCount();
    expect(count).toBe(0);
  });

  it("getDlqCount returns -1 on Redis error", async () => {
    mockGetWaitingCount.mockRejectedValueOnce(new Error("Redis down"));
    const count = await getDlqCount();
    expect(count).toBe(-1);
  });

  it("getDlqCount returns count from queue", async () => {
    mockGetWaitingCount.mockResolvedValueOnce(5);
    const count = await getDlqCount();
    expect(count).toBe(5);
  });

  it("sendToDlq enqueues failed job entry", async () => {
    const fakeJob = {
      id: "42",
      name: "test-job",
      data: { medicoId: 1 },
      attemptsMade: 3,
    } as Parameters<typeof sendToDlq>[1];

    await sendToDlq("pubmed-synthesis", fakeJob, new Error("timeout"));

    expect(mockAdd).toHaveBeenCalledWith(
      "pubmed-synthesis:failed",
      expect.objectContaining({
        sourceQueue: "pubmed-synthesis",
        jobId: "42",
        error: "timeout",
      }),
    );
  });

  it("sendToDlq does not throw when DLQ write fails", async () => {
    mockAdd.mockRejectedValueOnce(new Error("Redis unavailable"));
    await expect(
      sendToDlq("test-queue", undefined, new Error("original")),
    ).resolves.toBeUndefined();
  });

  it("sendToDlq handles undefined job gracefully", async () => {
    await expect(
      sendToDlq("digest", undefined, new Error("worker crash")),
    ).resolves.toBeUndefined();
    expect(mockAdd).toHaveBeenCalledWith(
      "digest:failed",
      expect.objectContaining({ sourceQueue: "digest", jobId: undefined }),
    );
  });
});
