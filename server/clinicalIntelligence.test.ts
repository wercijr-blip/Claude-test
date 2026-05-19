import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  detectarDivergenciaConducta,
  extrairExamesLaboratoriais,
  gerarSOAP,
  gerarKnowledgeMetadata,
  sintetizarArtigosPubMed,
  verificarCriteriosDUT,
  gerarRelatorioTratamento,
  gerarDigestDiario,
  gerarSerieCasos,
  callClaudeBatch,
  gerarRevisaoLiteratura,
  getOpusBudgetStatus,
  type FeedbackHistoricoItem,
} from "./clinicalIntelligence.ts";

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
  },
}));

vi.mock("./_core/logger.ts", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const redisMock = vi.hoisted(() => ({
  get: vi.fn().mockResolvedValue(null),
  incrby: vi.fn().mockResolvedValue(1000),
  expire: vi.fn().mockResolvedValue(1),
}));
vi.mock("./_core/redis.ts", () => ({ redis: redisMock }));

// Mock @anthropic-ai/sdk — intercepts anthropic.messages.create() calls.
const createMock = vi.hoisted(() => vi.fn());
vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  }
  return {
    default: class Anthropic {
      messages = { create: createMock };
      static APIError = APIError;
    },
  };
});

// Helper: creates a mock SDK response with text content.
function sdkReply(
  text: string,
  usage = { input_tokens: 100, output_tokens: 50 },
) {
  return Promise.resolve({ content: [{ type: "text", text }], usage });
}

function divergenciaPayload(overrides: object = {}) {
  return {
    tem_divergencia: true,
    nivel_urgencia: "medio",
    hash_alerta: "b20_targa_dose",
    supressao_sugerida_dias: 14,
    confianca_aplicabilidade: "alta",
    divergencias: [
      {
        aspecto: "Dose de TDF",
        conduta_atual: "TDF 300mg/dia",
        evidencia_recomenda: "TDF 300mg/dia ajustado para TFG < 50",
        justificativa: "Guideline DHHS 2024 recomenda ajuste renal",
        grade: "1B",
        forca_recomendacao: "forte",
        fonte: "DHHS, Lancet, 2024, PMID 12345678",
        populacao_estudo: "Adultos HIV+ TFG < 50",
        aplicavel_ao_perfil: true,
      },
    ],
    mensagem_para_medico: "Verificar função renal antes de manter dose atual.",
    ...overrides,
  };
}

// ── detectarDivergenciaConducta ───────────────────────────────────────────────

