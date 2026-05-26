import { describe, it, expect, vi } from "vitest";

vi.mock("./_core/logger.ts", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("./_core/env.ts", () => ({
  env: {
    NODE_ENV: "test",
    BUILT_IN_FORGE_API_URL: "https://api.anthropic.com",
    BUILT_IN_FORGE_API_KEY: "sk-ant-test",
    LLM_DAILY_LIMIT: 200,
  },
}));

vi.mock("./_core/redis.ts", () => ({
  redis: {
    incr: vi.fn(),
    expire: vi.fn(),
    get: vi.fn(),
    ping: vi.fn(),
    quit: vi.fn(),
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
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    }),
  },
}));

vi.mock("./storage.ts", () => ({
  getPresignedUrl: vi.fn().mockResolvedValue("https://s3.example.com/exam.jpg"),
  uploadBuffer: vi.fn(),
}));

vi.mock("./_core/audit.ts", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

import { buildLlmRequest, parseIaResponse } from "./examAnalysis.ts";

describe("buildLlmRequest", () => {
  it("embeds the image URL in the image content block", () => {
    const url = "https://s3.example.com/exames/hiv-test.jpg";
    const req = buildLlmRequest(url);
    const imageBlock = req.messages[0].content.find(
      (c: { type: string }) => c.type === "image",
    ) as { source?: { url?: string } } | undefined;
    expect(imageBlock?.source?.url).toBe(url);
  });

  it("sets max_tokens to 500", () => {
    const req = buildLlmRequest("https://example.com/img.jpg");
    expect(req.max_tokens).toBe(500);
  });

  it("system prompt includes all required JSON field names (moved from user message in v2.0)", () => {
    const req = buildLlmRequest("https://example.com/img.jpg");
    // Field definitions are now in the SBIS v2.0 system prompt (not the user message)
    expect(req.system).toContain("tipoExame");
    expect(req.system).toContain("resultado");
    expect(req.system).toContain("confianca");
    expect(req.system).toContain("observacoes");
  });

  it("uses a single user-role message", () => {
    const req = buildLlmRequest("https://example.com/img.jpg");
    expect(req.messages).toHaveLength(1);
    expect(req.messages[0].role).toBe("user");
  });

  it("message content has exactly two blocks: image and text", () => {
    const req = buildLlmRequest("https://example.com/img.jpg");
    const content = req.messages[0].content;
    expect(content).toHaveLength(2);
    expect(content.map((c: { type: string }) => c.type)).toEqual([
      "image",
      "text",
    ]);
  });
});

describe("parseIaResponse", () => {
  it("parses a valid JSON response and returns correct fields", () => {
    const text = JSON.stringify({
      tipoExame: "hiv",
      resultado: "nao_reagente",
      confianca: 0.95,
      observacoes: "Resultado dentro da normalidade",
    });
    const result = parseIaResponse(text, "session-abc", "hiv", 1);
    expect(result.tipoExame).toBe("hiv");
    expect(result.resultado).toBe("nao_reagente");
    expect(result.confianca).toBe(0.95);
    expect(result.status).toBe("pendente");
    expect(result.processadoEm).toBeTruthy();
  });

  it("falls back to nao_identificado for non-JSON input", () => {
    const result = parseIaResponse(
      "not valid json at all",
      "session-abc",
      "sifilis",
      2,
    );
    expect(result.resultado).toBe("nao_identificado");
    expect(result.confianca).toBe(0);
    expect(result.tipoExame).toBe("sifilis");
    expect(result.status).toBe("pendente");
  });

  it("falls back for JSON that fails enum validation (invalid resultado)", () => {
    const text = JSON.stringify({
      tipoExame: "hiv",
      resultado: "positivo",
      confianca: 0.9,
    });
    const result = parseIaResponse(text, "session-abc", "hiv", 3);
    expect(result.resultado).toBe("nao_identificado");
    expect(result.confianca).toBe(0);
  });

  it("falls back for JSON that fails schema (missing required fields)", () => {
    const text = JSON.stringify({ tipoExame: "hiv" });
    const result = parseIaResponse(text, "session-abc", "outro", 4);
    expect(result.resultado).toBe("nao_identificado");
  });

  it("uses fallbackTipoExame as tipoExame when parsing fails", () => {
    const result = parseIaResponse("bad json", "session-abc", "hepatite_c", 5);
    expect(result.tipoExame).toBe("hepatite_c");
  });

  it("sets confianca to 0 on parse failure", () => {
    const result = parseIaResponse("{}", "session-abc", "creatinina", 6);
    expect(result.confianca).toBe(0);
  });

  it("includes sbis metadata on successful parse", () => {
    const text = JSON.stringify({
      tipoExame: "hepatite_b",
      resultado: "reagente",
      confianca: 0.8,
    });
    const result = parseIaResponse(text, "session-abc", "hepatite_b", 7);
    expect(result.sbis).toBeDefined();
    expect(result.sbis?.hash).toBeTruthy();
  });

  it("handles all valid resultado enum values", () => {
    const valores = [
      "reagente",
      "nao_reagente",
      "inconclusivo",
      "nao_identificado",
    ] as const;
    for (const resultado of valores) {
      const text = JSON.stringify({
        tipoExame: "hiv",
        resultado,
        confianca: 0.7,
      });
      const r = parseIaResponse(text, "session-abc", "hiv", 10);
      expect(r.resultado).toBe(resultado);
    }
  });

  it("handles all valid tipoExame enum values", () => {
    const tipos = [
      "hiv",
      "hepatite_b",
      "hepatite_c",
      "sifilis",
      "creatinina",
      "outro",
    ] as const;
    for (const tipoExame of tipos) {
      const text = JSON.stringify({
        tipoExame,
        resultado: "nao_reagente",
        confianca: 0.9,
      });
      const r = parseIaResponse(text, "session-abc", tipoExame, 20);
      expect(r.tipoExame).toBe(tipoExame);
    }
  });
});
