import type { LTVProfile, ProductLine } from '../types';

// ─── Configurações por linha de produto ───────────────────────────────────────
// Baseado em benchmarks reais de telemedicina e clínicas de infectologia no Brasil

const LTV_CONFIGS: Record<ProductLine, Omit<LTVProfile, 'ltv' | 'maxAcceptableCPA' | 'conservativeCPA' | 'aggressiveCPA'>> = {
  facilita_prep: {
    productLine: 'facilita_prep',
    // Consulta inicial R$200 + retorno R$180 (média); segue protocolo PrEP: a cada 3 meses
    avgConsultationFee: 220,
    consultationsPerYear: 4,
    // Paciente PrEP tende a manter 12-24 meses; média 18 meses = 1.5 anos
    avgRetentionYears: 1.5,
    // Margem bruta da telemedicina (~65%): descontados médico, plataforma, suporte
    grossMargin: 0.65,
  },
  iaso_clinica: {
    productLine: 'iaso_clinica',
    // Consulta presencial Brasília: R$400-600 particular; média R$450
    avgConsultationFee: 450,
    // Infectologia: retornos semestrais + exames anuais → ~5 visitas/ano
    consultationsPerYear: 5,
    // Paciente presencial tende a fidelizar mais: 2 anos médios
    avgRetentionYears: 2,
    // Margem bruta clínica presencial (~55%): descontados aluguel, staff, insumos
    grossMargin: 0.55,
  },
};

// ─── Thresholds de CPA por zona de decisão ───────────────────────────────────
//
//  ZONA VERDE   (SCALE_UP):  CPA ≤ LTV × 10%  → muito barato, escalar agressivamente
//  ZONA AZUL    (MAINTAIN):  CPA ≤ LTV × 20%  → eficiente, manter
//  ZONA AMARELA (MONITOR):   CPA ≤ LTV × 33%  → aceitável, monitorar
//  ZONA LARANJA (SCALE_DOWN):CPA ≤ LTV × 50%  → arriscado, reduzir
//  ZONA VERMELHA (PAUSE):    CPA >  LTV × 50%  → inviável, pausar

export function calculateLTV(productLine: ProductLine): LTVProfile {
  const config = LTV_CONFIGS[productLine];

  const ltv = Math.round(
    config.avgConsultationFee *
    config.consultationsPerYear *
    config.avgRetentionYears *
    config.grossMargin,
  );

  return {
    ...config,
    ltv,
    conservativeCPA: Math.round(ltv * 0.10),  // zona verde
    maxAcceptableCPA: Math.round(ltv * 0.33),  // zona amarela (padrão de mercado: CAC = 33% LTV)
    aggressiveCPA: Math.round(ltv * 0.50),     // zona laranja (máximo absoluto)
  };
}

export function getAllLTVProfiles(): Record<ProductLine, LTVProfile> {
  return {
    facilita_prep: calculateLTV('facilita_prep'),
    iaso_clinica: calculateLTV('iaso_clinica'),
  };
}

// ─── Determina qual produto mapeia para qual plataforma ──────────────────────

export function getProductLineForPlatform(platform: string): ProductLine {
  // LinkedIn é usado primariamente para IASO (profissionais de saúde)
  if (platform === 'LINKEDIN') return 'iaso_clinica';
  // Meta e Google são usados primariamente para Facilita PrEP
  return 'facilita_prep';
}

// ─── Classifica o CPA em zona de decisão ─────────────────────────────────────

export type CPAZone = 'EXCELLENT' | 'GOOD' | 'ACCEPTABLE' | 'RISKY' | 'UNVIABLE';

export function classifyCPA(cpa: number, ltv: LTVProfile): CPAZone {
  if (cpa <= ltv.conservativeCPA) return 'EXCELLENT';
  if (cpa <= ltv.maxAcceptableCPA * 0.6) return 'GOOD';
  if (cpa <= ltv.maxAcceptableCPA) return 'ACCEPTABLE';
  if (cpa <= ltv.aggressiveCPA) return 'RISKY';
  return 'UNVIABLE';
}

export function formatLTVSummary(profile: LTVProfile): string {
  return [
    `LTV ${profile.productLine}: R$ ${profile.ltv}`,
    `  Ticket médio:   R$ ${profile.avgConsultationFee}`,
    `  Consultas/ano:  ${profile.consultationsPerYear}`,
    `  Retenção:       ${profile.avgRetentionYears} anos`,
    `  Margem bruta:   ${(profile.grossMargin * 100).toFixed(0)}%`,
    `  CPA excelente:  ≤ R$ ${profile.conservativeCPA}`,
    `  CPA aceitável:  ≤ R$ ${profile.maxAcceptableCPA}`,
    `  CPA máximo:     ≤ R$ ${profile.aggressiveCPA}`,
  ].join('\n');
}
