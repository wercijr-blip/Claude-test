import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";
import { createHash } from "crypto";

// ── Hoisted mocks (defined before vi.mock calls are evaluated) ───────────────
const { dbSelectLimitFn, dbUpdateWhereFn } = vi.hoisted(() => {
  return {
    dbSelectLimitFn: vi.fn().mockResolvedValue([]),
    dbUpdateWhereFn: vi.fn().mockResolvedValue([]),
  };
});

vi.mock("./_core/env.ts", () => ({
  env: {
    NODE_ENV: "test",
    JWT_SECRET: "test-secret-with-at-least-32-chars-here-x",
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

vi.mock("./_core/audit.ts", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./_core/logger.ts", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("otplib", () => ({
  generateSecret: vi.fn().mockReturnValue("TESTSECRET"),
  generateURI: vi.fn().mockReturnValue("otpauth://totp/test"),
  verifySync: vi.fn().mockReturnValue({ valid: true }),
}));

vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,mock"),
  },
}));

vi.mock("jose", () => ({
  SignJWT: vi.fn().mockImplementation(() => ({
    setProtectedHeader: vi.fn().mockReturnThis(),
    setSubject: vi.fn().mockReturnThis(),
    setIssuedAt: vi.fn().mockReturnThis(),
    setExpirationTime: vi.fn().mockReturnThis(),
    sign: vi.fn().mockResolvedValue("mock.jwt.token"),
  })),
  jwtVerify: vi.fn().mockResolvedValue({
    payload: { type: "pending_2fa", userId: 1 },
  }),
}));

// ── Context fixtures ──────────────────────────────────────────────────────────

const mockReq = { ip: "127.0.0.1", headers: {} } as never;

const staffCtx = {
  session: {
    type: "staff" as const,
    id: 1,
    openId: "test",
    nome: "Test",
    email: null,
    role: "medico" as const,
    totpEnabled: true,
  },
  req: mockReq,
};

const adminCtx = {
  session: {
    type: "staff" as const,
    id: 1,
    openId: "test",
    nome: "Admin",
    email: null,
    role: "admin" as const,
    totpEnabled: true,
  },
  req: mockReq,
};

const secretariaCtx = {
  session: {
    type: "staff" as const,
    id: 2,
    openId: "sec",
    nome: "Sec",
    email: null,
    role: "secretaria" as const,
    totpEnabled: false,
  },
  req: mockReq,
};

