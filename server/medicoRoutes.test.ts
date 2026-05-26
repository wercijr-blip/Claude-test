import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks (defined before vi.mock calls are evaluated) ───────────────
const {
  txSelectLimitFn,
  txUpdateWhereFn,
  dbSelectLimitFn,
  dbSelectOrderByLimitFn,
  dbUpdateWhereFn,
  dbTransactionFn,
} = vi.hoisted(() => {
  const txSelectLimitFn = vi.fn().mockResolvedValue([]);
  const txUpdateWhereFn = vi.fn().mockResolvedValue([]);
  const dbSelectLimitFn = vi.fn().mockResolvedValue([]);
  const dbSelectOrderByLimitFn = vi.fn().mockResolvedValue([]);
  const dbUpdateWhereFn = vi.fn().mockResolvedValue([]);

  const dbTransactionFn = vi
    .fn()
    .mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        select: () => ({
          from: () => ({ where: () => ({ limit: txSelectLimitFn }) }),
        }),
        update: () => ({ set: () => ({ where: txUpdateWhereFn }) }),
      }),
    );

  return {
    txSelectLimitFn,
    txUpdateWhereFn,
    dbSelectLimitFn,
    dbSelectOrderByLimitFn,
    dbUpdateWhereFn,
    dbTransactionFn,
  };
});

vi.mock("./_core/env.ts", () => ({
  env: {
    NODE_ENV: "test",
    JWT_SECRET: "test-secret-with-at-least-32-chars-here",
    ENCRYPTION_KEY: "a".repeat(64),
    CPF_HASH_SALT: "test-salt-with-at-least-32-chars-here",
    OAUTH_SERVER_URL: "https://oauth.example.com",
    OWNER_OPEN_ID: "owner-id",
    VITE_APP_ID: "facilita-prep",
    AWS_ACCESS_KEY_ID: "key",
    AWS_SECRET_ACCESS_KEY: "secret",
    AWS_REGION: "sa-east-1",
    AWS_S3_BUCKET: "bucket",
    REDIS_URL: "redis://localhost:6379",
    ASAAS_ENV: "sandbox",
    BUILT_IN_FORGE_API_URL: "https://api.anthropic.com",
    APP_URL: "https://facilitaprep.com.br",
    PORT: 3000,
  },
}));

vi.mock("./db.ts", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: dbSelectLimitFn,
          orderBy: () => ({ limit: dbSelectOrderByLimitFn }),
        }),
      }),
    }),
    update: () => ({ set: () => ({ where: dbUpdateWhereFn }) }),
    transaction: dbTransactionFn,
  },
}));

vi.mock("./_core/encryption.ts", () => ({
  decrypt: (s: string) => `dec:${s}`,
  encrypt: (s: string) => `enc:${s}`,
  hashCpf: vi.fn(),
}));

vi.mock("./_core/logger.ts", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ── Fixtures ─────────────────────────────────────────────────────────────────

const medicoCtx = {
  session: {
    type: "staff" as const,
    id: 1,
    openId: "test",
    nome: "Dr. A",
    email: null,
    role: "medico" as const,
    totpEnabled: true,
  },
  req: {} as never,
};

const adminCtx = {
  session: {
    type: "staff" as const,
    id: 99,
    openId: "admin",
    nome: "Admin",
    email: null,
    role: "admin" as const,
    totpEnabled: true,
  },
  req: {} as never,
};

function makePaciente(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    medicoId: null,
    status: "em_revisao",
    nomeEncrypted: "enc",
    cpfEncrypted: "enc",
    dataNascimentoEncrypted: null,
    nomeMaeEncrypted: null,
    emailEncrypted: null,
    telefoneEncrypted: null,
    tipoAtendimento: "particular",
    currentStep: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    observacoesMedico: null,
    sexo: "masculino",
    cidade: null,
    estado: null,
    condutaJson: null,
    tokenId: null,
    retentionUntil: null,
    ...overrides,
  };
}

