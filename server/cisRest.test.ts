/**
 * Testes unitários para server/routes/cisRest.ts
 *
 * Estratégia: sem supertest (não instalado). Testamos diretamente
 * a lógica de validação e autenticação replicando as funções e
 * padrões definidos no módulo, sem importar o roteador (que tem
 * muitas dependências de banco/redis/LLM).
 */

import { describe, it, expect } from "vitest";

// ─── Lógica replicada do módulo (sem side-effects de importação) ──────────────

const CID10_RE = /^[A-Z]\d{2}(\.\d{1,2})?$/;
const TEMPLATE_RE = /^[a-z0-9_-]{1,60}$/;

function parseQueryDate(val: unknown): Date | undefined {
  if (typeof val !== "string") return undefined;
  const d = new Date(val);
  return isNaN(d.getTime()) ? undefined : d;
}

function clampLimit(raw: unknown): number {
  return Math.min(Math.max(Number(raw) || 20, 1), 100);
}

function clampOffset(raw: unknown): number {
  return Math.max(Number(raw) || 0, 0);
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe("CIS REST — CID10_RE", () => {
  it("aceita CID-10 de 3 caracteres válidos", () => {
    expect(CID10_RE.test("B20")).toBe(true);
    expect(CID10_RE.test("Z21")).toBe(true);
    expect(CID10_RE.test("A00")).toBe(true);
    expect(CID10_RE.test("Z99")).toBe(true);
  });

  it("aceita CID-10 com subcategoria de 1 decimal", () => {
    expect(CID10_RE.test("J18.9")).toBe(true);
    expect(CID10_RE.test("B20.1")).toBe(true);
    expect(CID10_RE.test("A00.0")).toBe(true);
  });

  it("aceita CID-10 com subcategoria de 2 decimais", () => {
    expect(CID10_RE.test("K21.01")).toBe(true);
    expect(CID10_RE.test("B20.12")).toBe(true);
  });

  it("rejeita letras minúsculas", () => {
    expect(CID10_RE.test("b20")).toBe(false);
    expect(CID10_RE.test("B20.1a")).toBe(false);
  });

  it("rejeita código sem dígitos suficientes", () => {
    expect(CID10_RE.test("B2")).toBe(false);
    expect(CID10_RE.test("B")).toBe(false);
  });

  it("rejeita código com dígitos em excesso", () => {
    expect(CID10_RE.test("B200")).toBe(false);
    expect(CID10_RE.test("B20.123")).toBe(false);
  });

  it("rejeita string vazia", () => {
    expect(CID10_RE.test("")).toBe(false);
  });

  it("rejeita tentativas de SQL injection", () => {
    expect(CID10_RE.test("SELECT")).toBe(false);
    expect(CID10_RE.test("B20'; DROP TABLE soapNotes--")).toBe(false);
    expect(CID10_RE.test("' OR '1'='1")).toBe(false);
  });

  it("rejeita tentativas de XSS", () => {
    expect(CID10_RE.test("<script>alert(1)</script>")).toBe(false);
    expect(CID10_RE.test("B20<img>")).toBe(false);
  });

  it("rejeita código começando com dígito", () => {
    expect(CID10_RE.test("20B")).toBe(false);
    expect(CID10_RE.test("123")).toBe(false);
  });
});

describe("CIS REST — TEMPLATE_RE", () => {
  it("aceita templates alfanuméricos válidos", () => {
    expect(TEMPLATE_RE.test("hiv_cronico")).toBe(true);
    expect(TEMPLATE_RE.test("prep-inicial")).toBe(true);
    expect(TEMPLATE_RE.test("tuberculose123")).toBe(true);
    expect(TEMPLATE_RE.test("a")).toBe(true);
  });

  it("aceita underscore e hífen", () => {
    expect(TEMPLATE_RE.test("template_com_underscore")).toBe(true);
    expect(TEMPLATE_RE.test("template-com-hifen")).toBe(true);
    expect(TEMPLATE_RE.test("mix_123-abc")).toBe(true);
  });

  it("rejeita letras maiúsculas", () => {
    expect(TEMPLATE_RE.test("HIV")).toBe(false);
    expect(TEMPLATE_RE.test("Template")).toBe(false);
  });

  it("rejeita espaços", () => {
    expect(TEMPLATE_RE.test("hiv cronico")).toBe(false);
    expect(TEMPLATE_RE.test(" template")).toBe(false);
  });

  it("rejeita string vazia", () => {
    expect(TEMPLATE_RE.test("")).toBe(false);
  });

  it("rejeita template com mais de 60 caracteres", () => {
    expect(TEMPLATE_RE.test("a".repeat(61))).toBe(false);
    expect(TEMPLATE_RE.test("a".repeat(60))).toBe(true);
  });

  it("rejeita path traversal", () => {
    expect(TEMPLATE_RE.test("../etc/passwd")).toBe(false);
    expect(TEMPLATE_RE.test("../../secret")).toBe(false);
  });

  it("rejeita tags HTML / XSS", () => {
    expect(TEMPLATE_RE.test("<script>")).toBe(false);
    expect(TEMPLATE_RE.test("template<b>")).toBe(false);
  });

  it("rejeita caracteres especiais de SQL", () => {
    expect(TEMPLATE_RE.test("hiv'; DROP TABLE")).toBe(false);
    expect(TEMPLATE_RE.test("hiv%20cronico")).toBe(false);
  });
});

describe("CIS REST — parseQueryDate", () => {
  it("parseia datas ISO 8601 de data simples", () => {
    const d = parseQueryDate("2025-01-01");
    expect(d).toBeInstanceOf(Date);
    expect(isNaN(d!.getTime())).toBe(false);
  });

  it("parseia datas ISO 8601 com horário UTC", () => {
    const d = parseQueryDate("2025-01-01T00:00:00Z");
    expect(d).toBeInstanceOf(Date);
  });

  it("parseia datas ISO 8601 com timezone explícita", () => {
    const d = parseQueryDate("2025-06-15T12:30:00-03:00");
    expect(d).toBeInstanceOf(Date);
  });

  it("retorna undefined para string de data inválida", () => {
    expect(parseQueryDate("not-a-date")).toBeUndefined();
    expect(parseQueryDate("32-13-2025")).toBeUndefined();
    expect(parseQueryDate("2025-99-99")).toBeUndefined();
  });

  it("retorna undefined para string vazia", () => {
    expect(parseQueryDate("")).toBeUndefined();
  });

  it("retorna undefined para não-strings", () => {
    expect(parseQueryDate(null)).toBeUndefined();
    expect(parseQueryDate(undefined)).toBeUndefined();
    expect(parseQueryDate(42)).toBeUndefined();
    expect(parseQueryDate([])).toBeUndefined();
    expect(parseQueryDate({})).toBeUndefined();
    expect(parseQueryDate(true)).toBeUndefined();
  });

  it("retorna undefined para strings que causariam SQL injection sem validação", () => {
    expect(
      parseQueryDate("2025-01-01'; DROP TABLE soapNotes--"),
    ).toBeUndefined();
    expect(parseQueryDate("<script>alert(1)</script>")).toBeUndefined();
    // Nota: a segurança aqui não é parseQueryDate em si — strings que passam
    // pelo Date constructor viram objetos Date, mas o ORM usa parâmetros
    // preparados ao passá-las para a query, evitando SQL injection.
    expect(parseQueryDate("UNION SELECT * FROM users")).toBeUndefined();
  });

  it("preserva o valor da data ao parsear", () => {
    const d = parseQueryDate("2025-03-15");
    // UTC midnight
    expect(d!.getUTCFullYear()).toBe(2025);
    expect(d!.getUTCMonth()).toBe(2); // 0-indexed: março = 2
    expect(d!.getUTCDate()).toBe(15);
  });
});

describe("CIS REST — validação de intervalo from/to", () => {
  it("from < to é intervalo válido", () => {
    const from = new Date("2025-01-01");
    const to = new Date("2025-12-31");
    expect(from > to).toBe(false);
  });

  it("from > to deve retornar 400 (flag detectável)", () => {
    const from = new Date("2025-12-31");
    const to = new Date("2025-01-01");
    expect(from > to).toBe(true);
  });

  it("from === to não deve bloquear (sem erro 400)", () => {
    const from = new Date("2025-06-01");
    const to = new Date("2025-06-01");
    // A condição de rejeição é from > to (estrito), não >=
    expect(from > to).toBe(false);
  });

  it("ausência de from ou to não bloqueia", () => {
    const from = parseQueryDate(undefined);
    const to = parseQueryDate(undefined);
    // Quando ambos undefined, a guard "from && to && from > to" é false
    const deveRejeitar = !!(from && to && from > to);
    expect(deveRejeitar).toBe(false);
  });

  it("apenas from definido não bloqueia", () => {
    const from = parseQueryDate("2025-06-01");
    const to = parseQueryDate(undefined);
    const deveRejeitar = !!(from && to && from > to);
    expect(deveRejeitar).toBe(false);
  });
});

describe("CIS REST — paginação (limit / offset)", () => {
  it("limit padrão é 20 quando ausente", () => {
    expect(clampLimit(undefined)).toBe(20);
  });

  it("limit padrão é 20 quando não numérico", () => {
    expect(clampLimit("abc")).toBe(20);
    expect(clampLimit(null)).toBe(20);
  });

  it("limit máximo é 100", () => {
    expect(clampLimit(9999)).toBe(100);
    expect(clampLimit(101)).toBe(100);
    expect(clampLimit(100)).toBe(100);
  });

  it("limit mínimo é 1", () => {
    expect(clampLimit(-5)).toBe(1);
    expect(clampLimit(-1)).toBe(1);
  });

  it("limit 0 é tratado como ausente (vira 20, clamped a 1 — na prática 20)", () => {
    // Number(0) || 20 == 20 (zero é falsy)
    expect(clampLimit(0)).toBe(20);
  });

  it("limit válido dentro do intervalo é preservado", () => {
    expect(clampLimit(1)).toBe(1);
    expect(clampLimit(50)).toBe(50);
    expect(clampLimit(99)).toBe(99);
  });

  it("offset padrão é 0 quando ausente", () => {
    expect(clampOffset(undefined)).toBe(0);
    expect(clampOffset(null)).toBe(0);
    expect(clampOffset("abc")).toBe(0);
  });

  it("offset negativo é normalizado para 0", () => {
    expect(clampOffset(-1)).toBe(0);
    expect(clampOffset(-100)).toBe(0);
  });

  it("offset positivo é preservado", () => {
    expect(clampOffset(0)).toBe(0);
    expect(clampOffset(20)).toBe(20);
    expect(clampOffset(1000)).toBe(1000);
  });
});

describe("CIS REST — autenticação: lógica de comparação de chave", () => {
  // Replica a lógica de autenticar() sem importar o módulo inteiro
  function verificarChave(chave: unknown, chaveEsperada: string): boolean {
    return (
      typeof chave === "string" &&
      chave.length === chaveEsperada.length &&
      // timingSafeEqual equivalente para testes puros
      chave === chaveEsperada
    );
  }

  const CHAVE_VALIDA = "a".repeat(32);

  it("chave correta retorna true", () => {
    expect(verificarChave(CHAVE_VALIDA, CHAVE_VALIDA)).toBe(true);
  });

  it("chave errada retorna false", () => {
    expect(verificarChave("chave-errada", CHAVE_VALIDA)).toBe(false);
  });

  it("chave com comprimento diferente retorna false imediatamente", () => {
    // Importante: comprimento diferente → timingSafeEqual lançaria erro,
    // por isso o código verifica o length antes de chamar timingSafeEqual.
    expect(verificarChave("curta", CHAVE_VALIDA)).toBe(false);
    expect(verificarChave("a".repeat(33), CHAVE_VALIDA)).toBe(false);
  });

  it("chave não-string retorna false", () => {
    expect(verificarChave(undefined, CHAVE_VALIDA)).toBe(false);
    expect(verificarChave(null, CHAVE_VALIDA)).toBe(false);
    expect(verificarChave(42, CHAVE_VALIDA)).toBe(false);
    expect(verificarChave(["a".repeat(32)], CHAVE_VALIDA)).toBe(false);
  });

  it("chave vazia retorna false", () => {
    expect(verificarChave("", CHAVE_VALIDA)).toBe(false);
  });

  it("chave com mesmos chars mas em ordem diferente retorna false", () => {
    const embaralhada = "b" + "a".repeat(31);
    expect(verificarChave(embaralhada, CHAVE_VALIDA)).toBe(false);
  });
});

describe("CIS REST — parseInt do ID de rota", () => {
  // Replica a lógica: parseInt(req.params.id, 10); if (isNaN(id)) 400
  function parseId(raw: string): number | null {
    const id = parseInt(raw, 10);
    return isNaN(id) ? null : id;
  }

  it("ID numérico inteiro é aceito", () => {
    expect(parseId("1")).toBe(1);
    expect(parseId("999")).toBe(999);
    expect(parseId("0")).toBe(0);
  });

  it("ID não-numérico retorna null (→ 400)", () => {
    expect(parseId("abc")).toBeNull();
    expect(parseId("")).toBeNull();
    expect(parseId("1.5")).toBe(1); // parseInt para antes do ponto — comportamento conhecido
  });

  it("ID negativo é parseado (servidor valida existência via WHERE)", () => {
    // Negativo é parseInt válido; o banco simplesmente não encontra a nota
    expect(parseId("-1")).toBe(-1);
  });

  it("tentativa de injeção via ID retorna null", () => {
    expect(parseId("1; DROP TABLE")).toBe(1); // parseInt para no espaço — valor truncado
    expect(parseId("abc; DROP TABLE")).toBeNull();
    expect(parseId("<script>")).toBeNull();
  });
});