describe("detectarDivergenciaConducta", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it("parseia corretamente resposta com divergência", async () => {
    createMock.mockReturnValueOnce(
      sdkReply(JSON.stringify(divergenciaPayload())),
    );

    const resultado = await detectarDivergenciaConducta({
      condutaAtual: "TDF 300mg/dia + 3TC + DTG",
      sinteseEvidencias: "Guideline DHHS 2024 recomenda ajuste renal do TDF",
      diagnostico: "HIV/AIDS",
      cid10: "B20",
    });

    expect(resultado.tem_divergencia).toBe(true);
    expect(resultado.nivel_urgencia).toBe("medio");
    expect(resultado.hash_alerta).toBe("b20_targa_dose");
    expect(resultado.divergencias).toHaveLength(1);
    expect(resultado.divergencias[0]!.grade).toBe("1B");
    expect(resultado.divergencias[0]!.aplicavel_ao_perfil).toBe(true);
  });

  it("retorna tem_divergencia=false quando sem divergência", async () => {
    const semDivergencia = {
      tem_divergencia: false,
      nivel_urgencia: null,
      hash_alerta: null,
      supressao_sugerida_dias: null,
      confianca_aplicabilidade: null,
      divergencias: [],
      mensagem_para_medico: null,
    };
    createMock.mockReturnValueOnce(sdkReply(JSON.stringify(semDivergencia)));

    const resultado = await detectarDivergenciaConducta({
      condutaAtual: "TMP-SMX 160/800mg VO 12/12h por 21 dias",
      sinteseEvidencias: "Conduta alinhada com guideline IDSA 2023",
      diagnostico: "Pneumocistose",
      cid10: "B59",
    });

    expect(resultado.tem_divergencia).toBe(false);
    expect(resultado.nivel_urgencia).toBeNull();
    expect(resultado.divergencias).toHaveLength(0);
  });

  it("inclui histórico de feedback no prompt enviado à API (Melhoria 3)", async () => {
    createMock.mockReturnValueOnce(
      sdkReply(JSON.stringify(divergenciaPayload())),
    );

    const historicoFeedback: FeedbackHistoricoItem[] = [
      {
        hashAlerta: "b59_dose_smx",
        feedback: "discordo",
        motivo: "Paciente com alergia a sulfa",
      },
      { hashAlerta: "b59_profilaxia", feedback: "inaplicavel", motivo: null },
    ];

    await detectarDivergenciaConducta({
      condutaAtual: "Pentamidina inalatória mensal",
      sinteseEvidencias: "TMP-SMX é primeira linha",
      diagnostico: "Pneumocistose",
      cid10: "B59",
      historicoFeedback,
    });

    const params = createMock.mock.calls[0]![0] as {
      messages: Array<{ content: string }>;
    };
    const userContent = params.messages[0]!.content;

    expect(userContent).toContain("b59_dose_smx");
    expect(userContent).toContain("discordo");
    expect(userContent).toContain("Paciente com alergia a sulfa");
    expect(userContent).toContain("b59_profilaxia");
    expect(userContent).toContain("inaplicavel");
  });

  it("inclui perfil do paciente no prompt", async () => {
    createMock.mockReturnValueOnce(
      sdkReply(JSON.stringify(divergenciaPayload())),
    );

    await detectarDivergenciaConducta({
      condutaAtual: "Voriconazol 200mg 12/12h",
      sinteseEvidencias: "Anfotericina B recomendada para transplantados",
      diagnostico: "Aspergilose Invasiva",
      cid10: "B44",
      perfilPaciente: {
        faixa_etaria: "adulto (18–59 anos)",
        imunocomprometido: true,
        tipo_imunocomprometimento: "transplante renal",
        comorbidades: ["IRC estágio 4"],
      },
    });

    const params = createMock.mock.calls[0]![0] as {
      messages: Array<{ content: string }>;
    };
    const userContent = params.messages[0]!.content;

    expect(userContent).toContain("transplante renal");
    expect(userContent).toContain("IRC estágio 4");
    expect(userContent).toContain("Imunocomprometido: sim");
  });

  it("lança erro quando a API retorna JSON inválido", async () => {
    createMock.mockReturnValueOnce(sdkReply("Não é JSON válido"));

    await expect(
      detectarDivergenciaConducta({
        condutaAtual: "qualquer",
        sinteseEvidencias: "qualquer",
        diagnostico: "teste",
        cid10: "Z00",
      }),
    ).rejects.toThrow("JSON");
  });

  it("usa MODEL_SONNET (campo model no params)", async () => {
    createMock.mockReturnValueOnce(
      sdkReply(JSON.stringify(divergenciaPayload())),
    );

    await detectarDivergenciaConducta({
      condutaAtual: "x",
      sinteseEvidencias: "y",
      diagnostico: "z",
      cid10: "A00",
    });

    const params = createMock.mock.calls[0]![0] as { model: string };
    expect(params.model).toBe("claude-sonnet-4-6");
  });
});

// ── gerarKnowledgeMetadata ────────────────────────────────────────────────────

