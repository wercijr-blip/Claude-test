import { describe, it, expect, vi } from "vitest";
import { z } from "zod";

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
    CONSULTA_VALOR: 250,
    ENABLE_DEBIT_CARD: false,
  },
}));
vi.mock("./db.ts", () => ({ db: {} }));
vi.mock("./storage.ts", () => ({ getPresignedUrl: vi.fn() }));
vi.mock("./email.ts", () => ({ enviarCadastroRecebidoExames: vi.fn() }));
vi.mock("./pdfQueue.ts", () => ({ enqueueGerarPdf: vi.fn() }));
vi.mock("./whatsapp.ts", () => ({ enviarWhatsApp: vi.fn() }));
vi.mock("./routes/intake.ts", () => ({ gerarLinkDeAcesso: vi.fn() }));
vi.mock("@sentry/node", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));
vi.mock("./_core/logger.ts", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ────────────────────────────────────────────────────────────────────────────
// normalizarCpf
// ────────────────────────────────────────────────────────────────────────────
describe("normalizarCpf", () => {
  it("remove pontos e traço do formato padrão", async () => {
    const { normalizarCpf } = await import("./_core/cpfValidator.ts");
    expect(normalizarCpf("529.982.247-25")).toBe("52998224725");
  });

  it("mantém CPF já sem formatação", async () => {
    const { normalizarCpf } = await import("./_core/cpfValidator.ts");
    expect(normalizarCpf("52998224725")).toBe("52998224725");
  });

  it("remove qualquer caractere não-numérico", async () => {
    const { normalizarCpf } = await import("./_core/cpfValidator.ts");
    expect(normalizarCpf(" 529 982 247 25 ")).toBe("52998224725");
  });

  it("retorna string vazia se entrada for somente símbolos", async () => {
    const { normalizarCpf } = await import("./_core/cpfValidator.ts");
    expect(normalizarCpf("...---")).toBe("");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// validarCpf — integrado ao schema do salvarStep1
// ────────────────────────────────────────────────────────────────────────────
describe("salvarStep1 — schema Zod com validarCpf", () => {
  // Replica o schema exato de salvarStep1 conforme paciente.ts
  const buildSchema = async () => {
    const { validarCpf } = await import("./_core/cpfValidator.ts");
    const { ERROR_MESSAGES } = await import("../shared/const.ts");
    return z.object({
      cpf: z.string().refine(validarCpf, ERROR_MESSAGES.CPF_INVALID),
      nome: z.string().min(3).max(255),
      dataNascimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      nomeMae: z.string().min(3, "Informe o nome completo da mãe").max(255),
      cns: z.string().max(20).optional(),
      sexo: z.enum(["masculino", "feminino", "outro"]),
      nomeSocial: z.string().max(255).optional(),
    });
  };

  const validPayload = {
    cpf: "529.982.247-25",
    nome: "Paciente Teste",
    dataNascimento: "1990-05-15",
    nomeMae: "Mãe do Paciente",
    sexo: "masculino" as const,
  };

  it("aceita CPF válido no formato pontuado", async () => {
    const schema = await buildSchema();
    expect(() => schema.parse(validPayload)).not.toThrow();
  });

  it("aceita CPF válido sem formatação", async () => {
    const schema = await buildSchema();
    expect(() =>
      schema.parse({ ...validPayload, cpf: "52998224725" }),
    ).not.toThrow();
  });

  it("rejeita CPF com dígito verificador incorreto", async () => {
    const schema = await buildSchema();
    const result = schema.safeParse({ ...validPayload, cpf: "529.982.247-99" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msgs = result.error.issues.map((i) => i.message);
      expect(msgs.some((m) => m.includes("CPF"))).toBe(true);
    }
  });

  it("rejeita CPF com todos os dígitos iguais (ex: 111.111.111-11)", async () => {
    const schema = await buildSchema();
    expect(
      schema.safeParse({ ...validPayload, cpf: "111.111.111-11" }).success,
    ).toBe(false);
  });

  it("rejeita string vazia no campo CPF", async () => {
    const schema = await buildSchema();
    expect(schema.safeParse({ ...validPayload, cpf: "" }).success).toBe(false);
  });

  it("rejeita nome com menos de 3 caracteres", async () => {
    const schema = await buildSchema();
    expect(schema.safeParse({ ...validPayload, nome: "ab" }).success).toBe(
      false,
    );
  });

  it("rejeita data de nascimento fora do padrão YYYY-MM-DD", async () => {
    const schema = await buildSchema();
    expect(
      schema.safeParse({ ...validPayload, dataNascimento: "15/05/1990" })
        .success,
    ).toBe(false);
  });

  it("rejeita sexo com valor não permitido", async () => {
    const schema = await buildSchema();
    expect(
      schema.safeParse({ ...validPayload, sexo: "desconhecido" as "masculino" })
        .success,
    ).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// encrypt / decrypt — campos sensíveis do paciente (LGPD)
// ────────────────────────────────────────────────────────────────────────────
describe("encrypt/decrypt — campos sensíveis do paciente", () => {
  it("roundtrip para nome completo", async () => {
    const { encrypt, decrypt } = await import("./_core/encryption.ts");
    const nome = "João da Silva Sauro";
    expect(decrypt(encrypt(nome))).toBe(nome);
  });

  it("roundtrip para CPF normalizado", async () => {
    const { encrypt, decrypt } = await import("./_core/encryption.ts");
    const cpf = "52998224725";
    expect(decrypt(encrypt(cpf))).toBe(cpf);
  });

  it("cada encriptação produz ciphertext diferente (IV aleatório)", async () => {
    const { encrypt } = await import("./_core/encryption.ts");
    const nome = "Ana Beatriz";
    expect(encrypt(nome)).not.toBe(encrypt(nome));
  });

  it("dados corrompidos lançam erro de descriptografia", async () => {
    const { decrypt } = await import("./_core/encryption.ts");
    expect(() => decrypt("dado-invalido-base64==")).toThrow();
  });

  it("hashCpf produz hash diferente do CPF original (não reversível)", async () => {
    const { hashCpf } = await import("./_core/encryption.ts");
    const cpf = "52998224725";
    const hash = hashCpf(cpf);
    expect(hash).not.toContain(cpf);
    expect(hash).toHaveLength(64);
  });

  it("hashCpf é determinístico (busca por CPF funciona)", async () => {
    const { hashCpf } = await import("./_core/encryption.ts");
    const cpf = "52998224725";
    expect(hashCpf(cpf)).toBe(hashCpf(cpf));
  });
});
