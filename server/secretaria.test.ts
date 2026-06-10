import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const {
  dbSelectLimitFn,
  dbSelectOrderByLimitFn,
  dbSelectLimit500Fn,
  dbUpdateWhereFn,
  gerarEEnviarLinkAcessoFn,
  generateTokenFn,
  hashTokenFn,
} = vi.hoisted(() => {
  const dbSelectLimitFn = vi.fn().mockResolvedValue([]);
  const dbSelectOrderByLimitFn = vi.fn().mockResolvedValue([]);
  const dbSelectLimit500Fn = vi.fn().mockResolvedValue([]);
  const dbUpdateWhereFn = vi.fn().mockResolvedValue([]);
  const gerarEEnviarLinkAcessoFn = vi.fn().mockResolvedValue(undefined);
  const generateTokenFn = vi.fn().mockReturnValue("raw-token-abc123");
  const hashTokenFn = vi.fn().mockReturnValue("hashed-token-abc123");

  return {
    dbSelectLimitFn,
    dbSelectOrderByLimitFn,
    dbSelectLimit500Fn,
    dbUpdateWhereFn,
    gerarEEnviarLinkAcessoFn,
    generateTokenFn,
    hashTokenFn,
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
        leftJoin: () => ({
          orderBy: () => ({ limit: dbSelectLimit500Fn }),
        }),
      }),
    }),
    update: () => ({ set: () => ({ where: dbUpdateWhereFn }) }),
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

vi.mock("./routes/intake.ts", () => ({
  gerarEEnviarLinkAcesso: gerarEEnviarLinkAcessoFn,
}));

vi.mock("./_core/tokenUtils.ts", () => ({
  generateToken: generateTokenFn,
  hashToken: hashTokenFn,
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const staffCtx = {
  session: {
    type: "staff" as const,
    id: 1,
    openId: "t",
    nome: "T",
    email: null,
    role: "secretaria" as const,
    totpEnabled: false,
  },
  req: {} as never,
};

function makeExameRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    pacienteId: 1,
    nomeArquivo: "exame.pdf",
    tipoExame: "hiv",
    mimeType: "application/pdf",
    resultadoIa: { status: "pendente" },
    revisadoPorId: null,
    revisadoEm: null,
    liberadoPorMedicoId: null,
    liberadoEm: null,
    createdAt: new Date("2025-01-01"),
    pacienteNomeEncrypted: "nome-enc",
    pacienteEmailEncrypted: "email-enc",
    pacienteStatus: "em_revisao",
    pacienteTipoAtendimento: "particular",
    ...overrides,
  };
}

// ── Tests: secretariaRouter.listarDocumentos ──────────────────────────────────

describe("secretariaRouter.listarDocumentos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbSelectLimit500Fn.mockResolvedValue([]);
  });

  it("retorna array vazio quando não há documentos (default - todos)", async () => {
    const { secretariaRouter } = await import("./routes/secretaria.ts");
    const caller = secretariaRouter.createCaller(staffCtx);
    const result = await caller.listarDocumentos();
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it("retorna documentos com shape correto após descriptografia", async () => {
    const { secretariaRouter } = await import("./routes/secretaria.ts");
    const row = makeExameRow({ resultadoIa: { status: "aprovado" } });
    dbSelectLimit500Fn.mockResolvedValue([row]);

    const caller = secretariaRouter.createCaller(staffCtx);
    const result = await caller.listarDocumentos({ status: "todos" });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 10,
      pacienteId: 1,
      nomeArquivo: "exame.pdf",
      tipoExame: "hiv",
      paciente: {
        nome: "dec:nome-enc",
        email: "dec:email-enc",
        status: "em_revisao",
        tipoAtendimento: "particular",
      },
    });
  });

  it("filtra por status 'pendente' — retorna apenas exames pendentes", async () => {
    const { secretariaRouter } = await import("./routes/secretaria.ts");
    const pendente = makeExameRow({ resultadoIa: { status: "pendente" } });
    const aprovado = makeExameRow({
      id: 11,
      resultadoIa: { status: "aprovado" },
    });
    dbSelectLimit500Fn.mockResolvedValue([pendente, aprovado]);

    const caller = secretariaRouter.createCaller(staffCtx);
    const result = await caller.listarDocumentos({ status: "pendente" });

    expect(result).toHaveLength(1);
    expect((result[0].resultadoIa as { status: string }).status).toBe(
      "pendente",
    );
  });

  it("tryDecrypt trata pacienteNomeEncrypted null sem lançar exceção", async () => {
    const { secretariaRouter } = await import("./routes/secretaria.ts");
    const row = makeExameRow({
      pacienteNomeEncrypted: null,
      pacienteEmailEncrypted: null,
    });
    dbSelectLimit500Fn.mockResolvedValue([row]);

    const caller = secretariaRouter.createCaller(staffCtx);
    const result = await caller.listarDocumentos();

    expect(result).toHaveLength(1);
    expect(result[0].paciente.nome).toBeNull();
    expect(result[0].paciente.email).toBeNull();
  });

  it("filtra por status 'validado' corretamente", async () => {
    const { secretariaRouter } = await import("./routes/secretaria.ts");
    const aprovadoAuto = makeExameRow({
      resultadoIa: { status: "aprovado_automaticamente" },
    });
    const pendente = makeExameRow({
      id: 12,
      resultadoIa: { status: "pendente" },
    });
    dbSelectLimit500Fn.mockResolvedValue([aprovadoAuto, pendente]);

    const caller = secretariaRouter.createCaller(staffCtx);
    const result = await caller.listarDocumentos({ status: "validado" });

    expect(result).toHaveLength(1);
    expect((result[0].resultadoIa as { status: string }).status).toBe(
      "aprovado_automaticamente",
    );
  });
});