const publicCtx = {
  session: null,
  req: mockReq,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const JWT_SECRET_MOCK = "test-secret-with-at-least-32-chars-here-x";

function hashBackupCodeForTest(code: string): string {
  return createHash("sha256")
    .update(code + JWT_SECRET_MOCK)
    .digest("hex");
}

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    openId: "test",
    nome: "Test User",
    email: null,
    role: "medico",
    ativo: true,
    totpEnabled: true,
    totpSecretEncrypted: "enc:TESTSECRET",
    totpBackupCodes: [] as string[],
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ── Tests: setup ─────────────────────────────────────────────────────────────

describe("twoFactorRouter.setup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbSelectLimitFn.mockResolvedValue([]);
  });

  it("lança FORBIDDEN quando role é secretaria", async () => {
    const { twoFactorRouter } = await import("./routes/twoFactor.ts");
    const caller = twoFactorRouter.createCaller(secretariaCtx);
    await expect(caller.setup()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("retorna qrDataUrl e secret para médico", async () => {
    const { twoFactorRouter } = await import("./routes/twoFactor.ts");
    dbUpdateWhereFn.mockResolvedValue([]);

    const caller = twoFactorRouter.createCaller(staffCtx);
    const result = await caller.setup();

    expect(result).toHaveProperty("qrDataUrl");
    expect(result).toHaveProperty("secret");
    expect(result.qrDataUrl).toBe("data:image/png;base64,mock");
    expect(result.secret).toBe("TESTSECRET");
  });

  it("retorna qrDataUrl e secret para admin", async () => {
    const { twoFactorRouter } = await import("./routes/twoFactor.ts");
    dbUpdateWhereFn.mockResolvedValue([]);

    const caller = twoFactorRouter.createCaller(adminCtx);
    const result = await caller.setup();

    expect(result).toHaveProperty("qrDataUrl");
    expect(result).toHaveProperty("secret");
    expect(result.secret).toBe("TESTSECRET");
  });

  it("chama db.update após gerar segredo", async () => {
    const { twoFactorRouter } = await import("./routes/twoFactor.ts");
    dbUpdateWhereFn.mockResolvedValue([]);

    const caller = twoFactorRouter.createCaller(staffCtx);
    await caller.setup();

    expect(dbUpdateWhereFn).toHaveBeenCalled();
  });

  it("lança UNAUTHORIZED para contexto público (sem sessão)", async () => {
    const { twoFactorRouter } = await import("./routes/twoFactor.ts");
    const caller = twoFactorRouter.createCaller(publicCtx);
    await expect(caller.setup()).rejects.toThrow(TRPCError);
  });
});

// ── Tests: confirm ────────────────────────────────────────────────────────────

describe("twoFactorRouter.confirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbSelectLimitFn.mockResolvedValue([]);
  });

  it("lança BAD_REQUEST quando usuário não tem totpSecretEncrypted", async () => {
    const { twoFactorRouter } = await import("./routes/twoFactor.ts");
    dbSelectLimitFn.mockResolvedValue([
      makeUser({ totpSecretEncrypted: null }),
    ]);

    const caller = twoFactorRouter.createCaller(staffCtx);
    await expect(caller.confirm({ code: "123456" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("lança BAD_REQUEST quando usuário não é encontrado (sem totpSecretEncrypted)", async () => {
    const { twoFactorRouter } = await import("./routes/twoFactor.ts");
    dbSelectLimitFn.mockResolvedValue([]);

    const caller = twoFactorRouter.createCaller(staffCtx);
    await expect(caller.confirm({ code: "123456" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("lança BAD_REQUEST quando código TOTP é inválido", async () => {
    const { verifySync } = await import("otplib");
    vi.mocked(verifySync).mockReturnValueOnce({ valid: false } as ReturnType<
      typeof verifySync
    >);

    const { twoFactorRouter } = await import("./routes/twoFactor.ts");
    dbSelectLimitFn.mockResolvedValue([makeUser()]);

    const caller = twoFactorRouter.createCaller(staffCtx);
    await expect(caller.confirm({ code: "000000" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("retorna array de 8 backupCodes em caso de sucesso", async () => {
    const { verifySync } = await import("otplib");
    vi.mocked(verifySync).mockReturnValue({ valid: true } as ReturnType<
      typeof verifySync
    >);

    const { twoFactorRouter } = await import("./routes/twoFactor.ts");
    dbSelectLimitFn.mockResolvedValue([makeUser()]);
    dbUpdateWhereFn.mockResolvedValue([]);

    const caller = twoFactorRouter.createCaller(staffCtx);
    const result = await caller.confirm({ code: "123456" });

    expect(result).toHaveProperty("backupCodes");
    expect(Array.isArray(result.backupCodes)).toBe(true);
    expect(result.backupCodes).toHaveLength(8);
  });

  it("cada backup code tem formato XXXX-XXXX", async () => {
    const { verifySync } = await import("otplib");
    vi.mocked(verifySync).mockReturnValue({ valid: true } as ReturnType<
      typeof verifySync
    >);

    const { twoFactorRouter } = await import("./routes/twoFactor.ts");
    dbSelectLimitFn.mockResolvedValue([makeUser()]);
    dbUpdateWhereFn.mockResolvedValue([]);

    const caller = twoFactorRouter.createCaller(staffCtx);
    const result = await caller.confirm({ code: "123456" });

    for (const code of result.backupCodes) {
      expect(code).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}$/);
    }
  });

  it("chama db.update para salvar totpEnabled=true e backup codes", async () => {
    const { verifySync } = await import("otplib");
    vi.mocked(verifySync).mockReturnValue({ valid: true } as ReturnType<
      typeof verifySync
    >);

    const { twoFactorRouter } = await import("./routes/twoFactor.ts");
    dbSelectLimitFn.mockResolvedValue([makeUser()]);
    dbUpdateWhereFn.mockResolvedValue([]);

    const caller = twoFactorRouter.createCaller(staffCtx);
    await caller.confirm({ code: "123456" });

    expect(dbUpdateWhereFn).toHaveBeenCalled();
  });

  it("lança UNAUTHORIZED para contexto público", async () => {
    const { twoFactorRouter } = await import("./routes/twoFactor.ts");
    const caller = twoFactorRouter.createCaller(publicCtx);
    await expect(caller.confirm({ code: "123456" })).rejects.toThrow(TRPCError);
  });
});

// ── Tests: verify ─────────────────────────────────────────────────────────────

describe("twoFactorRouter.verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbSelectLimitFn.mockResolvedValue([]);
  });

  it("lança UNAUTHORIZED quando JWT é inválido", async () => {
    const { jwtVerify } = await import("jose");
    vi.mocked(jwtVerify).mockRejectedValueOnce(new Error("invalid token"));

    const { twoFactorRouter } = await import("./routes/twoFactor.ts");
    const caller = twoFactorRouter.createCaller(publicCtx);
    await expect(
      caller.verify({ pendingToken: "bad.token", code: "123456" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("lança UNAUTHORIZED quando payload.type não é pending_2fa", async () => {
    const { jwtVerify } = await import("jose");
    vi.mocked(jwtVerify).mockResolvedValueOnce({
      payload: { type: "staff", userId: 1 },
    } as Awaited<ReturnType<typeof jwtVerify>>);

    const { twoFactorRouter } = await import("./routes/twoFactor.ts");
    const caller = twoFactorRouter.createCaller(publicCtx);
    await expect(
      caller.verify({ pendingToken: "some.token", code: "123456" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("lança UNAUTHORIZED quando payload.userId não é número", async () => {
    const { jwtVerify } = await import("jose");
    vi.mocked(jwtVerify).mockResolvedValueOnce({
      payload: { type: "pending_2fa", userId: "not-a-number" },
    } as Awaited<ReturnType<typeof jwtVerify>>);

    const { twoFactorRouter } = await import("./routes/twoFactor.ts");
    const caller = twoFactorRouter.createCaller(publicCtx);
    await expect(
      caller.verify({ pendingToken: "some.token", code: "123456" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("lança UNAUTHORIZED quando usuário não é encontrado", async () => {
    const { jwtVerify } = await import("jose");
    vi.mocked(jwtVerify).mockResolvedValueOnce({
      payload: { type: "pending_2fa", userId: 1 },
    } as Awaited<ReturnType<typeof jwtVerify>>);
    dbSelectLimitFn.mockResolvedValueOnce([]);

    const { twoFactorRouter } = await import("./routes/twoFactor.ts");
    const caller = twoFactorRouter.createCaller(publicCtx);
    await expect(
      caller.verify({ pendingToken: "some.token", code: "123456" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("lança UNAUTHORIZED quando usuário está inativo", async () => {
    const { jwtVerify } = await import("jose");
    vi.mocked(jwtVerify).mockResolvedValueOnce({
      payload: { type: "pending_2fa", userId: 1 },
    } as Awaited<ReturnType<typeof jwtVerify>>);
    dbSelectLimitFn.mockResolvedValueOnce([makeUser({ ativo: false })]);

    const { twoFactorRouter } = await import("./routes/twoFactor.ts");
    const caller = twoFactorRouter.createCaller(publicCtx);
    await expect(
      caller.verify({ pendingToken: "some.token", code: "123456" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("lança UNAUTHORIZED quando usuário não tem totpEnabled", async () => {
    const { jwtVerify } = await import("jose");
    vi.mocked(jwtVerify).mockResolvedValueOnce({
      payload: { type: "pending_2fa", userId: 1 },
    } as Awaited<ReturnType<typeof jwtVerify>>);
    dbSelectLimitFn.mockResolvedValueOnce([
      makeUser({ totpEnabled: false, totpSecretEncrypted: null }),
    ]);

    const { twoFactorRouter } = await import("./routes/twoFactor.ts");
    const caller = twoFactorRouter.createCaller(publicCtx);
    await expect(
      caller.verify({ pendingToken: "some.token", code: "123456" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("lança UNAUTHORIZED quando usuário não tem totpSecretEncrypted", async () => {
    const { jwtVerify } = await import("jose");
    vi.mocked(jwtVerify).mockResolvedValueOnce({
      payload: { type: "pending_2fa", userId: 1 },
    } as Awaited<ReturnType<typeof jwtVerify>>);
    dbSelectLimitFn.mockResolvedValueOnce([
      makeUser({ totpEnabled: true, totpSecretEncrypted: null }),
    ]);

    const { twoFactorRouter } = await import("./routes/twoFactor.ts");
    const caller = twoFactorRouter.createCaller(publicCtx);
    await expect(
      caller.verify({ pendingToken: "some.token", code: "123456" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("lança UNAUTHORIZED quando código TOTP é inválido", async () => {
    const { jwtVerify } = await import("jose");
    vi.mocked(jwtVerify).mockResolvedValueOnce({
      payload: { type: "pending_2fa", userId: 1 },
    } as Awaited<ReturnType<typeof jwtVerify>>);
    dbSelectLimitFn.mockResolvedValueOnce([makeUser()]);

    const { verifySync } = await import("otplib");
    vi.mocked(verifySync).mockReturnValueOnce({ valid: false } as ReturnType<
      typeof verifySync
    >);

    const { twoFactorRouter } = await import("./routes/twoFactor.ts");
    const caller = twoFactorRouter.createCaller(publicCtx);
    await expect(
      caller.verify({ pendingToken: "some.token", code: "000000" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("retorna { token, role } com TOTP válido", async () => {
    const { jwtVerify } = await import("jose");
    vi.mocked(jwtVerify).mockResolvedValueOnce({
      payload: { type: "pending_2fa", userId: 1 },
    } as Awaited<ReturnType<typeof jwtVerify>>);
    dbSelectLimitFn.mockResolvedValueOnce([makeUser()]);

    const { verifySync } = await import("otplib");
    vi.mocked(verifySync).mockReturnValueOnce({ valid: true } as ReturnType<
      typeof verifySync
    >);

    const { twoFactorRouter } = await import("./routes/twoFactor.ts");
    const caller = twoFactorRouter.createCaller(publicCtx);
    const result = await caller.verify({
      pendingToken: "some.token",
      code: "123456",
    });

    expect(result).toHaveProperty("token");
    expect(result).toHaveProperty("role");
    expect(result.token).toBe("mock.jwt.token");
    expect(result.role).toBe("medico");
  });

  it("executa consumeBackupCode path com código de backup válido", async () => {
    const BACKUP_CODE_PLAIN = "ABCD-1234";
    const hashedCode = hashBackupCodeForTest(BACKUP_CODE_PLAIN.toUpperCase());

    const { jwtVerify } = await import("jose");
    vi.mocked(jwtVerify).mockResolvedValueOnce({
      payload: { type: "pending_2fa", userId: 1 },
    } as Awaited<ReturnType<typeof jwtVerify>>);

    dbSelectLimitFn.mockResolvedValueOnce([
      makeUser({
        totpBackupCodes: [hashedCode],
      }),
    ]);
    dbUpdateWhereFn.mockResolvedValue([]);

    const { twoFactorRouter } = await import("./routes/twoFactor.ts");
    const caller = twoFactorRouter.createCaller(publicCtx);
    const result = await caller.verify({
      pendingToken: "some.token",
      code: BACKUP_CODE_PLAIN,
    });

    expect(result).toHaveProperty("token");
    expect(result.token).toBe("mock.jwt.token");
    // consumeBackupCode chama db.update para remover o código usado
    expect(dbUpdateWhereFn).toHaveBeenCalled();
  });

  it("lança UNAUTHORIZED com backup code inválido (não está na lista)", async () => {
    const { jwtVerify } = await import("jose");
    vi.mocked(jwtVerify).mockResolvedValueOnce({
      payload: { type: "pending_2fa", userId: 1 },
    } as Awaited<ReturnType<typeof jwtVerify>>);

    dbSelectLimitFn.mockResolvedValueOnce([
      makeUser({
        totpBackupCodes: ["some-other-hash"],
      }),
    ]);

    const { twoFactorRouter } = await import("./routes/twoFactor.ts");
    const caller = twoFactorRouter.createCaller(publicCtx);
    await expect(
      caller.verify({ pendingToken: "some.token", code: "XXXX-9999" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("backup code consumido é removido da lista (dbUpdate chamado)", async () => {
    const BACKUP_CODE_PLAIN = "CAFE-BABE";
    const hashedCode = hashBackupCodeForTest(BACKUP_CODE_PLAIN.toUpperCase());

    const { jwtVerify } = await import("jose");
    vi.mocked(jwtVerify).mockResolvedValueOnce({
      payload: { type: "pending_2fa", userId: 1 },
    } as Awaited<ReturnType<typeof jwtVerify>>);

    dbSelectLimitFn.mockResolvedValueOnce([
      makeUser({
        totpBackupCodes: [hashedCode, "anotherhash"],
      }),
    ]);
    dbUpdateWhereFn.mockResolvedValue([]);

    const { twoFactorRouter } = await import("./routes/twoFactor.ts");
    const caller = twoFactorRouter.createCaller(publicCtx);
    await caller.verify({
      pendingToken: "some.token",
      code: BACKUP_CODE_PLAIN,
    });

    expect(dbUpdateWhereFn).toHaveBeenCalled();
  });
});

// ── Tests: disable ────────────────────────────────────────────────────────────

describe("twoFactorRouter.disable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbSelectLimitFn.mockResolvedValue([]);
  });

  it("lança FORBIDDEN quando não-admin tenta desabilitar 2FA de outro usuário", async () => {
    const { twoFactorRouter } = await import("./routes/twoFactor.ts");
    dbUpdateWhereFn.mockResolvedValue([]);

    // staffCtx tem id=1, targetUserId=99 → role=medico → FORBIDDEN
    const caller = twoFactorRouter.createCaller(staffCtx);
    await expect(caller.disable({ targetUserId: 99 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("médico pode desabilitar seu próprio 2FA (sem targetUserId)", async () => {
    const { twoFactorRouter } = await import("./routes/twoFactor.ts");
    dbUpdateWhereFn.mockResolvedValue([]);

    const caller = twoFactorRouter.createCaller(staffCtx);
    const result = await caller.disable({});

    expect(result).toEqual({ ok: true });
    expect(dbUpdateWhereFn).toHaveBeenCalled();
  });

  it("médico pode desabilitar seu próprio 2FA (com targetUserId igual ao próprio id)", async () => {
    const { twoFactorRouter } = await import("./routes/twoFactor.ts");
    dbUpdateWhereFn.mockResolvedValue([]);

    const caller = twoFactorRouter.createCaller(staffCtx);
    // staffCtx.session.id = 1, targetUserId = 1
    const result = await caller.disable({ targetUserId: 1 });

    expect(result).toEqual({ ok: true });
    expect(dbUpdateWhereFn).toHaveBeenCalled();
  });

  it("admin pode desabilitar 2FA de outro usuário", async () => {
    const { twoFactorRouter } = await import("./routes/twoFactor.ts");
    dbUpdateWhereFn.mockResolvedValue([]);

    // adminCtx.session.id = 1, targetUserId = 99
    const caller = twoFactorRouter.createCaller(adminCtx);
    const result = await caller.disable({ targetUserId: 99 });

    expect(result).toEqual({ ok: true });
    expect(dbUpdateWhereFn).toHaveBeenCalled();
  });

  it("admin pode desabilitar seu próprio 2FA", async () => {
    const { twoFactorRouter } = await import("./routes/twoFactor.ts");
    dbUpdateWhereFn.mockResolvedValue([]);

    const caller = twoFactorRouter.createCaller(adminCtx);
    const result = await caller.disable({});

    expect(result).toEqual({ ok: true });
  });

  it("lança UNAUTHORIZED para contexto público", async () => {
    const { twoFactorRouter } = await import("./routes/twoFactor.ts");
    const caller = twoFactorRouter.createCaller(publicCtx);
    await expect(caller.disable({})).rejects.toThrow(TRPCError);
  });

  it("lança FORBIDDEN para secretaria tentando desabilitar 2FA de outro", async () => {
    const { twoFactorRouter } = await import("./routes/twoFactor.ts");
    // secretariaCtx.session.id = 2, targetUserId = 1
    const caller = twoFactorRouter.createCaller(secretariaCtx);
    await expect(caller.disable({ targetUserId: 1 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

// ── Tests: status ─────────────────────────────────────────────────────────────

describe("twoFactorRouter.status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbSelectLimitFn.mockResolvedValue([]);
  });

  it("retorna { enabled: true } quando totpEnabled=true", async () => {
    const { twoFactorRouter } = await import("./routes/twoFactor.ts");
    dbSelectLimitFn.mockResolvedValueOnce([{ totpEnabled: true }]);

    const caller = twoFactorRouter.createCaller(staffCtx);
    const result = await caller.status();

    expect(result).toEqual({ enabled: true });
  });

  it("retorna { enabled: false } quando totpEnabled=false", async () => {
    const { twoFactorRouter } = await import("./routes/twoFactor.ts");
    dbSelectLimitFn.mockResolvedValueOnce([{ totpEnabled: false }]);

    const caller = twoFactorRouter.createCaller(staffCtx);
    const result = await caller.status();

    expect(result).toEqual({ enabled: false });
  });

  it("retorna { enabled: false } quando usuário não é encontrado", async () => {
    const { twoFactorRouter } = await import("./routes/twoFactor.ts");
    dbSelectLimitFn.mockResolvedValueOnce([]);

    const caller = twoFactorRouter.createCaller(staffCtx);
    const result = await caller.status();

    expect(result).toEqual({ enabled: false });
  });

  it("lança UNAUTHORIZED para contexto público", async () => {
    const { twoFactorRouter } = await import("./routes/twoFactor.ts");
    const caller = twoFactorRouter.createCaller(publicCtx);
    await expect(caller.status()).rejects.toThrow(TRPCError);
  });

  it("retorna { enabled: false } via ?? quando totpEnabled é null/undefined", async () => {
    const { twoFactorRouter } = await import("./routes/twoFactor.ts");
    dbSelectLimitFn.mockResolvedValueOnce([{ totpEnabled: null }]);

    const caller = twoFactorRouter.createCaller(staffCtx);
    const result = await caller.status();

    expect(result).toEqual({ enabled: false });
  });
});
