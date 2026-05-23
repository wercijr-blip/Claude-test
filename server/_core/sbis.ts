/**
 * Utilitários de conformidade SBIS — Manual de Certificação SBIS 2024
 * Nível alvo: INTERMEDIÁRIO
 * Cobre: BPIA.01–05 | ECF.02–03, 16–17, 21 | NGS1.01, 07, 10–12
 */

import { createHash } from 'node:crypto'
import type { SbisMetadata } from '../../shared/types.ts'
import { logAudit } from './audit.ts'

// ── BPIA.01 — Responsável Técnico ────────────────────────────
export const RT_NOME = 'Dr. Werciley Saraiva Vieira Júnior'
export const RT_CRM = 'CRM/DF 16381'
export const RT_RQE = 'RQE 14486'
export const RT_ESPECIALIDADE = 'Infectologia'

// ── NGS1.01 — Controle de versão ─────────────────────────────
export const SBIS_MODEL_VERSION = 'claude-haiku-4-5-20251001'
export const SBIS_SYSTEM_VERSION = '1.0.0'
export const SBIS_NIVEL = 'INTERMEDIÁRIO'

// ── NGS1.12 — Adversarial input detection ────────────────────
// Patterns that indicate attempts to hijack AI behavior via text inputs.
// Applied to any free-text field before including it in an AI prompt.
const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(previous|prior|above)\s+instruction/i,
  /forget\s+(all|your|everything)/i,
  /you\s+are\s+now\s+/i,
  /você\s+(não\s+é|agora\s+é)\s+um?\s+/i,
  /system\s*:\s*\[/i,
  /\[INST\]|\[\/INST\]/,
  /<\|im_start\|>|<\|im_end\|>/,
  /jailbreak/i,
  /DAN\s*mode/i,
  /prompt\s+injection/i,
  /act\s+as\s+if\s+you\s+are/i,
  /disregard\s+(all|your)\s+(previous|prior)/i,
]

export function detectPromptInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((p) => p.test(text))
}

// ── BPIA.03 — Qualidade de dados ─────────────────────────────
export interface QualidadeExameResult {
  valid: boolean
  warning?: string
  reason?: string
}

export function validateExameQuality(
  s3Key: string | undefined | null,
  tipoExame: string | null | undefined,
  tamanhoBytes: number | null | undefined,
): QualidadeExameResult {
  if (!s3Key) {
    return { valid: false, reason: 'Arquivo de exame ausente (s3Key nulo) — BPIA.03' }
  }
  // tamanhoBytes null means the field was never recorded — treat as suspicious
  if (tamanhoBytes === null || tamanhoBytes === undefined) {
    return { valid: true, warning: 'tamanhoBytes não registrado — qualidade do arquivo não verificada' }
  }
  if (tamanhoBytes < 1024) {
    return {
      valid: false,
      reason: `Arquivo muito pequeno (${tamanhoBytes} bytes) — provável corrupção — BPIA.03`,
    }
  }
  if (!tipoExame) {
    return { valid: true, warning: 'Tipo de exame não pré-classificado — IA tentará identificar' }
  }
  return { valid: true }
}

// ── BPIA.04 — Fundamentação clínica por tipo de exame ────────
const FUNDAMENTACAO_MAP: Record<string, { fontes: string[]; limitacoes: string[] }> = {
  hiv: {
    fontes: [
      'PCDT PrEP 2022 — Ministério da Saúde',
      'Protocolo Clínico e Diretrizes Terapêuticas para Manejo da Infecção pelo HIV em Adultos (MS, 2018)',
      'WHO Consolidated HIV Strategic Information Guidelines (2023)',
      'CFM Resolução nº 2.299/2021 — Telemedicina',
    ],
    limitacoes: [
      'Análise por visão computacional — não substitui laudo laboratorial oficial',
      'Janela imunológica: exame recente pode não detectar infecção incipiente',
      'Resultado reagente sempre requer confirmação por Western Blot ou NAT',
      'Modelos de IA apresentam desempenho reduzido em populações subrepresentadas',
    ],
  },
  hepatite_b: {
    fontes: [
      'PCDT Hepatite B — Ministério da Saúde (2017)',
      'EASL Clinical Practice Guidelines on hepatitis B virus infection (2017)',
      'CFM Resolução nº 2.314/2022',
    ],
    limitacoes: [
      'HBsAg positivo requer confirmação e estadiamento clínico completo',
      'Análise por IA — não substitui interpretação laboratorial',
    ],
  },
  hepatite_c: {
    fontes: [
      'PCDT Hepatite C — Ministério da Saúde (2019)',
      'EASL Recommendations on Treatment of Hepatitis C (2020)',
    ],
    limitacoes: [
      'Anti-HCV reagente não distingue infecção ativa de passada — HCV RNA necessário',
      'Análise por IA — não substitui interpretação laboratorial',
    ],
  },
  sifilis: {
    fontes: [
      'Guia de Vigilância em Saúde — Sífilis, Ministério da Saúde (2022)',
      'PCDT IST — Ministério da Saúde (2022)',
    ],
    limitacoes: [
      'Teste rápido reativo requer confirmação com VDRL/FTA-Abs',
      'Falso-positivo possível em doenças autoimunes e outras infecções',
    ],
  },
  creatinina: {
    fontes: [
      'KDIGO CKD Guideline (2022)',
      'PCDT PrEP 2022 — critérios de função renal para indicação e monitoramento',
    ],
    limitacoes: [
      'Valor isolado deve ser interpretado com TFG-e, idade, sexo e etnia',
      'IA extrai valor numérico — interpretação clínica é responsabilidade do médico',
    ],
  },
  outro: {
    fontes: ['Protocolo clínico individualizado conforme indicação médica'],
    limitacoes: [
      'Tipo de exame não padronizado — confiança da análise pode ser reduzida',
      'Revisão médica obrigatória para exames não classificados',
    ],
  },
}

