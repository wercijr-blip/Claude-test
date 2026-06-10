import { describe, it, expect, vi, beforeEach } from "vitest";
import { Worker } from "bullmq";

type JobData = {
  email: string;
  nome: string;
  telefone: string | null;
  link: string;
  expiresAt: string;
  codigo: string;
};
type JobLike = {
  data: JobData;
  id?: string;
  opts?: { attempts?: number };
  attemptsMade?: number;
};

let capturedCallback: ((job: JobLike) => Promise<void>) | undefined;
let capturedFailedHandler:
  | ((job: JobLike | undefined, err: Error) => void)
  | undefined;

vi.mock("bullmq", () => ({
  Worker: vi
    .fn()
    .mockImplementation(
      (_name: string, callback: (job: JobLike) => Promise<void>) => {
        capturedCallback = callback;
        return {
          on: vi
            .fn()
            .mockImplementation(
              (
                event: string,
                handler: (job: JobLike | undefined, err: Error) => void,
              ) => {
                if (event === "failed") capturedFailedHandler = handler;
              },
            ),
        };
      },
    ),
}));

const mockLinkAcessoQueueAdd = vi.fn().mockResolvedValue({});

vi.mock("./queues.ts", () => ({
  LINK_ACESSO_QUEUE_NAME: "link-acesso",
  QUEUE_PREFIX: "{fp-test}",
  connection: {},
  SHARED_WORKER_SETTINGS: {
    lockDuration: 60_000,
    stalledInterval: 60_000,
    maxStalledCount: 1,
    removeOnComplete: { count: 10 },
    removeOnFail: { count: 50 },
  },
  linkAcessoQueue: { add: mockLinkAcessoQueueAdd },
  persistDlq: vi.fn().mockResolvedValue(undefined),
}));

const mockEnviarLink = vi.fn().mockResolvedValue(undefined);
const mockEnviarWhatsApp = vi.fn().mockResolvedValue(undefined);

vi.mock("../email.ts", () => ({ enviarLinkAcessoIntake: mockEnviarLink }));
vi.mock("../whatsapp.ts", () => ({ enviarWhatsApp: mockEnviarWhatsApp }));
vi.mock("../_core/logger.ts", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe("enqueueEnviarLinkAcesso", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lança erro quando codigo está vazio", async () => {
    const { enqueueEnviarLinkAcesso } = await import("./linkAcessoWorker.ts");
    await expect(
      enqueueEnviarLinkAcesso(
        "a@b.com",
        "Ana",
        null,
        "https://app.com/acesso/TOKEN",
        new Date(),
        "",
      ),
    ).rejects.toThrow("codigo vazio");
  });

  it("lança erro quando link não contém /acesso/", async () => {
    const { enqueueEnviarLinkAcesso } = await import("./linkAcessoWorker.ts");
    await expect(
      enqueueEnviarLinkAcesso(
        "a@b.com",
        "Ana",
        null,
        "https://app.com/sem-token",
        new Date(),
        "COD123",
      ),
    ).rejects.toThrow("link sem token");
  });

  it("adiciona job à fila quando dados válidos", async () => {
    vi.resetModules();
    const { enqueueEnviarLinkAcesso } = await import("./linkAcessoWorker.ts");
    await enqueueEnviarLinkAcesso(
      "a@b.com",
      "Ana",
      null,
      "https://app.com/acesso/TOKEN",
      new Date(),
      "COD123",
    );
    expect(mockLinkAcessoQueueAdd).toHaveBeenCalledWith(
      "enviar-link",
      expect.objectContaining({ codigo: "COD123" }),
      expect.any(Object),
    );
  });
});

describe("startLinkAcessoWorker — worker callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedCallback = undefined;
    capturedFailedHandler = undefined;
  });

  it("cria Worker e registra handler de falha", async () => {
    vi.resetModules();
    const { startLinkAcessoWorker } = await import("./linkAcessoWorker.ts");
    startLinkAcessoWorker();
    expect(vi.mocked(Worker)).toHaveBeenCalledOnce();
    expect(capturedFailedHandler).toBeDefined();
  });

  it("lança erro dentro do Worker quando codigo vazio", async () => {
    vi.resetModules();
    const { startLinkAcessoWorker } = await import("./linkAcessoWorker.ts");
    startLinkAcessoWorker();

    await expect(
      capturedCallback!({
        data: {
          email: "x@y.com",
          nome: "Ana",
          telefone: null,
          link: "https://app.com/acesso/T",
          expiresAt: new Date().toISOString(),
          codigo: "",
        },
        id: "j1",
      }),
    ).rejects.toThrow("codigo vazio");
  });

  it("lança erro dentro do Worker quando link sem token", async () => {
    vi.resetModules();
    const { startLinkAcessoWorker } = await import("./linkAcessoWorker.ts");
    startLinkAcessoWorker();

    await expect(
      capturedCallback!({
        data: {
          email: "x@y.com",
          nome: "Ana",
          telefone: null,
          link: "https://app.com/sem-token",
          expiresAt: new Date().toISOString(),
          codigo: "COD",
        },
        id: "j2",
      }),
    ).rejects.toThrow("link sem token");
  });

  it("envia email e não envia WhatsApp quando telefone ausente", async () => {
    vi.resetModules();
    const { startLinkAcessoWorker } = await import("./linkAcessoWorker.ts");
    startLinkAcessoWorker();

    await capturedCallback!({
      data: {
        email: "p@q.com",
        nome: "Maria",
        telefone: null,
        link: "https://app.com/acesso/TOKEN",
        expiresAt: new Date().toISOString(),
        codigo: "COD",
      },
    });

    expect(mockEnviarLink).toHaveBeenCalledOnce();
    expect(mockEnviarWhatsApp).not.toHaveBeenCalled();
  });

  it("envia WhatsApp quando telefone presente", async () => {
    vi.resetModules();
    const { startLinkAcessoWorker } = await import("./linkAcessoWorker.ts");
    startLinkAcessoWorker();

    await capturedCallback!({
      data: {
        email: "p@q.com",
        nome: "Maria Fernanda",
        telefone: "+5561988887777",
        link: "https://app.com/acesso/TOKEN",
        expiresAt: new Date().toISOString(),
        codigo: "COD",
      },
    });

    expect(mockEnviarWhatsApp).toHaveBeenCalledWith(
      "+5561988887777",
      expect.stringContaining("Maria"),
    );
  });

  it("failed handler chama persistDlq quando tentativas esgotadas", async () => {
    vi.resetModules();
    const { startLinkAcessoWorker } = await import("./linkAcessoWorker.ts");
    const { persistDlq } = await import("./queues.ts");
    startLinkAcessoWorker();

    const job: JobLike = {
      data: {
        email: "a@b.com",
        nome: "X",
        telefone: null,
        link: "https://app.com/acesso/T",
        expiresAt: new Date().toISOString(),
        codigo: "C",
      },
      id: "j3",
      opts: { attempts: 5 },
      attemptsMade: 5,
    };
    capturedFailedHandler!(job, new Error("fail"));

    expect(persistDlq).toHaveBeenCalledWith(
      "link-acesso",
      job,
      expect.any(Error),
    );
  });
});
