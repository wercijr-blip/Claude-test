import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const { dbSelectWhereFn, dbInsertValuesFn } = vi.hoisted(() => {
  // Returns a thenable that also has a .limit() method, so it can be awaited
  // directly (exames, pdfs) OR awaited via .limit() (pacientes, tcleAssinaturas).
  const makeQueryResult = (val: unknown[]) => {
    const p = Promise.resolve(val) as Promise<unknown[]> & {
      limit: ReturnType<typeof vi.fn>;
    };
    p.limit = vi.fn().mockResolvedValue(val);
    return p;
  };

  const dbSelectWhereFn = vi.fn().mockImplementation(() => makeQueryResult([]));
  const dbInsertValuesFn = vi.fn().mockResolvedValue([]);

  return { dbSelectWhereFn, dbInsertValuesFn };
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
        where: dbSelectWhereFn,
      }),
    }),
    insert: () => ({
      values: dbInsertValuesFn,
    }),
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

vi.mock("./_core/audit.ts", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const patientCtx = {
  session: {
    type: "patient" as const,
    tokenId: 1,
    pacienteId: 42,
  },
  req: { ip: "127.0.0.1", headers: {} } as never,
};

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

function makePaciente(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    cpfEncrypted: "cpf-enc",
    nomeEncrypted: "nome-enc",
    dataNascimentoEncrypted: "dn-enc",
    nomeMaeEncrypted: "mae-enc",
    emailEncrypted: "email-enc",
    telefoneEncrypted: "tel-enc",
    cns: null,
    sexo: "masculino",
    nomeSocial: null,
    corRaca: null,
    escolaridade: null,
    cep: null,
    logradouro: null,
    numero: null,
    complemento: null,
    bairro: null,
    cidade: null,
    estado: null,
    tipoAtendimento: "particular",
    status: "em_revisao",
    retentionUntil: null,
    createdAt: new Date("2025-01-01"),
    ...overrides,
  };
}

function makeExame() {
  return {
    tipoExame: "hiv",
    nomeArquivo: "exame.pdf",
    mimeType: "application/pdf",
    createdAt: new Date("2025-01-01"),
    resultadoIa: { status: "aprovado" },
  };
}

function makeTcle() {
  return {
    signedAt: new Date("2025-01-02"),
    ipAddress: "127.0.0.1",
    pacienteId: 42,
  };
}

function makePdf() {
  return {
    tipo: "prescricao",
    assinadoEm: new Date("2025-01-03"),
    createdAt: new Date("2025-01-03"),
  };
}

// ── Tests: meRouter.exportData ────────────────────────────────────────────────