// ── Tests: secretariaRouter.reenviarLink ─────────────────────────────────────

describe("secretariaRouter.reenviarLink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbSelectLimitFn.mockResolvedValue([]);
    gerarEEnviarLinkAcessoFn.mockResolvedValue(undefined);
    generateTokenFn.mockReturnValue("raw-token-abc123");
    hashTokenFn.mockReturnValue("hashed-token-abc123");
    dbUpdateWhereFn.mockResolvedValue([]);
  });

  it("tokenId tem precadastro → chama gerarEEnviarLinkAcesso e retorna {ok:true, link:null}", async () => {
    const { secretariaRouter } = await import("./routes/secretaria.ts");

    // First dbSelectLimitFn call → precadastro found
    dbSelectLimitFn.mockResolvedValueOnce([{ id: 5 }]);

    const caller = secretariaRouter.createCaller(staffCtx);
    const result = await caller.reenviarLink({ tokenId: 1 });

    expect(gerarEEnviarLinkAcessoFn).toHaveBeenCalledWith(5);
    expect(result).toEqual({ ok: true, link: null });
  });

  it("sem precadastro mas token direto existe → rotaciona hash e retorna link", async () => {
    const { secretariaRouter } = await import("./routes/secretaria.ts");

    // First call → no precadastro
    dbSelectLimitFn.mockResolvedValueOnce([]);
    // Second call → direct token found
    dbSelectLimitFn.mockResolvedValueOnce([
      { expiresAt: new Date("2030-01-01") },
    ]);

    const caller = secretariaRouter.createCaller(staffCtx);
    const result = await caller.reenviarLink({ tokenId: 7 });

    expect(dbUpdateWhereFn).toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: true,
      link: "https://facilitaprep.com.br/acesso/raw-token-abc123",
    });
  });

  it("tokenId não encontrado em accessTokens → lança NOT_FOUND", async () => {
    const { secretariaRouter } = await import("./routes/secretaria.ts");

    // First call → no precadastro
    dbSelectLimitFn.mockResolvedValueOnce([]);
    // Second call → no token
    dbSelectLimitFn.mockResolvedValueOnce([]);

    const caller = secretariaRouter.createCaller(staffCtx);
    await expect(caller.reenviarLink({ tokenId: 999 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("lança erro de validação para tokenId inválido (não positivo)", async () => {
    const { secretariaRouter } = await import("./routes/secretaria.ts");

    const caller = secretariaRouter.createCaller(staffCtx);
    await expect(caller.reenviarLink({ tokenId: 0 })).rejects.toThrow();
  });
});