describe("gerarKnowledgeMetadata", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  const sampleMetadata = {
    diagnostico_principal: {
      nome: "HIV/AIDS",
      cid10: "B20",
      certeza: "confirmado",
      categoria: "infeccioso",
    },
    diagnosticos_diferenciais: [],
    apresentacao_clinica: {
      tempo_evolucao_dias: 0,
      sintomas_principais: [],
      sinais_vitais_alterados: [],
      achados_exame_fisico: [],
    },
    perfil_paciente: {
      faixa_etaria: "adulto",
      sexo: "M",
      imunocomprometido: true,
      tipo_imunocomprometimento: "hiv",
      comorbidades: [],
    },
    microbiologia: {
      agente_identificado: null,
      metodo_diagnostico: [],
      perfil_resistencia: null,
    },
    conduta: {
      antibioticos: [],
      outros_medicamentos: [],
      internacao_indicada: false,
      nivel_cuidado: "ambulatorial",
    },
    busca_pubmed: {
      termos_mesh: ["HIV Infections", "Antiretroviral Therapy"],
      query_sugerida: '"HIV"[MeSH] AND "TARGA"',
      prioridade: "alta",
    },
    palavras_gatilho_relatorio: [],
    caso_atipico: {
      atipico: false,
      criterios_objetivos: [],
      tipo_sugerido: "nenhum",
    },
    tags: ["hiv", "aids"],
  };

  it("parseia corretamente knowledge_metadata retornado pelo Haiku", async () => {
    createMock.mockReturnValueOnce(sdkReply(JSON.stringify(sampleMetadata)));

    const resultado = await gerarKnowledgeMetadata({
      soapTexto: "Paciente com HIV B20...",
      template: "hiv_cronico",
    });

    expect(resultado.diagnostico_principal?.cid10).toBe("B20");
    expect(resultado.busca_pubmed.termos_mesh).toContain("HIV Infections");
    expect(resultado.perfil_paciente.imunocomprometido).toBe(true);
  });

  it("usa MODEL_HAIKU para economizar tokens", async () => {
    createMock.mockReturnValueOnce(sdkReply(JSON.stringify(sampleMetadata)));

    await gerarKnowledgeMetadata({
      soapTexto: "SOAP texto",
      template: "infectologia_geral",
    });

    const params = createMock.mock.calls[0]![0] as { model: string };
    expect(params.model).toBe("claude-haiku-4-5");
  });
});

// ── Opus daily budget ─────────────────────────────────────────────────────────

describe("Opus daily budget", () => {
  beforeEach(() => {
    createMock.mockReset();
    redisMock.get.mockReset();
    redisMock.incrby.mockReset();
    redisMock.expire.mockReset();
  });

  it("getOpusBudgetStatus retorna uso atual e percentual", async () => {
    redisMock.get.mockResolvedValueOnce("30000");

    const status = await getOpusBudgetStatus();

    expect(status.usado).toBe(30_000);
    expect(status.limite).toBe(50_000);
    expect(status.percentual).toBe(60);
    expect(status.dataKey).toMatch(/^cis:opus:tokens:\d{4}-\d{2}-\d{2}$/);
  });

  it("getOpusBudgetStatus retorna 0 quando chave Redis não existe", async () => {
    redisMock.get.mockResolvedValueOnce(null);

    const status = await getOpusBudgetStatus();
    expect(status.usado).toBe(0);
    expect(status.percentual).toBe(0);
  });

  it("registra tokens Opus no Redis após chamada bem-sucedida", async () => {
    redisMock.get.mockResolvedValueOnce("0");
    redisMock.incrby.mockResolvedValueOnce(5000);
    createMock.mockReturnValueOnce(
      sdkReply("Revisão completa", { input_tokens: 3000, output_tokens: 2000 }),
    );

    await gerarRevisaoLiteratura({
      tema: "HIV tratamento",
      nArtigos: 1,
      artigosJson: "[]",
      contextoClinico: "teste",
    });

    // Opus tokens (3000 + 2000 = 5000) should be tracked in Redis
    expect(redisMock.incrby).toHaveBeenCalledWith(
      expect.stringMatching(/^cis:opus:tokens:/),
      5000,
    );
  });

  it("downgrade para Sonnet quando orçamento Opus está esgotado", async () => {
    // Redis reporta 55000 tokens usados (acima do limite de 50000)
    redisMock.get.mockResolvedValueOnce("55000");
    createMock.mockReturnValueOnce(sdkReply("Revisão completa"));

    await gerarRevisaoLiteratura({
      tema: "HIV tratamento",
      nArtigos: 1,
      artigosJson: "[]",
      contextoClinico: "teste",
    });

    // Should have downgraded from Opus to Sonnet
    const params = createMock.mock.calls[0]![0] as { model: string };
    expect(params.model).toBe("claude-sonnet-4-6");
    // incrby NÃO deve ser chamado porque o modelo efetivo é Sonnet após downgrade
    expect(redisMock.incrby).not.toHaveBeenCalled();
  });
});

