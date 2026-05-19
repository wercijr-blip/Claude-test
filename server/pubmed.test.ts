import { describe, it, expect, vi, beforeEach } from "vitest";
import { buscarArtigosDual, buscarArtigosPubMed } from "./pubmed.ts";

vi.mock("./_core/env.ts", () => ({
  env: {
    NODE_ENV: "test",
    NCBI_API_KEY: undefined,
  },
}));

vi.mock("./_core/logger.ts", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("./_core/redis.ts", () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    setex: vi.fn().mockResolvedValue("OK"),
  },
  QUEUE_PREFIX: "{fp-test}",
}));

// ── Sample MEDLINE data ───────────────────────────────────────────────────────

const MEDLINE_TWO_RECORDS = `\
PMID- 11111111
TI  - Trimethoprim-Sulfamethoxazole for Pneumocystis Pneumonia in HIV
AU  - Jones AB
AU  - Smith CD
TA  - N Engl J Med
DP  - 2023 Jan 15
AB  - Prospective RCT of TMP-SMX versus pentamidine for PCP prophylaxis.
AID - 10.1056/nejmtest001 [doi]

PMID- 22222222
TI  - Prophylaxis for Opportunistic Infections in HIV-Infected Adults
AU  - Brown EF
TA  - Clin Infect Dis
DP  - 2022 Jun 1
AB  - Updated guidelines for OI prophylaxis including PCP and toxoplasmosis.
AID - 10.1093/cid/ciztest002 [doi]
`;

function esearchReply(idlist: string[]): Response {
  return {
    ok: true,
    json: async () => ({ esearchresult: { idlist } }),
  } as unknown as Response;
}

function efetchReply(medlineText: string): Response {
  return {
    ok: true,
    text: async () => medlineText,
  } as unknown as Response;
}

// ── buscarArtigosDual ─────────────────────────────────────────────────────────

