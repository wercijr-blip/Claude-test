import { describe, it, expect } from "vitest";
import { paginatedResponse } from "./_core/pagination.ts";
import { paginationInput } from "./_core/pagination.ts";

describe("paginatedResponse", () => {
  const makeItems = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `item-${i + 1}` }));

  it("retorna hasMore false quando items <= limit", () => {
    const result = paginatedResponse(makeItems(5), 10);
    expect(result.hasMore).toBe(false);
    expect(result.data).toHaveLength(5);
    expect(result.nextCursor).toBeUndefined();
  });

  it("retorna hasMore true quando items > limit", () => {
    const result = paginatedResponse(makeItems(11), 10);
    expect(result.hasMore).toBe(true);
    expect(result.data).toHaveLength(10);
    expect(result.nextCursor).toBe(10);
  });

  it("nextCursor é o id do último item da página", () => {
    const items = makeItems(6);
    const result = paginatedResponse(items, 5);
    expect(result.nextCursor).toBe(5);
    expect(result.data[result.data.length - 1]!.id).toBe(5);
  });

  it("lista vazia retorna hasMore false e sem cursor", () => {
    const result = paginatedResponse([], 10);
    expect(result.hasMore).toBe(false);
    expect(result.data).toHaveLength(0);
    expect(result.nextCursor).toBeUndefined();
  });

  it("limit exato: hasMore false, sem cursor", () => {
    const result = paginatedResponse(makeItems(10), 10);
    expect(result.hasMore).toBe(false);
    expect(result.data).toHaveLength(10);
  });
});

describe("paginationInput — schema Zod", () => {
  it("usa defaults quando input vazio", () => {
    const result = paginationInput.parse({});
    expect(result.limit).toBe(20);
    expect(result.cursor).toBeUndefined();
  });

  it("aceita limit customizado dentro dos bounds", () => {
    const result = paginationInput.parse({ limit: 50, cursor: 100 });
    expect(result.limit).toBe(50);
    expect(result.cursor).toBe(100);
  });

  it("rejeita limit acima de 100", () => {
    expect(() => paginationInput.parse({ limit: 101 })).toThrow();
  });

  it("rejeita limit zero", () => {
    expect(() => paginationInput.parse({ limit: 0 })).toThrow();
  });

  it("rejeita cursor negativo", () => {
    expect(() => paginationInput.parse({ cursor: -1 })).toThrow();
  });
});
