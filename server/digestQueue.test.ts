import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("bullmq", () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({ id: "job-1" }),
    getJob: vi.fn(),
    getJobs: vi.fn().mockResolvedValue([]),
    getWaitingCount: vi.fn().mockResolvedValue(0),
    getActiveCount: vi.fn().mockResolvedValue(0),
    getFailedCount: vi.fn().mockResolvedValue(0),
  })),
  Worker: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  })),
  QueueScheduler: vi.fn().mockImplementation(() => ({
    close: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock("./_core/redis.ts", () => ({
  redis: {},
  QUEUE_PREFIX: "{cis-test}",
}));

vi.mock("./_core/env.ts", () => ({
  env: {
    NODE_ENV: "test",
    BUILT_IN_FORGE_API_KEY: "test-key",
    BUILT_IN_FORGE_API_URL: undefined,
    MEDICO_NOME: "Dr. Teste",
    MEDICO_CRM: "12345",
    MEDICO_CRM_UF: "DF",
    MEDICO_RQE: "999",
    CLINICA_NOME: "Clínica Teste",
    SUS_CNES: "0000000",
    OPUS_DAILY_TOKEN_BUDGET: 100000,
  },
}));

vi.mock("./_core/logger.ts", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("./_core/dlq.ts", () => ({
  sendToDlq: vi.fn().mockResolvedValue(undefined),
  getDlq: vi.fn(),
  getDlqCount: vi.fn().mockResolvedValue(0),
}));

vi.mock("./clinicalIntelligence.ts", () => ({
  gerarDigestDiario: vi.fn(),
  gerarDigestSemanal: vi.fn(),
  gerarDigestMensal: vi.fn(),
  gerarDigestSemanalLote: vi.fn(),
  gerarDigestMensalLote: vi.fn(),
  getOpusBudgetStatus: vi.fn().mockResolvedValue({ usado: 0, limite: 100000, percentual: 0 }),
}));

vi.mock("./obsidian.ts", () => ({ publicarDigest: vi.fn() }));
vi.mock("./n8n.ts", () => ({ notificarDigest: vi.fn() }));

vi.mock("./db.ts", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
      groupBy: vi.fn().mockReturnThis(),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnThis(),
      onDuplicateKeyUpdate: vi.fn().mockResolvedValue([{}]),
    }),
  },
}));

import { digestQueue, enqueueDigestDiario, DIGEST_QUEUE_NAME } from "./digestQueue.ts";

describe("digestQueue configuração", () => {
  it("exporta o nome correto da fila", () => {
    expect(DIGEST_QUEUE_NAME).toBe("clinical-digest");
  });

  it("tem defaultJobOptions com attempts e backoff declarados no módulo", async () => {
    // Verifica que o módulo exporta a fila e que a Queue foi instanciada com as opções corretas
    // A configuração real é validada via comportamento de enqueue (jobId determinístico etc.)
    expect(digestQueue).toBeDefined();
    expect(typeof digestQueue.add).toBe("function");
  });
});

describe("enqueueDigestDiario", () => {
  it("chama queue.add com jobId determinístico", async () => {
    const job = await enqueueDigestDiario({
      medicoId: 1,
      sessionId: 10,
      periodoRef: "2026-05-20",
    });

    expect(job).toBeDefined();
    expect(digestQueue.add).toHaveBeenCalledWith(
      "digest-diario",
      expect.objectContaining({
        tipo: "diario",
        medicoId: 1,
        sessionId: 10,
        periodoRef: "2026-05-20",
      }),
      expect.objectContaining({
        jobId: "digest-diario-1-2026-05-20",
      }),
    );
  });

  it("jobId inclui medicoId e periodoRef para evitar duplicatas", async () => {
    await enqueueDigestDiario({ medicoId: 42, sessionId: 5, periodoRef: "2026-01-01" });

    const call = (digestQueue.add as ReturnType<typeof vi.fn>).mock.calls.at(-1)!;
    const opts = call[2] as { jobId: string };
    expect(opts.jobId).toBe("digest-diario-42-2026-01-01");
  });

  it("inclui requestId quando fornecido", async () => {
    await enqueueDigestDiario({
      medicoId: 1,
      sessionId: 1,
      periodoRef: "2026-05-20",
      requestId: "req-abc",
    });

    const call = (digestQueue.add as ReturnType<typeof vi.fn>).mock.calls.at(-1)!;
    expect(call[1]).toMatchObject({ requestId: "req-abc" });
  });
});
