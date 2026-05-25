import { describe, it, expect, vi, beforeEach } from "vitest";
import { Worker } from "bullmq";

type JobData = {
  pacienteId: number;
  email: string | null;
  telefone: string | null;
  nome: string;
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

vi.mock("./queues.ts", () => ({
  PESQUISA_QUEUE_NAME: "pesquisa-satisfacao",
  QUEUE_PREFIX: "{fp-test}",
  connection: {},
  PESQUISA_WORKER_OPTS: { drainDelay: 120 },
  persistDlq: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("crypto", () => ({
  randomBytes: vi.fn().mockReturnValue({ toString: () => "abc123token" }),
}));

vi.mock("../db.ts", () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onDuplicateKeyUpdate: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
}));

vi.mock("../../drizzle/schema.ts", () => ({ pesquisaTokens: {} }));

const mockEnviarPesquisa = vi.fn().mockResolvedValue(undefined);
const mockEnviarWhatsApp = vi.fn().mockResolvedValue(undefined);

vi.mock("../email.ts", () => ({
  enviarPesquisaSatisfacao: mockEnviarPesquisa,
}));
vi.mock("../whatsapp.ts", () => ({ enviarWhatsApp: mockEnviarWhatsApp }));
vi.mock("../_core/env.ts", () => ({
  env: { APP_URL: "https://facilitaprep.com.br", NODE_ENV: "test" },
}));
vi.mock("../_core/logger.ts", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe("startPesquisaWorker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedCallback = undefined;
    capturedFailedHandler = undefined;
  });

  it("cria Worker e registra handler de falha", async () => {
    const { startPesquisaWorker } = await import("./pesquisaWorker.ts");
    startPesquisaWorker();
    expect(vi.mocked(Worker)).toHaveBeenCalledOnce();
    expect(capturedFailedHandler).toBeDefined();
  });

  it("envia email quando email presente", async () => {
    vi.resetModules();
    const { startPesquisaWorker } = await import("./pesquisaWorker.ts");
    startPesquisaWorker();

    await capturedCallback!({
      data: {
        pacienteId: 1,
        email: "paciente@teste.com",
        telefone: null,
        nome: "Ana Silva",
      },
    });

    expect(mockEnviarPesquisa).toHaveBeenCalledWith(
      "paciente@teste.com",
      "Ana Silva",
      expect.stringContaining("/pesquisa/1/"),
    );
    expect(mockEnviarWhatsApp).not.toHaveBeenCalled();
  });

  it("não envia email quando email ausente", async () => {
    vi.resetModules();
    const { startPesquisaWorker } = await import("./pesquisaWorker.ts");
    startPesquisaWorker();

    await capturedCallback!({
      data: { pacienteId: 2, email: null, telefone: null, nome: "João" },
    });

    expect(mockEnviarPesquisa).not.toHaveBeenCalled();
  });

  it("envia WhatsApp quando telefone presente", async () => {
    vi.resetModules();
    const { startPesquisaWorker } = await import("./pesquisaWorker.ts");
    startPesquisaWorker();

    await capturedCallback!({
      data: {
        pacienteId: 3,
        email: null,
        telefone: "+5561999999999",
        nome: "Carlos Lima",
      },
    });

    expect(mockEnviarWhatsApp).toHaveBeenCalledWith(
      "+5561999999999",
      expect.stringContaining("pesquisa"),
    );
  });

  it("não envia WhatsApp quando telefone ausente", async () => {
    vi.resetModules();
    const { startPesquisaWorker } = await import("./pesquisaWorker.ts");
    startPesquisaWorker();

    await capturedCallback!({
      data: { pacienteId: 4, email: "a@b.com", telefone: null, nome: "Maria" },
    });

    expect(mockEnviarWhatsApp).not.toHaveBeenCalled();
  });

  it("continua mesmo quando envio de email falha", async () => {
    vi.resetModules();
    mockEnviarPesquisa.mockRejectedValueOnce(new Error("SMTP error"));
    const { startPesquisaWorker } = await import("./pesquisaWorker.ts");
    startPesquisaWorker();

    await expect(
      capturedCallback!({
        data: {
          pacienteId: 5,
          email: "x@y.com",
          telefone: null,
          nome: "Pedro",
        },
      }),
    ).resolves.toBeUndefined();
  });

  it("failed handler chama persistDlq quando tentativas esgotadas", async () => {
    vi.resetModules();
    const { startPesquisaWorker } = await import("./pesquisaWorker.ts");
    const { persistDlq } = await import("./queues.ts");
    startPesquisaWorker();

    const job: JobLike = {
      data: { pacienteId: 1, email: null, telefone: null, nome: "X" },
      id: "j1",
      opts: { attempts: 3 },
      attemptsMade: 3,
    };
    capturedFailedHandler!(job, new Error("falhou"));

    expect(persistDlq).toHaveBeenCalledWith(
      "pesquisa-satisfacao",
      job,
      expect.any(Error),
    );
  });

  it("failed handler não chama persistDlq antes de esgotar tentativas", async () => {
    vi.resetModules();
    const { startPesquisaWorker } = await import("./pesquisaWorker.ts");
    const { persistDlq } = await import("./queues.ts");
    startPesquisaWorker();

    const job: JobLike = {
      data: { pacienteId: 1, email: null, telefone: null, nome: "X" },
      id: "j2",
      opts: { attempts: 3 },
      attemptsMade: 1,
    };
    capturedFailedHandler!(job, new Error("falhou"));

    expect(persistDlq).not.toHaveBeenCalled();
  });
});