function makeExame(statusIa: string) {
  return {
    id: 10,
    pacienteId: 1,
    s3Key: "key",
    nomeArquivo: "exame.pdf",
    tipoExame: "hiv",
    mimeType: "application/pdf",
    tamanhoBytes: 1024,
    resultadoIa: {
      status: statusIa,
      tipoExame: "hiv",
      resultado: "reagente",
      confianca: 0.9,
      processadoEm: "2026-01-01T00:00:00Z",
    },
    revisadoPorId: null,
    revisadoEm: null,
    liberadoPorMedicoId: null,
    liberadoEm: null,
    createdAt: new Date(),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("medicoRouter.aprovar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lança FORBIDDEN quando paciente está bloqueado por outro médico", async () => {
    const { medicoRouter } = await import("./routes/medico.ts");
    txSelectLimitFn.mockResolvedValue([makePaciente({ medicoId: 999 })]);

    const caller = medicoRouter.createCaller(medicoCtx);
    await expect(caller.aprovar({ pacienteId: 1 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("admin pode aprovar paciente bloqueado por outro médico", async () => {
    const { medicoRouter } = await import("./routes/medico.ts");
    txSelectLimitFn.mockResolvedValue([makePaciente({ medicoId: 999 })]);
    txUpdateWhereFn.mockResolvedValue([]);

    const caller = medicoRouter.createCaller(adminCtx);
    await expect(caller.aprovar({ pacienteId: 1 })).resolves.not.toThrow();
  });

  it("lança NOT_FOUND quando paciente não existe", async () => {
    const { medicoRouter } = await import("./routes/medico.ts");
    txSelectLimitFn.mockResolvedValueOnce([]);

    const caller = medicoRouter.createCaller(medicoCtx);
    await expect(caller.aprovar({ pacienteId: 999 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("chama UPDATE quando médico correto", async () => {
    const { medicoRouter } = await import("./routes/medico.ts");
    txSelectLimitFn.mockResolvedValue([makePaciente({ medicoId: 1 })]);
    txUpdateWhereFn.mockResolvedValue([]);

    const caller = medicoRouter.createCaller(medicoCtx);
    await caller.aprovar({ pacienteId: 1, observacoes: "ok" });
    expect(txUpdateWhereFn).toHaveBeenCalled();
  });
});

describe("medicoRouter.rejeitar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lança FORBIDDEN quando paciente está bloqueado por outro médico", async () => {
    const { medicoRouter } = await import("./routes/medico.ts");
    txSelectLimitFn.mockResolvedValueOnce([makePaciente({ medicoId: 42 })]);

    const caller = medicoRouter.createCaller(medicoCtx);
    await expect(
      caller.rejeitar({
        pacienteId: 1,
        motivo: "Motivo detalhado de rejeição",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("lança erro de validação se motivo tem menos de 10 chars", async () => {
    const { medicoRouter } = await import("./routes/medico.ts");

    const caller = medicoRouter.createCaller(medicoCtx);
    await expect(
      caller.rejeitar({ pacienteId: 1, motivo: "curto" }),
    ).rejects.toThrow();
  });
});

describe("medicoRouter.liberarExameSemValidacao", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lança NOT_FOUND quando exame não existe", async () => {
    const { medicoRouter } = await import("./routes/medico.ts");
    dbSelectLimitFn.mockResolvedValueOnce([]);

    const caller = medicoRouter.createCaller(medicoCtx);
    await expect(
      caller.liberarExameSemValidacao({ exameId: 999 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("lança BAD_REQUEST para status aprovado_automaticamente", async () => {
    const { medicoRouter } = await import("./routes/medico.ts");
    dbSelectLimitFn.mockResolvedValueOnce([
      makeExame("aprovado_automaticamente"),
    ]);

    const caller = medicoRouter.createCaller(medicoCtx);
    await expect(
      caller.liberarExameSemValidacao({ exameId: 10 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("lança BAD_REQUEST para status liberado_manualmente (já liberado)", async () => {
    const { medicoRouter } = await import("./routes/medico.ts");
    dbSelectLimitFn.mockResolvedValueOnce([makeExame("liberado_manualmente")]);

    const caller = medicoRouter.createCaller(medicoCtx);
    await expect(
      caller.liberarExameSemValidacao({ exameId: 10 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it.each(["rejeitado_ia", "rejeitado", "pendente_revisao"])(
    "libera exame com status %s sem erro",
    async (status) => {
      const { medicoRouter } = await import("./routes/medico.ts");
      dbSelectLimitFn.mockResolvedValueOnce([makeExame(status)]);
      dbUpdateWhereFn.mockResolvedValueOnce([]);

      const caller = medicoRouter.createCaller(medicoCtx);
      await expect(
        caller.liberarExameSemValidacao({ exameId: 10, observacoes: "ok" }),
      ).resolves.not.toThrow();
      expect(dbUpdateWhereFn).toHaveBeenCalled();
    },
  );
});

describe("medicoRouter.listarExamesRejeitadosIa", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna lista de exames da query SQL", async () => {
    const { medicoRouter } = await import("./routes/medico.ts");
    const fakeExames = [
      makeExame("rejeitado_ia"),
      makeExame("pendente_revisao"),
    ];
    dbSelectOrderByLimitFn.mockResolvedValueOnce(fakeExames);

    const caller = medicoRouter.createCaller(medicoCtx);
    const result = await caller.listarExamesRejeitadosIa();
    expect(result).toEqual(fakeExames);
  });

  it("retorna lista vazia sem erro", async () => {
    const { medicoRouter } = await import("./routes/medico.ts");
    dbSelectOrderByLimitFn.mockResolvedValueOnce([]);

    const caller = medicoRouter.createCaller(medicoCtx);
    const result = await caller.listarExamesRejeitadosIa();
    expect(result).toEqual([]);
  });
});