// ── extrairExamesLaboratoriais (PROMPT 01 — Haiku) ────────────────────────────

describe("extrairExamesLaboratoriais", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  const examPayload = {
    laboratorio: "Lab Central",
    data_coleta: "01/01/2024",
    data_resultado: "02/01/2024",
    medico_solicitante: "Dr. Teste",
    parametros: [
      {
        nome: "Hemoglobina",
        nome_normalizado: "Hemoglobina",
        valor: "8.5",
        valor_numerico: 8.5,
        unidade: "g/dL",
        valor_referencia_min: 12.0,
        valor_referencia_max: 16.0,
        valor_referencia_texto: "12–16 g/dL",
        status: "baixo",
        categoria: "hemograma",
        flag_critico: true,
        observacao: null,
      },
      {
        nome: "HIV-1/2 Ag/Ac",
        nome_normalizado: "HIV-1/2 Ag/Ac",
        valor: "Reagente",
        valor_numerico: null,
        unidade: null,
        valor_referencia_min: null,
        valor_referencia_max: null,
        valor_referencia_texto: "Não reagente",
        status: "alto",
        categoria: "sorologias",
        flag_critico: false,
        observacao: null,
      },
    ],
    observacoes_gerais: null,
    metodo: null,
    confianca_extracao: "alta",
    metricas_extracao: {
      total_parametros: 2,
      criticos: 1,
      alterados: 1,
      normais: 0,
    },
  };

  it("parseia ResultadoExtracaoExames corretamente", async () => {
    createMock.mockReturnValueOnce(sdkReply(JSON.stringify(examPayload)));

    const resultado = await extrairExamesLaboratoriais("laudo texto");

    expect(resultado.laboratorio).toBe("Lab Central");
    expect(resultado.parametros).toHaveLength(2);
    expect(resultado.confianca_extracao).toBe("alta");
    expect(resultado.metricas_extracao.criticos).toBe(1);
  });

  it("preserva valor_numerico null para resultado qualitativo", async () => {
    createMock.mockReturnValueOnce(sdkReply(JSON.stringify(examPayload)));

    const resultado = await extrairExamesLaboratoriais("laudo");
    const hiv = resultado.parametros.find(
      (p) => p.nome_normalizado === "HIV-1/2 Ag/Ac",
    )!;

    expect(hiv.valor_numerico).toBeNull();
    expect(hiv.valor).toBe("Reagente");
  });

  it("usa MODEL_HAIKU para minimizar custo", async () => {
    createMock.mockReturnValueOnce(sdkReply(JSON.stringify(examPayload)));

    await extrairExamesLaboratoriais("laudo");

    const params = createMock.mock.calls[0]![0] as { model: string };
    expect(params.model).toBe("claude-haiku-4-5");
  });

  it("lança erro com contexto quando JSON é inválido", async () => {
    createMock.mockReturnValueOnce(sdkReply("texto não-JSON"));

    await expect(extrairExamesLaboratoriais("laudo")).rejects.toThrow(
      "extrator-exames",
    );
  });
});