// ── BPIA.02 — Mapeamento de confiança para grau SBIS ─────────
export function mapConfiancaToGrade(confianca: number): 'Alto' | 'Moderado' | 'Baixo' {
  if (confianca >= 0.85) return 'Alto'
  if (confianca >= 0.60) return 'Moderado'
  return 'Baixo'
}

// ── ECF.17 — Construção de metadados SBIS estruturados ───────
export function buildSbisMetadata(
  resultContent: string,
  tipoExame: string,
  confianca: number,
  sessionId?: string,
): SbisMetadata {
  const hash = createHash('sha256').update(resultContent).digest('hex').slice(0, 16)
  const fundo = FUNDAMENTACAO_MAP[tipoExame] ?? FUNDAMENTACAO_MAP['outro']!

  return {
    timestamp: new Date().toISOString(),
    sessionId: sessionId ?? crypto.randomUUID(),
    modelVersion: SBIS_MODEL_VERSION,
    systemVersion: SBIS_SYSTEM_VERSION,
    hash,
    responsavelTecnico: {
      nome: RT_NOME,
      crm: RT_CRM,
      rqe: RT_RQE,
      especialidade: RT_ESPECIALIDADE,
    },
    grauConfianca: mapConfiancaToGrade(confianca),
    fundamentacao: fundo.fontes,
    limitacoes: fundo.limitacoes,
    nivel: SBIS_NIVEL,
    aviso:
      'SAÍDA GERADA POR IA — REQUER VALIDAÇÃO DO PROFISSIONAL DE SAÚDE. ' +
      'Não constitui diagnóstico definitivo nem prescrição médica autônoma. ' +
      'Conformidade: SBIS BPIA + ECF + NGS1 | LGPD art. 11',
  }
}

// ── BPIA.05 + NGS1.10 — Detecção de resultado anômalo ───────
export function isResultadoAnomalos(
  resultado: string,
  confianca: number,
  tipoExame: string,
): boolean {
  // Threshold em 0.60 — reagente infeccioso mesmo com confiança moderada deve acionar alerta RT
  const infecciosoReagente =
    resultado === 'reagente' &&
    confianca >= 0.60 &&
    ['hiv', 'sifilis', 'hepatite_b', 'hepatite_c'].includes(tipoExame)
  const baixaConfianca = confianca < 0.30
  const naoIdentificado = resultado === 'nao_identificado'
  return infecciosoReagente || baixaConfianca || naoIdentificado
}

// ── NGS1.07 + NGS1.10 — Auditoria de eventos IA ─────────────

export async function logIaAnalise(params: {
  exameId: number
  tipoExame: string
  resultado: string
  confianca: number
  sessionId: string
  inputTokens?: number
  outputTokens?: number
}): Promise<void> {
  await logAudit({
    action: 'ia.analise',
    resourceType: 'exame',
    resourceId: params.exameId,
    detalhes: {
      tipoExame: params.tipoExame,
      resultado: params.resultado,
      confianca: params.confianca,
      grauConfianca: mapConfiancaToGrade(params.confianca),
      sessionId: params.sessionId,
      modelVersion: SBIS_MODEL_VERSION,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      sbisCompliant: true,
    },
  })
}

export async function logIaAnomalia(params: {
  exameId: number
  resultado: string
  confianca: number
  tipoExame: string
  motivo: string
  sessionId: string
}): Promise<void> {
  await logAudit({
    action: 'ia.anomalia',
    resourceType: 'exame',
    resourceId: params.exameId,
    detalhes: {
      resultado: params.resultado,
      confianca: params.confianca,
      tipoExame: params.tipoExame,
      motivo: params.motivo,
      sessionId: params.sessionId,
      responsavelTecnico: { nome: RT_NOME, crm: RT_CRM },
      sbisNgs1_10: true,
    },
  })
}

export async function logIaRejeicaoDados(params: {
  exameId: number
  motivo: string
}): Promise<void> {
  await logAudit({
    action: 'ia.rejeicao_dados',
    resourceType: 'exame',
    resourceId: params.exameId,
    detalhes: {
      motivo: params.motivo,
      sbisNgs1_03: true,
    },
  })
}
