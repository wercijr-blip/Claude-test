import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  detectarDivergenciaConducta,
  gerarKnowledgeMetadata,
  gerarRevisaoLiteratura,
  getOpusBudgetStatus,
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
    OPUS_DAILY_TOKEN_BUDGET: 50_000,
  },
}))

vi.mock('./_core/logger.ts', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const redisMock = vi.hoisted(() => ({
  get: vi.fn().mockResolvedValue(null),
  incrby: vi.fn().mockResolvedValue(1000),
  expire: vi.fn().mockResolvedValue(1),
}))
vi.mock('./_core/redis.ts', () => ({ redis: redisMock }))

// Mock @anthropic-ai/sdk — intercepts anthropic.messages.create() calls.
const createMock = vi.hoisted(() => vi.fn())
vi.mock('@anthropic-ai/sdk', () => {
  class APIError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  }
  return {
    default: class Anthropic {
      messages = { create: createMock }
      static APIError = APIError
    },
  }
})

// Helper: creates a mock SDK response with text content.
function sdkReply(text: string, usage = { input_tokens: 100, output_tokens: 50 }) {
  return Promise.resolve({ content: [{ type: 'text', text }], usage })
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
    createMock.mockReset()
  })

  it('parseia corretamente resposta com divergência', async () => {
    createMock.mockReturnValueOnce(sdkReply(JSON.stringify(divergenciaPayload())))

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
    createMock.mockReturnValueOnce(sdkReply(JSON.stringify(semDivergencia)))

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
    createMock.mockReturnValueOnce(sdkReply(JSON.stringify(divergenciaPayload())))

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

    const params = createMock.mock.calls[0]![0] as { messages: Array<{ content: string }> }
    const userContent = params.messages[0]!.content

    expect(userContent).toContain('b59_dose_smx')
    expect(userContent).toContain('discordo')
    expect(userContent).toContain('Paciente com alergia a sulfa')
    expect(userContent).toContain('b59_profilaxia')
    expect(userContent).toContain('inaplicavel')
  })

  it('inclui perfil do paciente no prompt', async () => {
    createMock.mockReturnValueOnce(sdkReply(JSON.stringify(divergenciaPayload())))

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

    const params = createMock.mock.calls[0]![0] as { messages: Array<{ content: string }> }
    const userContent = params.messages[0]!.content

    expect(userContent).toContain('transplante renal')
    expect(userContent).toContain('IRC estágio 4')
    expect(userContent).toContain('Imunocomprometido: sim')
  })

  it('lança erro quando a API retorna JSON inválido', async () => {
    createMock.mockReturnValueOnce(sdkReply('Não é JSON válido'))

    await expect(detectarDivergenciaConducta({
      condutaAtual: 'qualquer',
      sinteseEvidencias: 'qualquer',
      diagnostico: 'teste',
      cid10: 'Z00',
    })).rejects.toThrow('JSON')
  })

  it('usa MODEL_SONNET (campo model no params)', async () => {
    createMock.mockReturnValueOnce(sdkReply(JSON.stringify(divergenciaPayload())))

    await detectarDivergenciaConducta({
      condutaAtual: 'x',
      sinteseEvidencias: 'y',
      diagnostico: 'z',
      cid10: 'A00',
    })

    const params = createMock.mock.calls[0]![0] as { model: string }
    expect(params.model).toBe('claude-sonnet-4-6')
  })
})

// ── gerarKnowledgeMetadata ────────────────────────────────────────────────────

