import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  detectarDivergenciaConducta,
  gerarKnowledgeMetadata,
  type FeedbackHistoricoItem,
} from './clinicalIntelligence.ts'

vi.mock('./_core/env.ts', () => ({
  env: {
    NODE_ENV: 'test',
    BUILT_IN_FORGE_API_URL: 'https://api.anthropic.com',
    BUILT_IN_FORGE_API_KEY: 'test-key',
    MEDICO_NOME: 'Dr. Teste',
    MEDICO_CRM: '12345',
    MEDICO_CRM_UF: 'DF',
    MEDICO_CRM_TIPO: 'CRM',
    MEDICO_RQE: 'RQE 99999',
    CLINICA_NOME: 'Clínica Teste',
    SUS_CNES: '0000000',
  },
}))

vi.mock('./_core/logger.ts', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function claudeReply(text: string): Response {
  return {
    ok: true,
    json: async () => ({ content: [{ text }] }),
  } as unknown as Response
}

function divergenciaPayload(overrides: object = {}) {
  return {
    tem_divergencia: true,
    nivel_urgencia: 'medio',
    hash_alerta: 'b20_targa_dose',
    supressao_sugerida_dias: 14,
    confianca_aplicabilidade: 'alta',
    divergencias: [
      {
        aspecto: 'Dose de TDF',
        conduta_atual: 'TDF 300mg/dia',
        evidencia_recomenda: 'TDF 300mg/dia ajustado para TFG < 50',
        justificativa: 'Guideline DHHS 2024 recomenda ajuste renal',
        grade: '1B',
        forca_recomendacao: 'forte',
        fonte: 'DHHS, Lancet, 2024, PMID 12345678',
        populacao_estudo: 'Adultos HIV+ TFG < 50',
        aplicavel_ao_perfil: true,
      },
    ],
    mensagem_para_medico: 'Verificar função renal antes de manter dose atual.',
    ...overrides,
  }
}

// ── detectarDivergenciaConducta ───────────────────────────────────────────────

describe('detectarDivergenciaConducta', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('parseia corretamente resposta com divergência', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(claudeReply(JSON.stringify(divergenciaPayload())))

    const resultado = await detectarDivergenciaConducta({
      condutaAtual: 'TDF 300mg/dia + 3TC + DTG',
      sinteseEvidencias: 'Guideline DHHS 2024 recomenda ajuste renal do TDF',
      diagnostico: 'HIV/AIDS',
      cid10: 'B20',
    })

    expect(resultado.tem_divergencia).toBe(true)
    expect(resultado.nivel_urgencia).toBe('medio')
    expect(resultado.hash_alerta).toBe('b20_targa_dose')
    expect(resultado.divergencias).toHaveLength(1)
    expect(resultado.divergencias[0]!.grade).toBe('1B')
    expect(resultado.divergencias[0]!.aplicavel_ao_perfil).toBe(true)
  })

  it('retorna tem_divergencia=false quando sem divergência', async () => {
    const semDivergencia = {
      tem_divergencia: false,
      nivel_urgencia: null,
      hash_alerta: null,
      supressao_sugerida_dias: null,
      confianca_aplicabilidade: null,
      divergencias: [],
      mensagem_para_medico: null,
    }
    vi.mocked(fetch).mockResolvedValueOnce(claudeReply(JSON.stringify(semDivergencia)))

    const resultado = await detectarDivergenciaConducta({
      condutaAtual: 'TMP-SMX 160/800mg VO 12/12h por 21 dias',
      sinteseEvidencias: 'Conduta alinhada com guideline IDSA 2023',
      diagnostico: 'Pneumocistose',
      cid10: 'B59',
    })

    expect(resultado.tem_divergencia).toBe(false)
    expect(resultado.nivel_urgencia).toBeNull()
    expect(resultado.divergencias).toHaveLength(0)
  })

  it('inclui histórico de feedback no prompt enviado à API (Melhoria 3)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(claudeReply(JSON.stringify(divergenciaPayload())))

    const historicoFeedback: FeedbackHistoricoItem[] = [
      { hashAlerta: 'b59_dose_smx', feedback: 'discordo', motivo: 'Paciente com alergia a sulfa' },
      { hashAlerta: 'b59_profilaxia', feedback: 'inaplicavel', motivo: null },
    ]

    await detectarDivergenciaConducta({
      condutaAtual: 'Pentamidina inalatória mensal',
      sinteseEvidencias: 'TMP-SMX é primeira linha',
      diagnostico: 'Pneumocistose',
      cid10: 'B59',
      historicoFeedback,
    })

    const chamadaFetch = vi.mocked(fetch).mock.calls[0]
    const body = JSON.parse(chamadaFetch![1]!.body as string)
    const userContent: string = body.messages[0].content

    expect(userContent).toContain('b59_dose_smx')
    expect(userContent).toContain('discordo')
    expect(userContent).toContain('Paciente com alergia a sulfa')
    expect(userContent).toContain('b59_profilaxia')
    expect(userContent).toContain('inaplicavel')
  })

  it('inclui perfil do paciente no prompt', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(claudeReply(JSON.stringify(divergenciaPayload())))

    await detectarDivergenciaConducta({
      condutaAtual: 'Voriconazol 200mg 12/12h',
      sinteseEvidencias: 'Anfotericina B recomendada para transplantados',
      diagnostico: 'Aspergilose Invasiva',
      cid10: 'B44',
      perfilPaciente: {
        faixa_etaria: 'adulto (18–59 anos)',
        imunocomprometido: true,
        tipo_imunocomprometimento: 'transplante renal',
        comorbidades: ['IRC estágio 4'],
      },
    })

    const body = JSON.parse(vi.mocked(fetch).mock.calls[0]![1]!.body as string)
    const userContent: string = body.messages[0].content

    expect(userContent).toContain('transplante renal')
    expect(userContent).toContain('IRC estágio 4')
    expect(userContent).toContain('Imunocomprometido: sim')
  })

  it('lança erro quando a API retorna JSON inválido', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(claudeReply('Não é JSON válido'))

    await expect(detectarDivergenciaConducta({
      condutaAtual: 'qualquer',
      sinteseEvidencias: 'qualquer',
      diagnostico: 'teste',
      cid10: 'Z00',
    })).rejects.toThrow('JSON')
  })

  it('usa MODEL_SONNET (campo model no body)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(claudeReply(JSON.stringify(divergenciaPayload())))

    await detectarDivergenciaConducta({
      condutaAtual: 'x',
      sinteseEvidencias: 'y',
      diagnostico: 'z',
      cid10: 'A00',
    })

    const body = JSON.parse(vi.mocked(fetch).mock.calls[0]![1]!.body as string)
    expect(body.model).toBe('claude-sonnet-4-6')
  })
})

