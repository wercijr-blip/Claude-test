import { describe, it, expect, vi, beforeEach } from "vitest";
import { Worker } from "bullmq";

type NutricaoJobLike = {
  name: string;
  id?: string;
  opts?: { attempts?: number };
  attemptsMade?: number;
};

let capturedCallback: ((job: NutricaoJobLike) => Promise<unknown>) | undefined;
let capturedFailedHandler:
  | ((job: NutricaoJobLike | undefined, err: Error) => void)
  | undefined;

vi.mock("bullmq", () => ({
  Worker: vi
    .fn()
    .mockImplementation(
      (_name: string, callback: (job: NutricaoJobLike) => Promise<unknown>) => {
        capturedCallback = callback;
        return {
          on: vi
            .fn()
            .mockImplementation(
              (
                event: string,
                handler: (job: NutricaoJobLike | undefined, err: Error) => void,
              ) => {
                if (event === "failed") capturedFailedHandler = handler;
              },
            ),
        };
      },
    ),
}));

const mockNutricaoQueueAdd = vi.fn().mockResolvedValue({});

vi.mock("./queues.ts", () => ({
  NUTRICAO_QUEUE_NAME: "nutricao-lead",
  QUEUE_PREFIX: "{fp-test}",
  connection: {},
  NUTRICAO_WORKER_OPTS: { drainDelay: 300 },
  nutricaoQueue: { add: mockNutricaoQueueAdd },
  persistDlq: vi.fn().mockResolvedValue(undefined),
}));

const mockDbSelect = vi.fn();
vi.mock("../db.ts", () => ({ db: { select: mockDbSelect } }));
vi.mock("../../drizzle/schema.ts", () => ({
  precadastros: {
    id: "id",
    nomeEncrypted: "nomeEncrypted",
    emailEncrypted: "emailEncrypted",
    createdAt: "createdAt",
    status: "status",
  },
}));
vi.mock("drizzle-orm", () => ({
  and: vi.fn(),
  eq: vi.fn(),
  gt: vi.fn(),
  lt: vi.fn(),
  isNull: vi.fn(),
  or: vi.fn(),
}));

vi.mock("../_core/encryption.ts", () => ({
  decrypt: vi
    .fn()
    .mockImplementation((v: string) =>
      v === "enc_email" ? "lead@teste.com" : "Maria Silva",
    ),
}));

const mockRedisGet = vi.fn().mockResolvedValue(null);
const mockRedisSet = vi.fn().mockResolvedValue("OK");
vi.mock("../_core/redis.ts", () => ({
  redis: { get: mockRedisGet, set: mockRedisSet },
}));

vi.mock("../_core/env.ts", () => ({
  env: {
    NODE_ENV: "test",
    RESEND_API_KEY: "test-key",
    APP_URL: "https://facilitaprep.com.br",
    EMAIL_FROM: "noreply@facilitaprep.com.br",
    FF_EXAM_AI_ANALYSIS: true,
    FF_NUTRICAO_EMAILS: true,
    FF_REQUIRE_MFA_PRESCRIBERS: false,
    FF_ASAAS_NFSE: true,
  },
}));
vi.mock("../_core/logger.ts", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockEmailSend = vi
  .fn()
  .mockResolvedValue({ data: { id: "email-1" }, error: null });
vi.mock("resend", () => ({
  Resend: vi
    .fn()
    .mockImplementation(() => ({ emails: { send: mockEmailSend } })),
}));

vi.mock("@sentry/node", () => ({ captureException: vi.fn() }));

function makeLead(overrides = {}) {
  return {
    id: 1,
    nomeEncrypted: "enc_nome",
    emailEncrypted: "enc_email",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    ...overrides,
  };
}

function setupDbSelect(leads: unknown[]) {
  mockDbSelect.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(leads),
      }),
    }),
  });
}

describe("agendarNutricaoDiaria", () => {
  beforeEach(() => vi.clearAllMocks());

  it("adiciona job recorrente à fila de nutricao", async () => {
    vi.resetModules();
    const { agendarNutricaoDiaria } = await import("./nutricaoWorker.ts");
    await agendarNutricaoDiaria();
    expect(mockNutricaoQueueAdd).toHaveBeenCalledWith(
      "nutricao-diaria",
      {},
      expect.objectContaining({ jobId: "nutricao-diaria-fixo" }),
    );
  });
});

