import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("bullmq", () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({ id: "job-cs-1" }),
    getJob: vi.fn(),
    getWaitingCount: vi.fn().mockResolvedValue(0),
  })),
  Worker: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
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
    CLINICA_NOME: "Clínica",
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
}));

vi.mock("./clinicalIntelligence.ts", () => ({
  gerarSerieCasos: vi.fn(),
  getOpusBudgetStatus: vi.fn().mockResolvedValue({ usado: 0, limite: 100000, percentual: 0 }),
}));

vi.mock("./obsidian.ts", () => ({ publicarSerieCasos: vi.fn() }));
vi.mock("./pubmed.ts", () => ({ buscarArtigosDual: vi.fn().mockResolvedValue([]) }));
vi.mock("./zotero.ts", () => ({
  buscarReferenciasPorQuery: vi.fn().mockResolvedValue([]),
  formatarZoteroParaPrompt: vi.fn().mockReturnValue(""),
}));

vi.mock("./db.ts", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnThis(),
      onDuplicateKeyUpdate: vi.fn().mockResolvedValue([{}]),
    }),
  },
}));

import { enqueueCaseSeries, CASE_SERIES_QUEUE_NAME, caseSeriesQueue } from "./caseSeriesQueue.ts";
import { db } from "./db.ts";

function setSelectResult(rows: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  };
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);
}

describe("caseSeriesQueue configuração", () => {
  it("exporta o nome correto da fila", () => {
    expect(CASE_SERIES_QUEUE_NAME).toBe("case-series");
  });

  it("exporta a fila com add disponível", () => {
    expect(caseSeriesQueue).toBeDefined();
    expect(typeof caseSeriesQueue.add).toBe("function");
  });
});

describe("enqueueCaseSeries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna false se soapNoteIds.length < 3", async () => {
    const result = await enqueueCaseSeries({
      medicoId: 1,
      cid10: "A00",
      diagnostico: "Cólera",
      soapNoteIds: [1, 2],
      disparadoPor: "automatico",
    });
    expect(result).toBe(false);
    expect(caseSeriesQueue.add).not.toHaveBeenCalled();
  });

  it("retorna false se já existe rascunho ativo para o CID-10", async () => {
    setSelectResult([{ id: 99 }]);

    const result = await enqueueCaseSeries({
      medicoId: 1,
      cid10: "B20",
      diagnostico: "HIV",
      soapNoteIds: [1, 2, 3],
      disparadoPor: "automatico",
    });
    expect(result).toBe(false);
    expect(caseSeriesQueue.add).not.toHaveBeenCalled();
  });

  it("enfileira e retorna true quando não existe rascunho ativo", async () => {
    setSelectResult([]);

    const result = await enqueueCaseSeries({
      medicoId: 1,
      cid10: "A41",
      diagnostico: "Sepse",
      soapNoteIds: [10, 11, 12],
      disparadoPor: "manual",
    });
    expect(result).toBe(true);
    expect(caseSeriesQueue.add).toHaveBeenCalledWith(
      "gerar-serie",
      expect.objectContaining({
        medicoId: 1,
        cid10: "A41",
        soapNoteIds: [10, 11, 12],
      }),
      expect.objectContaining({
        jobId: "case-series-1-A41",
      }),
    );
  });

  it("usa jobId determinístico (medicoId, cid10)", async () => {
    setSelectResult([]);

    await enqueueCaseSeries({
      medicoId: 7,
      cid10: "J18",
      diagnostico: "Pneumonia",
      soapNoteIds: [1, 2, 3, 4],
      disparadoPor: "automatico",
    });

    const call = (caseSeriesQueue.add as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect((call[2] as { jobId: string }).jobId).toBe("case-series-7-J18");
  });
});
