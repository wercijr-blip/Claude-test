import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database and dependencies before importing the module under test
vi.mock("./db.ts", () => ({
  db: {
    select: vi.fn(),
  },
}));

vi.mock("./_core/env.ts", () => ({
  env: {
    NODE_ENV: "test",
    BUILT_IN_FORGE_API_KEY: "test-key",
    BUILT_IN_FORGE_API_URL: undefined,
    OPENAI_API_KEY: undefined,
  },
}));

vi.mock("./_core/instrument.ts", () => ({
  Sentry: { captureException: vi.fn(), setupExpressErrorHandler: vi.fn() },
}));

vi.mock("./_core/logger.ts", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("./_core/encryption.ts", () => ({
  encrypt: (s: string) => `enc:${s}`,
  decrypt: (s: string) => s.replace(/^enc:/, ""),
}));

vi.mock("./clinicalIntelligence.ts", () => ({
  gerarSOAP: vi.fn(),
  gerarKnowledgeMetadata: vi.fn(),
  extrairExamesLaboratoriais: vi.fn(),
  detectarDivergenciaConducta: vi.fn(),
}));

vi.mock("./obsidian.ts", () => ({
  publicarNotaSOAP: vi.fn(),
}));

vi.mock("./n8n.ts", () => ({
  notificarSOAP: vi.fn(),
}));

import { db } from "./db.ts";
import { buscarHistoricoFeedback } from "./scriba.ts";

const mockDb = db as unknown as {
  select: ReturnType<typeof vi.fn>;
};

function buildSelectChain(rows: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  };
  mockDb.select.mockReturnValue(chain);
  return chain;
}

describe("buscarHistoricoFeedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna array vazio quando não há feedback registrado", async () => {
    // Both queries return empty arrays
    let callCount = 0;
    mockDb.select.mockImplementation(() => {
      callCount++;
      return {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
    });

    const result = await buscarHistoricoFeedback(1, "A00");
    expect(result).toEqual([]);
  });

  it("retorna feedbacks CID-10 específicos do médico", async () => {
    const cid10Rows = [
      {
        hashAlerta: "abc123",
        feedbackMedico: "concordo",
        feedbackMotivo: null,
      },
      {
        hashAlerta: "def456",
        feedbackMedico: "discordo",
        feedbackMotivo: "Conduta já ajustada",
      },
    ];

    let callCount = 0;
    mockDb.select.mockImplementation(() => {
      callCount++;
      return {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(callCount === 1 ? cid10Rows : []),
      };
    });

    const result = await buscarHistoricoFeedback(1, "A00");
    expect(result.length).toBe(2);
    expect(result[0]!.hashAlerta).toBe("abc123");
    expect(result[0]!.feedback).toBe("concordo");
  });

  it("inclui feedbacks globais quando CID-10 específico retorna vazio", async () => {
    const globalRows = [
      {
        hashAlerta: "ggg111",
        feedbackMedico: "inaplicavel",
        feedbackMotivo: "Caso especial",
      },
    ];

    let callCount = 0;
    mockDb.select.mockImplementation(() => {
      callCount++;
      return {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(callCount === 1 ? [] : globalRows),
      };
    });

    const result = await buscarHistoricoFeedback(42, "B20");
    expect(result.length).toBe(1);
    expect(result[0]!.hashAlerta).toBe("ggg111");
  });

  it("combina feedbacks CID-10 e globais na mesma resposta", async () => {
    const cid10Rows = [
      {
        hashAlerta: "cid10_hash",
        feedbackMedico: "concordo",
        feedbackMotivo: null,
      },
    ];
    const globalRows = [
      {
        hashAlerta: "global_hash",
        feedbackMedico: "inaplicavel",
        feedbackMotivo: "motivo",
        cid10: "B20",
      },
    ];

    let callCount = 0;
    mockDb.select.mockImplementation(() => {
      callCount++;
      return {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi
          .fn()
          .mockResolvedValue(callCount === 1 ? cid10Rows : globalRows),
      };
    });

    const result = await buscarHistoricoFeedback(1, "B20");
    const hashes = result.map((r) => r.hashAlerta);
    expect(hashes).toContain("cid10_hash");
    expect(hashes).toContain("global_hash");
    expect(result.length).toBe(2);
  });

  it("preserva motivo e cid10Origem nos feedbacks globais", async () => {
    const globalRows = [
      {
        hashAlerta: "h1",
        feedbackMedico: "discordo",
        feedbackMotivo: "Resistência documentada",
        cid10: "B20",
      },
    ];

    let callCount = 0;
    mockDb.select.mockImplementation(() => {
      callCount++;
      return {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(callCount === 1 ? [] : globalRows),
      };
    });

    const result = await buscarHistoricoFeedback(1, "C00");
    expect(result[0]!.motivo).toBe("Resistência documentada");
    expect(result[0]!.cid10Origem).toBe("B20");
  });
});