describe("buscarArtigosDual", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("deduplica PMIDs sobrepostos entre query livre e MeSH", async () => {
    const mockFetch = vi.mocked(fetch);

    // esearch livre → [11111111, 22222222, 33333333]
    mockFetch.mockResolvedValueOnce(
      esearchReply(["11111111", "22222222", "33333333"]),
    );
    // esearch MeSH  → [22222222, 33333333, 44444444] (dois sobrepostos)
    mockFetch.mockResolvedValueOnce(
      esearchReply(["22222222", "33333333", "44444444"]),
    );
    // efetch com lista deduplicada [11111111, 22222222, 33333333, 44444444]
    mockFetch.mockResolvedValueOnce(efetchReply(MEDLINE_TWO_RECORDS));

    await buscarArtigosDual(
      "PCP prophylaxis HIV",
      ["Pneumocystis carinii", "HIV Infections"],
      10,
    );

    // Verifica que efetch recebeu IDs deduplicados
    const efetchCall = mockFetch.mock.calls[2]!;
    const efetchUrl = efetchCall[0] as string;
    expect(efetchUrl).toContain("11111111");
    expect(efetchUrl).toContain("22222222");
    expect(efetchUrl).toContain("33333333");
    expect(efetchUrl).toContain("44444444");
    // Deve ter exatamente 4 IDs únicos (não 5 com repetições)
    const idParam = new URL(efetchUrl).searchParams.get("id") ?? "";
    const ids = idParam.split(",").filter(Boolean);
    expect(ids).toHaveLength(4);
  });

  it("preserva artigos da busca livre antes dos exclusivos MeSH", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(esearchReply(["11111111", "22222222"]));
    mockFetch.mockResolvedValueOnce(esearchReply(["33333333", "44444444"]));
    mockFetch.mockResolvedValueOnce(efetchReply(MEDLINE_TWO_RECORDS));

    await buscarArtigosDual("query livre", ["MeSH Term"], 10);

    const efetchUrl = mockFetch.mock.calls[2]![0] as string;
    const idParam = new URL(efetchUrl).searchParams.get("id") ?? "";
    const ids = idParam.split(",");
    // Livre primeiro: 11111111 e 22222222 antes de 33333333 e 44444444
    expect(ids.indexOf("11111111")).toBeLessThan(ids.indexOf("33333333"));
    expect(ids.indexOf("22222222")).toBeLessThan(ids.indexOf("44444444"));
  });

  it("limita total de PMIDs ao maxArtigos mesmo com sobreposição mínima", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(esearchReply(["1", "2", "3"]));
    mockFetch.mockResolvedValueOnce(esearchReply(["4", "5", "6"]));
    mockFetch.mockResolvedValueOnce(efetchReply(MEDLINE_TWO_RECORDS));

    await buscarArtigosDual("query", ["MeSH"], 4);

    const efetchUrl = mockFetch.mock.calls[2]![0] as string;
    const idParam = new URL(efetchUrl).searchParams.get("id") ?? "";
    expect(idParam.split(",").filter(Boolean)).toHaveLength(4);
  });

  it("executa as duas buscas em paralelo (dois esearch antes do efetch)", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(esearchReply(["11111111"]));
    mockFetch.mockResolvedValueOnce(esearchReply(["22222222"]));
    mockFetch.mockResolvedValueOnce(efetchReply(MEDLINE_TWO_RECORDS));

    await buscarArtigosDual("query", ["Term A"], 10);

    // Primeira e segunda chamada são esearch; terceira é efetch
    expect(mockFetch.mock.calls[0]![0] as string).toContain("esearch");
    expect(mockFetch.mock.calls[1]![0] as string).toContain("esearch");
    expect(mockFetch.mock.calls[2]![0] as string).toContain("efetch");
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("funciona com lista MeSH vazia (só busca livre)", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(esearchReply(["11111111"]));
    // Sem segunda esearch — MeSH vazio
    mockFetch.mockResolvedValueOnce(efetchReply(MEDLINE_TWO_RECORDS));

    await buscarArtigosDual("query livre sem mesh", [], 10);

    // Apenas 2 chamadas: esearch + efetch
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("retorna lista vazia sem erros quando esearch retorna 0 PMIDs", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(esearchReply([]));
    mockFetch.mockResolvedValueOnce(esearchReply([]));

    const artigos = await buscarArtigosDual(
      "query inexistente",
      ["MeSH Inexistente"],
      10,
    );

    expect(artigos).toEqual([]);
    // Não deve chamar efetch quando não há PMIDs
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

// ── Parser MEDLINE via buscarArtigosPubMed ────────────────────────────────────

describe("parseMedline (via buscarArtigosPubMed)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("parseia dois registros MEDLINE corretamente", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(esearchReply(["11111111", "22222222"]));
    mockFetch.mockResolvedValueOnce(efetchReply(MEDLINE_TWO_RECORDS));

    const artigos = await buscarArtigosPubMed("test query", 2);

    expect(artigos).toHaveLength(2);

    const pcp = artigos.find((a) => a.pmid === "11111111")!;
    expect(pcp.titulo).toBe(
      "Trimethoprim-Sulfamethoxazole for Pneumocystis Pneumonia in HIV",
    );
    expect(pcp.autores).toContain("Jones AB");
    expect(pcp.autores).toContain("Smith CD");
    expect(pcp.revista).toBe("N Engl J Med");
    expect(pcp.ano).toBe("2023");
    expect(pcp.doi).toBe("10.1056/nejmtest001");
    expect(pcp.abstract).toContain("TMP-SMX");
  });

  it("extrai DOI do campo AID com sufixo [doi]", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(esearchReply(["22222222"]));
    mockFetch.mockResolvedValueOnce(efetchReply(MEDLINE_TWO_RECORDS));

    const artigos = await buscarArtigosPubMed("test", 1);
    const artigo = artigos.find((a) => a.pmid === "22222222");

    expect(artigo?.doi).toBe("10.1093/cid/ciztest002");
  });

  it("retorna lista vazia sem lançar exceção quando esearch falha (HTTP 500)", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);

    const artigos = await buscarArtigosPubMed("query", 5);
    expect(artigos).toEqual([]);
  });
});