// ── gerarKnowledgeMetadata ────────────────────────────────────────────────────

describe('gerarKnowledgeMetadata', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  const sampleMetadata = {
    diagnostico_principal: { nome: 'HIV/AIDS', cid10: 'B20', certeza: 'confirmado' },
    diagnosticos_diferenciais: [],
    perfil_paciente: {
      faixa_etaria: 'adulto (18–59 anos)',
      imunocomprometido: true,
      tipo_imunocomprometimento: 'HIV CD4 < 200',
      comorbidades: [],
      alergias_relevantes: [],
    },
    conduta: {
      antibioticos: [],
      outros_medicamentos: [],
      internacao_indicada: false,
      nivel_cuidado: 'ambulatorial',
    },
    busca_pubmed: {
      termos_mesh: ['HIV Infections', 'Antiretroviral Therapy'],
      query_sugerida: '"HIV"[MeSH] AND "TARGA"',
      prioridade: 'alta',
    },
    palavras_gatilho_relatorio: [],
    caso_atipico: { atipico: false, criterios_objetivos: [], tipo_sugerido: 'nenhum' },
    tags: ['hiv', 'aids'],
  }

  it('parseia corretamente knowledge_metadata retornado pelo Haiku', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(claudeReply(JSON.stringify(sampleMetadata)))

    const resultado = await gerarKnowledgeMetadata({ soapTexto: 'Paciente com HIV B20...', template: 'hiv_cronico' })

    expect(resultado.diagnostico_principal?.cid10).toBe('B20')
    expect(resultado.busca_pubmed.termos_mesh).toContain('HIV Infections')
    expect(resultado.perfil_paciente.imunocomprometido).toBe(true)
  })

  it('usa MODEL_HAIKU para economizar tokens', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(claudeReply(JSON.stringify(sampleMetadata)))

    await gerarKnowledgeMetadata({ soapTexto: 'SOAP texto', template: 'infectologia_geral' })

    const body = JSON.parse(vi.mocked(fetch).mock.calls[0]![1]!.body as string)
    expect(body.model).toBe('claude-haiku-4-5-20251001')
  })
})