describe("meRouter.exportData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to default empty result
    const makeQueryResult = (val: unknown[]) => {
      const p = Promise.resolve(val) as Promise<unknown[]> & {
        limit: ReturnType<typeof vi.fn>;
      };
      p.limit = vi.fn().mockResolvedValue(val);
      return p;
    };
    dbSelectWhereFn.mockImplementation(() => makeQueryResult([]));
  });

  it("lança FORBIDDEN para sessão staff (type !== patient)", async () => {
    const { meRouter } = await import("./routes/me.ts");
    const caller = meRouter.createCaller(staffCtx);
    await expect(caller.exportData()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("lança NOT_FOUND quando paciente não existe no banco", async () => {
    const { meRouter } = await import("./routes/me.ts");

    // All 4 queries return empty — paciente[0] will be undefined
    const makeEmpty = () => {
      const p = Promise.resolve([]) as Promise<unknown[]> & {
        limit: ReturnType<typeof vi.fn>;
      };
      p.limit = vi.fn().mockResolvedValue([]);
      return p;
    };
    dbSelectWhereFn.mockImplementation(() => makeEmpty());

    const caller = meRouter.createCaller(patientCtx);
    await expect(caller.exportData()).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("retorna dados descriptografados com shape correto quando paciente existe", async () => {
    const { meRouter } = await import("./routes/me.ts");

    const paciente = makePaciente();
    const exame = makeExame();
    const tcle = makeTcle();
    const pdf = makePdf();

    // The 4 Promise.all calls hit dbSelectWhereFn in order:
    // 1st call → paciente (with .limit(1))
    // 2nd call → exames (awaited directly)
    // 3rd call → tcleAssinaturas (with .limit(1))
    // 4th call → pdfs (awaited directly)
    let callCount = 0;
    dbSelectWhereFn.mockImplementation(() => {
      callCount++;
      const idx = callCount;
      let data: unknown[];
      if (idx === 1) data = [paciente];
      else if (idx === 2) data = [exame];
      else if (idx === 3) data = [tcle];
      else data = [pdf];

      const p = Promise.resolve(data) as Promise<unknown[]> & {
        limit: ReturnType<typeof vi.fn>;
      };
      p.limit = vi.fn().mockResolvedValue(data);
      return p;
    });

    const caller = meRouter.createCaller(patientCtx);
    const result = await caller.exportData();

    expect(result).toMatchObject({
      legalBasis: "LGPD Art. 18, I — Direito de acesso ao titular",
      dados: {
        cpf: "dec:cpf-enc",
        nome: "dec:nome-enc",
        dataNascimento: "dec:dn-enc",
        nomeMae: "dec:mae-enc",
        email: "dec:email-enc",
        telefone: "dec:tel-enc",
        status: "em_revisao",
        tipoAtendimento: "particular",
      },
    });

    expect(result.exportedAt).toBeDefined();
    expect(typeof result.exportedAt).toBe("string");

    expect(result.exames).toHaveLength(1);
    expect(result.exames[0]).toMatchObject({
      tipoExame: "hiv",
      nomeArquivo: "exame.pdf",
      mimeType: "application/pdf",
    });

    expect(result.tcle).toMatchObject({
      ipAddress: "127.0.0.1",
    });

    expect(result.pdfsGerados).toHaveLength(1);
    expect(result.pdfsGerados[0]).toMatchObject({
      tipo: "prescricao",
    });
  });

  it("retorna tcle:null quando nenhum TCLE foi assinado", async () => {
    const { meRouter } = await import("./routes/me.ts");

    const paciente = makePaciente();
    let callCount = 0;
    dbSelectWhereFn.mockImplementation(() => {
      callCount++;
      const idx = callCount;
      let data: unknown[];
      if (idx === 1) data = [paciente];
      else if (idx === 2) data = [];
      else if (idx === 3)
        data = []; // no tcle
      else data = [];

      const p = Promise.resolve(data) as Promise<unknown[]> & {
        limit: ReturnType<typeof vi.fn>;
      };
      p.limit = vi.fn().mockResolvedValue(data);
      return p;
    });

    const caller = meRouter.createCaller(patientCtx);
    const result = await caller.exportData();
    expect(result.tcle).toBeNull();
    expect(result.exames).toEqual([]);
    expect(result.pdfsGerados).toEqual([]);
  });
});

// ── Tests: meRouter.requestAnonymization ─────────────────────────────────────

describe("meRouter.requestAnonymization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lança FORBIDDEN para sessão staff", async () => {
    const { meRouter } = await import("./routes/me.ts");
    const caller = meRouter.createCaller(staffCtx);
    await expect(caller.requestAnonymization({})).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("retorna ok:true com dpoEmail para paciente autenticado", async () => {
    const { meRouter } = await import("./routes/me.ts");
    const caller = meRouter.createCaller(patientCtx);
    const result = await caller.requestAnonymization({});

    expect(result).toMatchObject({
      ok: true,
      dpoEmail: "dpo@facilitaprep.com.br",
    });
    expect(typeof result.message).toBe("string");
    expect(result.message.length).toBeGreaterThan(0);
  });

  it("aceita motivo opcional na solicitação", async () => {
    const { meRouter } = await import("./routes/me.ts");
    const caller = meRouter.createCaller(patientCtx);
    const result = await caller.requestAnonymization({
      motivo: "Não desejo mais participar",
    });

    expect(result.ok).toBe(true);
  });

  it("logAudit é chamado com action paciente.anonymize_request", async () => {
    const { meRouter } = await import("./routes/me.ts");
    const { logAudit } = await import("./_core/audit.ts");

    const caller = meRouter.createCaller(patientCtx);
    await caller.requestAnonymization({ motivo: "Teste" });

    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "paciente.anonymize_request",
        resourceType: "paciente",
        resourceId: 42,
      }),
    );
  });
});
