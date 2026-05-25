import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUpdate = vi.fn();
const mockTransaction = vi.fn();

vi.mock("./db.ts", () => ({
  db: {
    update: mockUpdate,
    transaction: mockTransaction,
  },
}));

vi.mock("../drizzle/schema.ts", () => ({
  exames: {},
  pacientes: {},
}));

vi.mock("./_core/logger.ts", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("../shared/security-constants.ts", () => ({
  EXAM_RULES: {
    AUTO_APPROVE_MIN_CONFIDENCE: 0.9,
    LOW_CONFIDENCE_THRESHOLD: 0.7,
  },
}));

vi.mock("drizzle-orm", () => ({ eq: vi.fn() }));

describe("processarResultadoIa", () => {
  const logCtx = { exameId: 1, requestId: "req-1" };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });
    mockTransaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<void>) => {
        const tx = {
          update: vi.fn().mockReturnValue({
            set: vi
              .fn()
              .mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
          }),
        };
        return fn(tx);
      },
    );
  });

  it("aprova automaticamente quando nao_reagente com alta confiança", async () => {
    const { processarResultadoIa } = await import("./examApprovalService.ts");
    const resultado = {
      tipoExame: "hiv" as const,
      resultado: "nao_reagente" as const,
      confianca: 0.95,
      status: "pendente" as const,
      processadoEm: new Date().toISOString(),
    };

    const final = await processarResultadoIa(1, 10, resultado, logCtx);

    expect(final.status).toBe("aprovado_automaticamente");
    expect(mockTransaction).toHaveBeenCalledOnce();
  });

  it("rejeita quando resultado é reagente", async () => {
    vi.resetModules();
    const { processarResultadoIa } = await import("./examApprovalService.ts");
    const resultado = {
      tipoExame: "hiv" as const,
      resultado: "reagente" as const,
      confianca: 0.95,
      status: "pendente" as const,
      processadoEm: new Date().toISOString(),
    };

    const final = await processarResultadoIa(1, 10, resultado, logCtx);

    expect(final.status).toBe("rejeitado_ia");
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("rejeita quando confiança abaixo do threshold", async () => {
    vi.resetModules();
    const { processarResultadoIa } = await import("./examApprovalService.ts");
    const resultado = {
      tipoExame: "hiv" as const,
      resultado: "nao_reagente" as const,
      confianca: 0.5, // below LOW_CONFIDENCE_THRESHOLD
      status: "pendente" as const,
      processadoEm: new Date().toISOString(),
    };

    const final = await processarResultadoIa(1, 10, resultado, logCtx);

    expect(final.status).toBe("rejeitado_ia");
  });

  it("marca como pendente_revisao para resultado inconclusivo", async () => {
    vi.resetModules();
    const { processarResultadoIa } = await import("./examApprovalService.ts");
    const resultado = {
      tipoExame: "hiv" as const,
      resultado: "inconclusivo" as const,
      confianca: 0.8, // between thresholds — neither auto-approve nor reject
      status: "pendente" as const,
      processadoEm: new Date().toISOString(),
    };

    const final = await processarResultadoIa(1, 10, resultado, logCtx);

    expect(final.status).toBe("pendente_revisao");
  });

  it("nao_reagente com confiança baixa vai para rejeitado_ia (não aprovado)", async () => {
    vi.resetModules();
    const { processarResultadoIa } = await import("./examApprovalService.ts");
    const resultado = {
      tipoExame: "hiv" as const,
      resultado: "nao_reagente" as const,
      confianca: 0.65, // below LOW_CONFIDENCE_THRESHOLD
      status: "pendente" as const,
      processadoEm: new Date().toISOString(),
    };

    const final = await processarResultadoIa(1, 10, resultado, logCtx);

    expect(final.status).toBe("rejeitado_ia");
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
