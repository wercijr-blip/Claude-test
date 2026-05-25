import { describe, it, expect, vi, beforeEach } from "vitest";

const mockIncr = vi.fn();
const mockDecr = vi.fn().mockResolvedValue(1);
const mockExpire = vi.fn();

vi.mock("./_core/redis.ts", () => ({
  redis: {
    incr: mockIncr,
    decr: mockDecr,
    expire: mockExpire,
    ping: vi.fn().mockResolvedValue("PONG"),
    quit: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("./_core/env.ts", () => ({
  env: {
    NODE_ENV: "test",
    REDIS_URL: "redis://localhost:6379",
    JWT_SECRET: "test-secret-minimum-32-characters-long-xx",
    LLM_DAILY_LIMIT: 5,
    BUILT_IN_FORGE_API_URL: "https://api.anthropic.com",
    BUILT_IN_FORGE_API_KEY: "sk-ant-test",
  },
}));

vi.mock("./db.ts", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi
          .fn()
          .mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
}));

vi.mock("./storage.ts", () => ({
  uploadBuffer: vi.fn(),
  getPresignedUrl: vi
    .fn()
    .mockResolvedValue("https://s3.example.com/exame.jpg"),
}));

vi.mock("./_core/logger.ts", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe("checkDailyLimit (via analisarExame)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("allows calls under the daily limit", async () => {
    mockIncr.mockResolvedValueOnce(1); // minute check
    mockExpire.mockResolvedValueOnce(1); // minute expire
    mockIncr.mockResolvedValueOnce(1); // daily check
    mockExpire.mockResolvedValueOnce(1); // daily expire

    const { analisarExame } = await import("./examAnalysis.ts");

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [
          {
            text: JSON.stringify({
              tipoExame: "hiv",
              resultado: "nao_reagente",
              confianca: 0.95,
              observacoes: "teste",
            }),
          },
        ],
      }),
    }) as unknown as typeof fetch;

    const { db } = await import("./db.ts");
    const mockSelect = db.select as ReturnType<typeof vi.fn>;
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi
            .fn()
            .mockResolvedValue([
              { id: 1, s3Key: "exames/test.jpg", status: "pendente" },
            ]),
        }),
      }),
    });

    await expect(analisarExame(1)).resolves.toBeDefined();
    expect(mockIncr).toHaveBeenCalledWith(
      expect.stringMatching(/^llm:daily:\d{4}-\d{2}-\d{2}$/),
    );
  });

  it("blocks calls over the daily limit and throws user-friendly error", async () => {
    // minute incr returns 1 (within limit), daily incr returns 6 (exceeds limit of 5)
    mockIncr.mockResolvedValueOnce(1); // minute check
    mockExpire.mockResolvedValueOnce(1); // minute expire
    mockIncr.mockResolvedValueOnce(6); // daily check

    const { analisarExame } = await import("./examAnalysis.ts");

    await expect(analisarExame(1)).rejects.toThrow("Limite diário");
    expect(mockIncr).toHaveBeenCalledTimes(2);
  });

  it("sets 25h TTL on first call of the day (incr returns 1)", async () => {
    // minute incr returns 1 (triggers minute expire), daily incr returns 1 (triggers daily expire)
    mockIncr.mockResolvedValueOnce(1); // minute check
    mockExpire.mockResolvedValueOnce(1); // minute expire
    mockIncr.mockResolvedValueOnce(1); // daily check
    mockExpire.mockResolvedValueOnce(1); // daily expire

    const { analisarExame } = await import("./examAnalysis.ts");

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [
          {
            text: JSON.stringify({
              tipoExame: "hiv",
              resultado: "nao_reagente",
              confianca: 0.9,
            }),
          },
        ],
      }),
    }) as unknown as typeof fetch;

    const { db } = await import("./db.ts");
    const mockSelect = db.select as ReturnType<typeof vi.fn>;
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi
            .fn()
            .mockResolvedValue([
              { id: 1, s3Key: "exames/test.jpg", status: "pendente" },
            ]),
        }),
      }),
    });

    await expect(analisarExame(1)).resolves.toBeDefined();
    expect(mockExpire).toHaveBeenCalledWith(
      expect.stringMatching(/^llm:daily:/),
      90_000,
    );
  });

  it("does not set TTL when count > 1 (key already exists)", async () => {
    // Both minute and daily return count > 1 — neither sets TTL
    mockIncr.mockResolvedValueOnce(2); // minute check (count > 1, no expire)
    mockIncr.mockResolvedValueOnce(3); // daily check (count > 1, no expire)

    const { analisarExame } = await import("./examAnalysis.ts");

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [
          {
            text: JSON.stringify({
              tipoExame: "hiv",
              resultado: "nao_reagente",
              confianca: 0.9,
            }),
          },
        ],
      }),
    }) as unknown as typeof fetch;

    const { db } = await import("./db.ts");
    const mockSelect = db.select as ReturnType<typeof vi.fn>;
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi
            .fn()
            .mockResolvedValue([
              { id: 1, s3Key: "exames/test.jpg", status: "pendente" },
            ]),
        }),
      }),
    });

    await expect(analisarExame(1)).resolves.toBeDefined();
    expect(mockExpire).not.toHaveBeenCalled();
  });

  it("degrades gracefully when Redis is unavailable (non-limit error)", async () => {
    // Both minute and daily checks fail — both degrade gracefully and continue
    mockIncr.mockRejectedValueOnce(new Error("Connection refused"));
    mockIncr.mockRejectedValueOnce(new Error("Connection refused"));

    const { analisarExame } = await import("./examAnalysis.ts");

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [
          {
            text: JSON.stringify({
              tipoExame: "hiv",
              resultado: "nao_reagente",
              confianca: 0.9,
            }),
          },
        ],
      }),
    }) as unknown as typeof fetch;

    const { db } = await import("./db.ts");
    const mockSelect = db.select as ReturnType<typeof vi.fn>;
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi
            .fn()
            .mockResolvedValue([
              { id: 1, s3Key: "exames/test.jpg", status: "pendente" },
            ]),
        }),
      }),
    });

    await expect(analisarExame(1)).resolves.toBeDefined();
  });
});