describe('gerarKnowledgeMetadata', () => {
  beforeEach(() => {
    createMock.mockReset()
  })

  const sampleMetadata = {
    diagnostico_principal: { nome: 'HIV/AIDS', cid10: 'B20', certeza: 'confirmado', categoria: 'infeccioso' },
    diagnosticos_diferenciais: [],
    apresentacao_clinica: { tempo_evolucao_dias: 0, sintomas_principais: [], sinais_vitais_alterados: [], achados_exame_fisico: [] },
    perfil_paciente: {
      faixa_etaria: 'adulto',
      sexo: 'M',
      imunocomprometido: true,
      tipo_imunocomprometimento: 'hiv',
      comorbidades: [],
    },
    microbiologia: { agente_identificado: null, metodo_diagnostico: [], perfil_resistencia: null },
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
    createMock.mockReturnValueOnce(sdkReply(JSON.stringify(sampleMetadata)))

    const resultado = await gerarKnowledgeMetadata({ soapTexto: 'Paciente com HIV B20...', template: 'hiv_cronico' })

    expect(resultado.diagnostico_principal?.cid10).toBe('B20')
    expect(resultado.busca_pubmed.termos_mesh).toContain('HIV Infections')
    expect(resultado.perfil_paciente.imunocomprometido).toBe(true)
  })

  it('usa MODEL_HAIKU para economizar tokens', async () => {
    createMock.mockReturnValueOnce(sdkReply(JSON.stringify(sampleMetadata)))

    await gerarKnowledgeMetadata({ soapTexto: 'SOAP texto', template: 'infectologia_geral' })

    const params = createMock.mock.calls[0]![0] as { model: string }
    expect(params.model).toBe('claude-haiku-4-5')
  })
})

// ── Opus daily budget ─────────────────────────────────────────────────────────

describe('Opus daily budget', () => {
  beforeEach(() => {
    createMock.mockReset()
    redisMock.get.mockReset()
    redisMock.incrby.mockReset()
    redisMock.expire.mockReset()
  })

  it('getOpusBudgetStatus retorna uso atual e percentual', async () => {
    redisMock.get.mockResolvedValueOnce('30000')

    const status = await getOpusBudgetStatus()

    expect(status.usado).toBe(30_000)
    expect(status.limite).toBe(50_000)
    expect(status.percentual).toBe(60)
    expect(status.dataKey).toMatch(/^cis:opus:tokens:\d{4}-\d{2}-\d{2}$/)
  })

  it('getOpusBudgetStatus retorna 0 quando chave Redis não existe', async () => {
    redisMock.get.mockResolvedValueOnce(null)

    const status = await getOpusBudgetStatus()
    expect(status.usado).toBe(0)
    expect(status.percentual).toBe(0)
  })

  it('registra tokens Opus no Redis após chamada bem-sucedida', async () => {
    redisMock.get.mockResolvedValueOnce('0')
    redisMock.incrby.mockResolvedValueOnce(5000)
    createMock.mockReturnValueOnce(sdkReply('Revisão completa', { input_tokens: 3000, output_tokens: 2000 }))

    await gerarRevisaoLiteratura({
      tema: 'HIV tratamento',
      nArtigos: 1,
      artigosJson: '[]',
      contextoClinico: 'teste',
    })

    // Opus tokens (3000 + 2000 = 5000) should be tracked in Redis
    expect(redisMock.incrby).toHaveBeenCalledWith(expect.stringMatching(/^cis:opus:tokens:/), 5000)
  })

  it('downgrade para Sonnet quando orçamento Opus está esgotado', async () => {
    // Redis reporta 55000 tokens usados (acima do limite de 50000)
    redisMock.get.mockResolvedValueOnce('55000')
    createMock.mockReturnValueOnce(sdkReply('Revisão completa'))

    await gerarRevisaoLiteratura({
      tema: 'HIV tratamento',
      nArtigos: 1,
      artigosJson: '[]',
      contextoClinico: 'teste',
    })

    // Should have downgraded from Opus to Sonnet
    const params = createMock.mock.calls[0]![0] as { model: string }
    expect(params.model).toBe('claude-sonnet-4-6')
    // incrby NÃO deve ser chamado porque o modelo efetivo é Sonnet após downgrade
    expect(redisMock.incrby).not.toHaveBeenCalled()
  })
})
