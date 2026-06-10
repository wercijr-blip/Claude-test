import { describe, it, expect } from "vitest";
import {
  condutaDbSchema,
  prescricaoDbSchema,
  resultadoIaDbSchema,
} from "./_core/dbSchemas.ts";

describe("condutaDbSchema", () => {
  it("aceita objeto válido", () => {
    const result = condutaDbSchema.parse({
      temSintomasDst: true,
      usoDrogas: false,
    });
    expect(result?.temSintomasDst).toBe(true);
  });

  it("aceita null", () => {
    expect(condutaDbSchema.parse(null)).toBeNull();
  });

  it("retorna null para dado inválido (catch)", () => {
    expect(condutaDbSchema.parse({ temSintomasDst: "nao-boolean" })).toBeNull();
  });

  it("campo opcional prepAdesao aceito", () => {
    const result = condutaDbSchema.parse({
      temSintomasDst: false,
      usoDrogas: false,
      prepAdesao: "diaria",
    });
    expect(result?.prepAdesao).toBe("diaria");
  });

  it("prepAdesao inválido retorna null (catch)", () => {
    expect(
      condutaDbSchema.parse({
        temSintomasDst: false,
        usoDrogas: false,
        prepAdesao: "invalido",
      }),
    ).toBeNull();
  });
});

describe("resultadoIaDbSchema", () => {
  const validResult = {
    tipoExame: "hiv",
    resultado: "nao_reagente",
    confianca: 0.98,
    processadoEm: "2025-01-01T00:00:00.000Z",
    status: "aprovado_automaticamente",
  };

  it("aceita resultado válido completo", () => {
    const result = resultadoIaDbSchema.parse(validResult);
    expect(result?.resultado).toBe("nao_reagente");
    expect(result?.confianca).toBe(0.98);
  });

  it("aceita null", () => {
    expect(resultadoIaDbSchema.parse(null)).toBeNull();
  });

  it("retorna null para resultado inválido (catch)", () => {
    expect(
      resultadoIaDbSchema.parse({ ...validResult, resultado: "invalido" }),
    ).toBeNull();
  });

  it("confiança fora do range 0-1 retorna null (catch)", () => {
    expect(
      resultadoIaDbSchema.parse({ ...validResult, confianca: 1.5 }),
    ).toBeNull();
  });

  it("tipo de exame inválido retorna null (catch)", () => {
    expect(
      resultadoIaDbSchema.parse({
        ...validResult,
        tipoExame: "exame_desconhecido",
      }),
    ).toBeNull();
  });
});

describe("prescricaoDbSchema", () => {
  it("aceita objeto válido", () => {
    const result = prescricaoDbSchema.parse({
      modalidade: "diaria",
      posologia: "1 comprimido/dia",
    });
    expect(result?.modalidade).toBe("diaria");
  });

  it("aceita null", () => {
    expect(prescricaoDbSchema.parse(null)).toBeNull();
  });

  it("retorna null quando falta campo obrigatório", () => {
    expect(prescricaoDbSchema.parse({ modalidade: "diaria" })).toBeNull();
  });
});