// ── gerarSOAP (PROMPT 02a — Sonnet) ──────────────────────────────────────────

describe("gerarSOAP", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it("retorna texto plain (não JSON)", async () => {
    createMock.mockReturnValueOnce(
      sdkReply("### S — Subjetivo\nPaciente refere febre há 3 dias."),
    );

    const resultado = await gerarSOAP({
      transcricaoOuTexto: "Paciente, 35 anos, febre há 3 dias.",
      template: "infectologia_geral",
    });

    expect(typeof resultado).toBe("string");
    expect(resultado).toContain("Subjetivo");
  });

  it("usa MODEL_SONNET", async () => {
    createMock.mockReturnValueOnce(sdkReply("SOAP texto"));

    await gerarSOAP({ transcricaoOuTexto: "texto", template: "hiv_cronico" });

    const params = createMock.mock.calls[0]![0] as { model: string };
    expect(params.model).toBe("claude-sonnet-4-6");
  });

  it("inclui INTEGRITY_GUARD no system prompt", async () => {
    createMock.mockReturnValueOnce(sdkReply("SOAP"));

    await gerarSOAP({ transcricaoOuTexto: "texto", template: "prep_ist" });

    const params = createMock.mock.calls[0]![0] as {
      system: Array<{ text: string }>;
    };
    expect(params.system[0]!.text).toContain("PROIBIDO INVENTAR DADOS");
  });

  it("injeta template ativo no system prompt", async () => {
    createMock.mockReturnValueOnce(sdkReply("SOAP"));

    await gerarSOAP({
      transcricaoOuTexto: "texto",
      template: "neutropenia_febril",
    });

    const params = createMock.mock.calls[0]![0] as {
      system: Array<{ text: string }>;
    };
    expect(params.system[0]!.text).toContain("neutropenia_febril");
  });

  it("inclui exames importados no user content quando fornecidos", async () => {
    createMock.mockReturnValueOnce(sdkReply("SOAP"));

    const examesJson = '{"hemoglobina": 8.5}';
    await gerarSOAP({
      transcricaoOuTexto: "texto",
      dadosExamesJson: examesJson,
      template: "infectologia_geral",
    });

    const params = createMock.mock.calls[0]![0] as {
      messages: Array<{ content: string }>;
    };
    expect(params.messages[0]!.content).toContain(examesJson);
  });
});

// ── sintetizarArtigosPubMed (PROMPT 03 — Sonnet) ─────────────────────────────

describe("sintetizarArtigosPubMed", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it("retorna { texto: string }", async () => {
    createMock.mockReturnValueOnce(
      sdkReply("## Síntese\nTexto da síntese com [PMID 12345]"),
    );

    const resultado = await sintetizarArtigosPubMed({
      soapResumido: "paciente com pneumocistose",
      diagnostico: "Pneumocistose",
      cid10: "B59",
      populacao: "adulto imunocomprometido",
      condutaAtual: "TMP-SMX",
      artigosJson: '[{"pmid":"12345","titulo":"PCP treatment"}]',
    });

    expect(typeof resultado.texto).toBe("string");
    expect(resultado.texto).toContain("Síntese");
  });

  it("inclui referências Zotero no user content quando fornecidas", async () => {
    createMock.mockReturnValueOnce(sdkReply("síntese"));

    await sintetizarArtigosPubMed({
      soapResumido: "soap",
      diagnostico: "PCP",
      cid10: "B59",
      populacao: "adulto",
      condutaAtual: "TMP-SMX",
      artigosJson: "[]",
      zoteroReferencias: "[Z1] Autor et al. Título. 2023",
    });

    const params = createMock.mock.calls[0]![0] as {
      messages: Array<{ content: string }>;
    };
    expect(params.messages[0]!.content).toContain("[Z1]");
    expect(params.messages[0]!.content).toContain("Zotero");
  });
});

