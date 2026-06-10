import { describe, it, expect } from "vitest";
import { normalizarTelefoneParaE164 } from "./_core/phoneUtils.ts";

describe("normalizarTelefoneParaE164", () => {
  it("retorna null para null", () => {
    expect(normalizarTelefoneParaE164(null)).toBeNull();
  });

  it("retorna null para undefined", () => {
    expect(normalizarTelefoneParaE164(undefined)).toBeNull();
  });

  it("retorna null para string vazia", () => {
    expect(normalizarTelefoneParaE164("")).toBeNull();
  });

  it("passa número já em E.164 sem alteração", () => {
    expect(normalizarTelefoneParaE164("+5561999998888")).toBe("+5561999998888");
  });

  it("passa número E.164 internacional sem alteração", () => {
    expect(normalizarTelefoneParaE164("+12125551234")).toBe("+12125551234");
  });

  it("converte 11 dígitos BR (celular) adicionando +55", () => {
    expect(normalizarTelefoneParaE164("61999998888")).toBe("+5561999998888");
  });

  it("converte 10 dígitos BR (fixo) adicionando +55", () => {
    expect(normalizarTelefoneParaE164("6132221234")).toBe("+556132221234");
  });

  it("normaliza número com formatação (traços, parênteses)", () => {
    expect(normalizarTelefoneParaE164("(61) 99999-8888")).toBe(
      "+5561999998888",
    );
  });

  it("retorna string original se não encaixar em nenhum padrão", () => {
    expect(normalizarTelefoneParaE164("123")).toBe("123");
  });
});
