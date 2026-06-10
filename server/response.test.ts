import { describe, it, expect } from "vitest";
import { ok, okEmpty } from "./_core/response.ts";

describe("ok", () => {
  it("retorna ok true com data", () => {
    const result = ok({ id: 1, nome: "Teste" });
    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ id: 1, nome: "Teste" });
  });

  it("funciona com string", () => {
    expect(ok("valor").data).toBe("valor");
  });

  it("funciona com null", () => {
    expect(ok(null).data).toBeNull();
  });
});

describe("okEmpty", () => {
  it("retorna ok true sem data", () => {
    const result = okEmpty();
    expect(result.ok).toBe(true);
    expect("data" in result).toBe(false);
  });
});