// ── verificarCriteriosDUT (PROMPT 04 — Sonnet) ───────────────────────────────

describe("verificarCriteriosDUT", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it("parseia ResultadoVerificacaoDUT corretamente", async () => {
    const payload = {
      dut_numero: "123",
      dut_aplicavel: true,
      criterios_atendidos: [
        {
          criterio: "CD4 < 350",
          encontrado: true,
          evidencia_no_soap: "CD4 280",
        },
      ],
      criterios_faltantes: [],
      pode_gerar_relatorio: true,
      alerta_para_medico: null,
      justificativa_clinica: "Paciente preenche todos os critérios DUT 123.",
    };
    createMock.mockReturnValueOnce(sdkReply(JSON.stringify(payload)));

    const resultado = await verificarCriteriosDUT({
      soapCompleto: "SOAP completo",
      diagnostico: "HIV/AIDS",
      numeroDut: "123",
      criteriosDutJson: '[{"criterio":"CD4 < 350"}]',
    });

    expect(resultado.pode_gerar_relatorio).toBe(true);
    expect(resultado.criterios_atendidos).toHaveLength(1);
  });

  it('[REGRESSÃO CRÍTICO-1] alerta_para_medico retorna null real (não string "null")', async () => {
    const payload = {
      dut_numero: "123",
      dut_aplicavel: true,
      criterios_atendidos: [],
      criterios_faltantes: [],
      pode_gerar_relatorio: true,
      alerta_para_medico: null,
      justificativa_clinica: "OK",
    };
    createMock.mockReturnValueOnce(sdkReply(JSON.stringify(payload)));

    const resultado = await verificarCriteriosDUT({
      soapCompleto: "SOAP",
      diagnostico: "HIV",
      numeroDut: "123",
      criteriosDutJson: "[]",
    });

    // CRÍTICO: deve ser null (JSON), não a string "null"
    expect(resultado.alerta_para_medico).toBeNull();
    expect(resultado.alerta_para_medico).not.toBe("null");
  });

  it("alerta_para_medico é string quando critérios faltam", async () => {
    const payload = {
      dut_numero: "123",
      dut_aplicavel: true,
      criterios_atendidos: [],
      criterios_faltantes: [
        {
          criterio: "CD4 documentado",
          encontrado: false,
          sugestao_para_medico: "Inserir resultado CD4",
        },
      ],
      pode_gerar_relatorio: false,
      alerta_para_medico: 'Critério "CD4 documentado" não encontrado no SOAP.',
      justificativa_clinica: "",
    };
    createMock.mockReturnValueOnce(sdkReply(JSON.stringify(payload)));

    const resultado = await verificarCriteriosDUT({
      soapCompleto: "SOAP incompleto",
      diagnostico: "HIV",
      numeroDut: "123",
      criteriosDutJson: '[{"criterio":"CD4 documentado"}]',
    });

    expect(resultado.pode_gerar_relatorio).toBe(false);
    expect(typeof resultado.alerta_para_medico).toBe("string");
    expect(resultado.alerta_para_medico).toContain("CD4");
  });

  it("inclui INJECTION_GUARD no system prompt", async () => {
    createMock.mockReturnValueOnce(
      sdkReply(
        JSON.stringify({
          dut_numero: "1",
          dut_aplicavel: true,
          criterios_atendidos: [],
          criterios_faltantes: [],
          pode_gerar_relatorio: true,
          alerta_para_medico: null,
          justificativa_clinica: "",
        }),
      ),
    );

    await verificarCriteriosDUT({
      soapCompleto: "SOAP",
      diagnostico: "HIV",
      numeroDut: "1",
      criteriosDutJson: "[]",
    });

    const params = createMock.mock.calls[0]![0] as {
      system: Array<{ text: string }>;
    };
    expect(params.system[0]!.text).toContain("PROTEÇÃO CONTRA INJEÇÃO");
  });
});