describe("analisarExame — branches adicionais", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockIncr.mockResolvedValue(1);
    mockExpire.mockResolvedValue(1);
  });

  it("lança erro quando exame não é encontrado no banco", async () => {
    const { analisarExame } = await import("./examAnalysis.ts");

    const { db } = await import("./db.ts");
    const mockSelect = db.select as ReturnType<typeof vi.fn>;
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    await expect(analisarExame(999)).rejects.toThrow("999");
  });

  it("lança erro quando API retorna status de erro (response.ok = false)", async () => {
    const { analisarExame } = await import("./examAnalysis.ts");

    const { db } = await import("./db.ts");
    const mockSelect = db.select as ReturnType<typeof vi.fn>;
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi
            .fn()
            .mockResolvedValue([
              { id: 1, s3Key: "exames/test.jpg", status: "pendente" },
            ]),
        }),
      }),
    });

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => "Rate limit exceeded",
    }) as unknown as typeof fetch;

    await expect(analisarExame(1)).rejects.toThrow("HTTP 429");
  });
});

describe("parseIaResponse — respostas da IA", () => {
  beforeEach(() => vi.resetModules());

  it("retorna nao_identificado para JSON inválido", async () => {
    const { parseIaResponse } = await import("./examAnalysis.ts");
    const result = parseIaResponse("isso não é json {", "session-1", "hiv", 1);
    expect(result.resultado).toBe("nao_identificado");
    expect(result.confianca).toBe(0);
  });

  it("retorna nao_identificado para JSON sem campos obrigatórios", async () => {
    const { parseIaResponse } = await import("./examAnalysis.ts");
    const result = parseIaResponse('{"foo":"bar"}', "session-2", "outro", 2);
    expect(result.resultado).toBe("nao_identificado");
  });

  it("parseia corretamente resposta válida da IA", async () => {
    const { parseIaResponse } = await import("./examAnalysis.ts");
    const validJson = JSON.stringify({
      tipoExame: "hiv",
      resultado: "nao_reagente",
      confianca: 0.97,
    });
    const result = parseIaResponse(validJson, "session-3", "hiv", 3);
    expect(result.resultado).toBe("nao_reagente");
    expect(result.confianca).toBe(0.97);
    expect(result.status).toBe("pendente");
  });

  it("buildLlmRequest gera estrutura correta com URL da imagem", async () => {
    const { buildLlmRequest } = await import("./examAnalysis.ts");
    const req = buildLlmRequest("https://s3.example.com/exame.jpg");
    expect(req.messages[0].content[0]).toMatchObject({
      type: "image",
      source: { type: "url", url: "https://s3.example.com/exame.jpg" },
    });
    expect(req.messages[0].content[1]).toMatchObject({ type: "text" });
    expect(req.max_tokens).toBeGreaterThan(0);
  });
});
