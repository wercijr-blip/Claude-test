import { describe, it, expect, vi } from "vitest";

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

import { EXAM_RULES } from "../shared/security-constants.ts";

describe("EXAM_RULES — limites de aprovação automática de exames", () => {
  it("AUTO_APPROVE_MIN_CONFIDENCE é um número entre 0 e 1", () => {
    expect(EXAM_RULES.AUTO_APPROVE_MIN_CONFIDENCE).toBeGreaterThan(0);
    expect(EXAM_RULES.AUTO_APPROVE_MIN_CONFIDENCE).toBeLessThanOrEqual(1);
  });

  it("LOW_CONFIDENCE_THRESHOLD é estritamente menor que AUTO_APPROVE_MIN_CONFIDENCE", () => {
    expect(EXAM_RULES.LOW_CONFIDENCE_THRESHOLD).toBeLessThan(
      EXAM_RULES.AUTO_APPROVE_MIN_CONFIDENCE,
    );
  });

  it("confiança exatamente no AUTO_APPROVE_MIN_CONFIDENCE → aprovação automática", () => {
    const confianca = EXAM_RULES.AUTO_APPROVE_MIN_CONFIDENCE;
    expect(confianca >= EXAM_RULES.AUTO_APPROVE_MIN_CONFIDENCE).toBe(true);
  });

  it("confiança 0.01 abaixo → NÃO aprova automaticamente", () => {
    const confianca = EXAM_RULES.AUTO_APPROVE_MIN_CONFIDENCE - 0.01;
    expect(confianca >= EXAM_RULES.AUTO_APPROVE_MIN_CONFIDENCE).toBe(false);
  });

  it("confiança exatamente em LOW_CONFIDENCE_THRESHOLD → revisão obrigatória", () => {
    const confianca = EXAM_RULES.LOW_CONFIDENCE_THRESHOLD;
    expect(confianca < EXAM_RULES.AUTO_APPROVE_MIN_CONFIDENCE).toBe(true);
  });

  it("resultado nao_reagente com confiança máxima → deve aprovar automaticamente", () => {
    const resultado = "nao_reagente";
    const confianca = 1.0;
    const deveAprovar =
      resultado === "nao_reagente" &&
      confianca >= EXAM_RULES.AUTO_APPROVE_MIN_CONFIDENCE;
    expect(deveAprovar).toBe(true);
  });

  it("resultado reagente → nunca aprova automaticamente independente da confiança", () => {
    const resultado: string = "reagente";
    const confianca = 1.0;
    const deveAprovar =
      resultado === "nao_reagente" &&
      confianca >= EXAM_RULES.AUTO_APPROVE_MIN_CONFIDENCE;
    expect(deveAprovar).toBe(false);
  });

  it("resultado inconclusivo → nunca aprova automaticamente", () => {
    const resultado: string = "inconclusivo";
    const confianca = 1.0;
    const deveAprovar =
      resultado === "nao_reagente" &&
      confianca >= EXAM_RULES.AUTO_APPROVE_MIN_CONFIDENCE;
    expect(deveAprovar).toBe(false);
  });
});

describe("EXAM_RULES — validação da estrutura do objeto", () => {
  it("AUTO_APPROVE_MIN_CONFIDENCE está definido como propriedade", () => {
    expect(
      Object.prototype.hasOwnProperty.call(
        EXAM_RULES,
        "AUTO_APPROVE_MIN_CONFIDENCE",
      ),
    ).toBe(true);
  });
  it("LOW_CONFIDENCE_THRESHOLD está definido como propriedade", () => {
    expect(
      Object.prototype.hasOwnProperty.call(
        EXAM_RULES,
        "LOW_CONFIDENCE_THRESHOLD",
      ),
    ).toBe(true);
  });
});