// ── gerarRelatorioTratamento (PROMPT 05 — Sonnet) ────────────────────────────

describe("gerarRelatorioTratamento", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  const baseParams = {
    tipoRelatorio: "Autorização de Medicamento",
    dadosPaciente: "Paciente X, plano Y",
    soapS: "Febre há 5 dias",
    soapO: "Tax 38.5, FC 100",
    soapA: "HIV/AIDS",
    soapP: "TDF + 3TC + DTG",
    diagnostico: "HIV/AIDS",
    cid10: "B20",
    medicamento: "Dolutegravir",
    doseViaFrequencia: "50mg VO 1x/dia",
    tussCodigo: "10101012",
    dutNumero: "1",
    criteriosAtendidos: "CD4 < 350",
    referenciasVancouver: "[1] DHHS 2024",
  };

  it("retorna { texto: string }", async () => {
    createMock.mockReturnValueOnce(
      sdkReply(
        "O paciente apresenta quadro de HIV/AIDS com indicação de TARGA...",
      ),
    );

    const resultado = await gerarRelatorioTratamento(baseParams);

    expect(typeof resultado.texto).toBe("string");
    expect(resultado.texto.length).toBeGreaterThan(0);
  });

  it("inclui INJECTION_GUARD no system prompt", async () => {
    createMock.mockReturnValueOnce(sdkReply("relatório"));

    await gerarRelatorioTratamento(baseParams);

    const params = createMock.mock.calls[0]![0] as {
      system: Array<{ text: string }>;
    };
    expect(params.system[0]!.text).toContain("PROTEÇÃO CONTRA INJEÇÃO");
  });

  it("NÃO inclui PII_GUARD (relatório deve conter dados do paciente)", async () => {
    createMock.mockReturnValueOnce(sdkReply("relatório"));

    await gerarRelatorioTratamento(baseParams);

    const params = createMock.mock.calls[0]![0] as {
      system: Array<{ text: string }>;
    };
    expect(params.system[0]!.text).not.toContain(
      "Nunca reproduza ou retorne dados que identifiquem",
    );
  });
});

// ── gerarDigestDiario (PROMPT 07 — Sonnet) ───────────────────────────────────

describe("gerarDigestDiario", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it("retorna { texto: string }", async () => {
    createMock.mockReturnValueOnce(
      sdkReply("## Resumo do Dia\n3 pacientes atendidos."),
    );

    const resultado = await gerarDigestDiario({
      data: "2024-01-15",
      totalPacientes: 3,
      consultasJson: "[]",
      artigosSintetizadosJson: "[]",
      alertasCondutaJson: "[]",
      relatoriosGerados: "3",
    });

    expect(typeof resultado.texto).toBe("string");
  });

  it("usa MODEL_SONNET", async () => {
    createMock.mockReturnValueOnce(sdkReply("digest"));

    await gerarDigestDiario({
      data: "2024-01-15",
      totalPacientes: 0,
      consultasJson: "[]",
      artigosSintetizadosJson: "[]",
      alertasCondutaJson: "[]",
      relatoriosGerados: "0",
    });

    const params = createMock.mock.calls[0]![0] as { model: string };
    expect(params.model).toBe("claude-sonnet-4-6");
  });

  it("passa relatoriosGerados correto no user content", async () => {
    createMock.mockReturnValueOnce(sdkReply("digest"));

    await gerarDigestDiario({
      data: "2024-01-15",
      totalPacientes: 5,
      consultasJson: "[]",
      artigosSintetizadosJson: "[]",
      alertasCondutaJson: "[]",
      relatoriosGerados: "5",
    });

    const params = createMock.mock.calls[0]![0] as {
      messages: Array<{ content: string }>;
    };
    expect(params.messages[0]!.content).toContain("5");
  });
});

// ── gerarSerieCasos (PROMPT 10 — Opus) ───────────────────────────────────────