describe("startNutricaoWorker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedCallback = undefined;
    capturedFailedHandler = undefined;
  });

  it("cria Worker e registra handler de falha", async () => {
    vi.resetModules();
    const { startNutricaoWorker } = await import("./nutricaoWorker.ts");
    startNutricaoWorker();
    expect(vi.mocked(Worker)).toHaveBeenCalledOnce();
    expect(capturedFailedHandler).toBeDefined();
  });

  it("retorna undefined para job desconhecido", async () => {
    vi.resetModules();
    const { startNutricaoWorker } = await import("./nutricaoWorker.ts");
    startNutricaoWorker();
    const result = await capturedCallback!({ name: "job-desconhecido" });
    expect(result).toBeUndefined();
  });

  it("processa nutricao-diaria e retorna { leads, enviados }", async () => {
    vi.resetModules();
    setupDbSelect([makeLead()]);
    const { startNutricaoWorker } = await import("./nutricaoWorker.ts");
    startNutricaoWorker();

    const result = (await capturedCallback!({ name: "nutricao-diaria" })) as {
      leads: number;
      enviados: number;
    };

    expect(result).toHaveProperty("leads");
    expect(result).toHaveProperty("enviados");
    expect(result.leads).toBe(1);
    expect(result.enviados).toBe(1);
    expect(mockEmailSend).toHaveBeenCalledOnce();
    expect(mockRedisSet).toHaveBeenCalledOnce();
  });

  it("pula lead quando já enviado hoje (Redis cache hit)", async () => {
    vi.resetModules();
    setupDbSelect([makeLead()]);
    mockRedisGet.mockResolvedValueOnce("1"); // cache hit
    const { startNutricaoWorker } = await import("./nutricaoWorker.ts");
    startNutricaoWorker();

    const result = (await capturedCallback!({ name: "nutricao-diaria" })) as {
      enviados: number;
    };

    expect(result.enviados).toBe(0);
    expect(mockEmailSend).not.toHaveBeenCalled();
  });

  it("retorna { leads: 0, enviados: 0 } quando não há leads", async () => {
    vi.resetModules();
    setupDbSelect([]);
    const { startNutricaoWorker } = await import("./nutricaoWorker.ts");
    startNutricaoWorker();

    const result = (await capturedCallback!({ name: "nutricao-diaria" })) as {
      leads: number;
      enviados: number;
    };

    expect(result.leads).toBe(0);
    expect(result.enviados).toBe(0);
    expect(mockEmailSend).not.toHaveBeenCalled();
  });

  it("continua processando outros leads quando envio falha para um", async () => {
    vi.resetModules();
    setupDbSelect([makeLead({ id: 1 }), makeLead({ id: 2 })]);
    mockEmailSend
      .mockResolvedValueOnce({ data: null, error: { message: "SMTP timeout" } }) // lead 1 fails
      .mockResolvedValueOnce({ data: { id: "ok" }, error: null }); // lead 2 succeeds
    const { startNutricaoWorker } = await import("./nutricaoWorker.ts");
    startNutricaoWorker();

    const result = (await capturedCallback!({ name: "nutricao-diaria" })) as {
      leads: number;
      enviados: number;
    };

    expect(result.leads).toBe(2);
    expect(result.enviados).toBe(1);
  });

  it("failed handler chama persistDlq quando tentativas esgotadas", async () => {
    vi.resetModules();
    const { startNutricaoWorker } = await import("./nutricaoWorker.ts");
    const { persistDlq } = await import("./queues.ts");
    startNutricaoWorker();

    const job: NutricaoJobLike = {
      name: "nutricao-diaria",
      id: "j1",
      opts: { attempts: 3 },
      attemptsMade: 3,
    };
    capturedFailedHandler!(job, new Error("crash"));

    expect(persistDlq).toHaveBeenCalledWith(
      "nutricao-lead",
      job,
      expect.any(Error),
    );
  });
});
