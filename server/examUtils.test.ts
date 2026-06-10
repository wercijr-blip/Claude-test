import { describe, it, expect } from "vitest";
import { isExameRejeitadoIa, filtrarExamePorStatus } from "./examUtils.ts";

describe("isExameRejeitadoIa", () => {
  it("retorna true para status rejeitado_ia", () => {
    expect(isExameRejeitadoIa({ status: "rejeitado_ia" })).toBe(true);
  });

  it("retorna true para status rejeitado", () => {
    expect(isExameRejeitadoIa({ status: "rejeitado" })).toBe(true);
  });

  it("retorna false para status aprovado", () => {
    expect(isExameRejeitadoIa({ status: "aprovado" })).toBe(false);
  });

  it("retorna false para status liberado_manualmente", () => {
    expect(isExameRejeitadoIa({ status: "liberado_manualmente" })).toBe(false);
  });

  it("retorna false para null", () => {
    expect(isExameRejeitadoIa(null)).toBe(false);
  });

  it("retorna false para objeto sem status", () => {
    expect(isExameRejeitadoIa({})).toBe(false);
  });
});

describe("filtrarExamePorStatus", () => {
  it("todos retorna true para qualquer exame", () => {
    expect(filtrarExamePorStatus({ status: "aprovado" }, "todos")).toBe(true);
    expect(filtrarExamePorStatus(null, "todos")).toBe(true);
  });

  it("pendente retorna true para null (sem resultado)", () => {
    expect(filtrarExamePorStatus(null, "pendente")).toBe(true);
  });

  it("pendente retorna true para status pendente", () => {
    expect(filtrarExamePorStatus({ status: "pendente" }, "pendente")).toBe(
      true,
    );
  });

  it("pendente retorna false para aprovado", () => {
    expect(filtrarExamePorStatus({ status: "aprovado" }, "pendente")).toBe(
      false,
    );
  });

  it("validado retorna true para aprovado", () => {
    expect(filtrarExamePorStatus({ status: "aprovado" }, "validado")).toBe(
      true,
    );
  });

  it("validado retorna true para validado", () => {
    expect(filtrarExamePorStatus({ status: "validado" }, "validado")).toBe(
      true,
    );
  });

  it("validado retorna false para pendente", () => {
    expect(filtrarExamePorStatus({ status: "pendente" }, "validado")).toBe(
      false,
    );
  });

  it("rejeitado retorna true para rejeitado_ia", () => {
    expect(filtrarExamePorStatus({ status: "rejeitado_ia" }, "rejeitado")).toBe(
      true,
    );
  });

  it("rejeitado retorna true para rejeitado", () => {
    expect(filtrarExamePorStatus({ status: "rejeitado" }, "rejeitado")).toBe(
      true,
    );
  });

  it("liberado retorna true para liberado_manualmente", () => {
    expect(
      filtrarExamePorStatus({ status: "liberado_manualmente" }, "liberado"),
    ).toBe(true);
  });

  it("liberado retorna false para aprovado", () => {
    expect(filtrarExamePorStatus({ status: "aprovado" }, "liberado")).toBe(
      false,
    );
  });
});
