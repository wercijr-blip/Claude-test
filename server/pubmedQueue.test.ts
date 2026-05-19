import { describe, it, expect, vi } from "vitest";
import { extrairGradeMetadata } from "./pubmedQueue.ts";

vi.mock("./_core/env.ts", () => ({
  env: {
    NODE_ENV: "test",
    BUILT_IN_FORGE_API_URL: "https://api.anthropic.com",
    BUILT_IN_FORGE_API_KEY: "test-key",
    MEDICO_NOME: "Dr. Teste",
    MEDICO_CRM: "12345",
    MEDICO_CRM_UF: "DF",
    MEDICO_CRM_TIPO: "CRM",
    MEDICO_RQE: "RQE 99999",
    CLINICA_NOME: "Clínica Teste",
    SUS_CNES: "0000000",
    OPUS_DAILY_TOKEN_BUDGET: 50_000,
    QUEUE_PREFIX: "{fp-test}",
  },
}));

vi.mock("./_core/redis.ts", () => ({
  redis: { get: vi.fn(), incrby: vi.fn(), expire: vi.fn() },
  QUEUE_PREFIX: "{fp-test}",
}));

vi.mock("./_core/logger.ts", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("bullmq", () => ({
  Queue: vi.fn().mockImplementation(() => ({ add: vi.fn() })),
  Worker: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
  })),
}));

// ── extrairGradeMetadata ──────────────────────────────────────────────────────

describe("extrairGradeMetadata", () => {
  it("conta menções de GRADE 1A e 1B corretamente", () => {
    const sintese = `
## Recomendações
TMP-SMX é primeira linha (GRADE 1A) para PCP.
Pentamidina é alternativa (GRADE 1B) em alérgicos a sulfa.
Atovaquona também tem GRADE 1B em intolerância.
`;
    const resultado = extrairGradeMetadata(sintese);

    expect(resultado.grade1A).toBe(1);
    expect(resultado.grade1B).toBe(2);
    expect(resultado.grade2A).toBe(0);
  });

  it("conta todos os níveis GRADE independentemente", () => {
    const sintese = `
GRADE 1A mencionado aqui.
GRADE 2B em outro ponto.
GRADE 2B novamente.
GRADE 3 para opinião de especialista.
GRADE 5 para bench research.
`;
    const resultado = extrairGradeMetadata(sintese);

    expect(resultado.grade1A).toBe(1);
    expect(resultado.grade2B).toBe(2);
    expect(resultado.grade3).toBe(1);
    expect(resultado.grade5).toBe(1);
  });

  it("extrai bullets da seção 4a. Lacunas (máximo 3)", () => {
    const sintese = `
## 4. Cobertura e Artigos Desatualizados

**4a. Lacunas de cobertura**
- Ausência de dados em pediatria
- Falta de estudos em transplantados
- Sem dados para populações afro-brasileiras
- Quarta lacuna que deve ser ignorada

**4b. Artigos > 5 anos**
Todos recentes.
`;
    const resultado = extrairGradeMetadata(sintese);

    expect(resultado.lacunas).toHaveLength(3);
    expect(resultado.lacunas[0]).toBe("Ausência de dados em pediatria");
    expect(resultado.lacunas[1]).toBe("Falta de estudos em transplantados");
  });

  it("conta PMIDs únicos citados (ignora duplicatas)", () => {
    const sintese = `
Segundo estudo [PMID 11111111] mostrou X.
Confirmado por [PMID 22222222] e [PMID 11111111] novamente.
Terceiro: [PMID 33333333].
`;
    const resultado = extrairGradeMetadata(sintese);

    expect(resultado.totalCitacoes).toBe(3);
  });

  it("retorna zeros e arrays vazios para síntese sem GRADE ou PMIDs", () => {
    const resultado = extrairGradeMetadata(
      "Síntese sem evidências gradeadas e sem referências.",
    );

    expect(resultado.grade1A).toBe(0);
    expect(resultado.grade1B).toBe(0);
    expect(resultado.lacunas).toHaveLength(0);
    expect(resultado.totalCitacoes).toBe(0);
  });

  it("é case-insensitive para GRADE", () => {
    const sintese = "Evidência de grade 1A confirmada em grade 2B.";
    const resultado = extrairGradeMetadata(sintese);

    expect(resultado.grade1A).toBe(1);
    expect(resultado.grade2B).toBe(1);
  });
});