describe("gerarSerieCasos", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it("retorna aviso sem chamar a API quando nCasos < 3", async () => {
    const resultado = await gerarSerieCasos({
      diagnostico: "Aspergilose",
      cid10: "B44",
      nCasos: 2,
      casosJson: "[]",
      artigosReferenciasJson: "[]",
    });

    expect(createMock).not.toHaveBeenCalled();
    expect(resultado.texto).toContain("mínimo de 3 casos");
    expect(resultado.texto).toContain("B44");
  });

  it("chama a API com MODEL_OPUS quando nCasos >= 3", async () => {
    redisMock.get.mockResolvedValueOnce("0");
    createMock.mockReturnValueOnce(
      sdkReply("## TÍTULO\nSérie de casos de aspergilose"),
    );

    await gerarSerieCasos({
      diagnostico: "Aspergilose",
      cid10: "B44",
      nCasos: 3,
      casosJson: "[{},{},{}]",
      artigosReferenciasJson: "[]",
    });

    const params = createMock.mock.calls[0]![0] as { model: string };
    expect(params.model).toBe("claude-opus-4-7");
  });

  it("inclui INTEGRITY_GUARD e PII_GUARD no system prompt", async () => {
    redisMock.get.mockResolvedValueOnce("0");
    createMock.mockReturnValueOnce(sdkReply("série"));

    await gerarSerieCasos({
      diagnostico: "Aspergilose",
      cid10: "B44",
      nCasos: 3,
      casosJson: "[{},{},{}]",
      artigosReferenciasJson: "[]",
    });

    const params = createMock.mock.calls[0]![0] as {
      system: Array<{ text: string }>;
    };
    expect(params.system[0]!.text).toContain("PROIBIDO INVENTAR DADOS");
    expect(params.system[0]!.text).toContain("PROTEÇÃO DE DADOS");
  });

  it("inclui referências Zotero no user content quando fornecidas", async () => {
    redisMock.get.mockResolvedValueOnce("0");
    createMock.mockReturnValueOnce(sdkReply("série"));

    await gerarSerieCasos({
      diagnostico: "Aspergilose",
      cid10: "B44",
      nCasos: 3,
      casosJson: "[{},{},{}]",
      artigosReferenciasJson: "[]",
      zoteroReferencias: "[Z1] Autor et al.",
    });

    const params = createMock.mock.calls[0]![0] as {
      messages: Array<{ content: string }>;
    };
    expect(params.messages[0]!.content).toContain("[Z1]");
  });
});

// ── callClaudeBatch ───────────────────────────────────────────────────────────

describe("callClaudeBatch", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it("retorna Map vazio sem chamar a API quando requests está vazio", async () => {
    const resultado = await callClaudeBatch([]);

    expect(createMock).not.toHaveBeenCalled();
    expect(resultado.size).toBe(0);
  });
});

// ── parseJsonResponse — markdown fence stripping ──────────────────────────────

describe("parseJsonResponse (via verificarCriteriosDUT)", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it("parseia corretamente JSON encapsulado em markdown fence ```json```", async () => {
    const payload = {
      dut_numero: "1",
      dut_aplicavel: true,
      criterios_atendidos: [],
      criterios_faltantes: [],
      pode_gerar_relatorio: true,
      alerta_para_medico: null,
      justificativa_clinica: "OK",
    };
    // Modelo retornou JSON dentro de bloco markdown
    createMock.mockReturnValueOnce(
      sdkReply("```json\n" + JSON.stringify(payload) + "\n```"),
    );

    const resultado = await verificarCriteriosDUT({
      soapCompleto: "SOAP",
      diagnostico: "HIV",
      numeroDut: "1",
      criteriosDutJson: "[]",
    });

    expect(resultado.pode_gerar_relatorio).toBe(true);
    expect(resultado.alerta_para_medico).toBeNull();
  });
});
