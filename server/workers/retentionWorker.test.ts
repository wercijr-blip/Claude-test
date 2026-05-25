import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();
const mockUpdate = vi.fn();

// Capture the Worker callback for internal testing
let capturedWorkerCallback:
  | (() => Promise<{ purged: number; errors: number }>)
  | undefined;

vi.mock("../db.ts", () => ({
  db: {
    select: mockSelect,
    update: mockUpdate,
  },
}));

vi.mock("../../drizzle/schema.ts", () => ({
  pacientes: { id: "id", retentionUntil: "retentionUntil" },
}));

vi.mock("../_core/logger.ts", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("../email.ts", () => ({
  enviarRelatorioRetencao: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../workers/queues.ts", () => ({
  connection: {},
  QUEUE_PREFIX: "{fp-test}",
  SHARED_WORKER_SETTINGS: {
    lockDuration: 60_000,
    stalledInterval: 60_000,
    maxStalledCount: 1,
    removeOnComplete: { count: 10 },
    removeOnFail: { count: 50 },
  },
}));

vi.mock("bullmq", () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({}),
  })),
  Worker: vi
    .fn()
    .mockImplementation(
      (
        _name: string,
        callback: () => Promise<{ purged: number; errors: number }>,
      ) => {
        capturedWorkerCallback = callback;
        return { on: vi.fn(), close: vi.fn().mockResolvedValue(undefined) };
      },
    ),
}));

describe("retentionWorker — módulo e exports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedWorkerCallback = undefined;
  });

  it("exporta agendarRetencaoDiaria e startRetentionWorker", async () => {
    vi.resetModules();
    const mod = await import("./retentionWorker.ts");
    expect(mod.agendarRetencaoDiaria).toBeInstanceOf(Function);
    expect(mod.startRetentionWorker).toBeInstanceOf(Function);
  });

  it("startRetentionWorker retorna um worker BullMQ", async () => {
    vi.resetModules();
    const { startRetentionWorker } = await import("./retentionWorker.ts");
    const worker = startRetentionWorker();
    expect(worker).toBeDefined();
  });

  it("startRetentionWorker captura callback interno", async () => {
    vi.resetModules();
    const { startRetentionWorker } = await import("./retentionWorker.ts");
    startRetentionWorker();
    expect(capturedWorkerCallback).toBeInstanceOf(Function);
  });

  it("agendarRetencaoDiaria é uma função assíncrona", async () => {
    vi.resetModules();
    const { agendarRetencaoDiaria } = await import("./retentionWorker.ts");
    expect(agendarRetencaoDiaria).toBeInstanceOf(Function);
  });
});

describe("retentionWorker — executarPurgaLgpd via callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedWorkerCallback = undefined;
  });

  it("anonimiza pacientes vencidos e retorna { purged: 2, errors: 0 }", async () => {
    vi.resetModules();

    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]),
      }),
    });

    const mockUpdateSet = vi
      .fn()
      .mockReturnValue({ where: vi.fn().mockResolvedValue([]) });
    mockUpdate.mockReturnValue({ set: mockUpdateSet });

    const { startRetentionWorker } = await import("./retentionWorker.ts");
    startRetentionWorker();

    expect(capturedWorkerCallback).toBeDefined();
    const result = await capturedWorkerCallback!();

    expect(result.purged).toBe(2);
    expect(result.errors).toBe(0);
    expect(mockUpdateSet).toHaveBeenCalledTimes(2);
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        nomeEncrypted: "[anonimizado]",
        cpfHash: "[anonimizado]",
      }),
    );
  });

  it("conta erros quando update falha para um paciente", async () => {
    vi.resetModules();

    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]),
      }),
    });

    mockUpdate
      .mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockRejectedValue(new Error("DB error")),
        }),
      })
      .mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
      });

    const { startRetentionWorker } = await import("./retentionWorker.ts");
    startRetentionWorker();

    const result = await capturedWorkerCallback!();

    expect(result.purged).toBe(1);
    expect(result.errors).toBe(1);
  });

  it("retorna { purged: 0, errors: 0 } sem chamar update quando lista vazia", async () => {
    vi.resetModules();

    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });

    const { startRetentionWorker } = await import("./retentionWorker.ts");
    startRetentionWorker();

    const result = await capturedWorkerCallback!();

    expect(result.purged).toBe(0);
    expect(result.errors).toBe(0);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
