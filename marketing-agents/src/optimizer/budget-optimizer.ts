import fs from 'fs';
import path from 'path';
import logger from '../utils/logger';
import {
  calculateLTV,
  classifyCPA,
  formatLTVSummary,
  getProductLineForPlatform,
} from './ltv-calculator';
import type {
  ChannelPerformance,
  OptimizerDecision,
  OptimizerReport,
  ReallocationPlan,
  AdMetrics,
  GoogleMetrics,
  LinkedInMetrics,
  DecisionUrgency,
  OptimizerActionType,
} from '../types';

// ─── Taxas de conversão lead → paciente por canal ────────────────────────────
// Baseado em benchmarks brasileiros de saúde digital
const LEAD_TO_PATIENT_RATE: Record<string, number> = {
  META: 0.52,     // 52%: lead gerado por formulário Meta já é qualificado
  GOOGLE: 0.63,   // 63%: intenção de busca → maior qualidade
  LINKEDIN: 0.35, // 35%: lead indireto (referral médico → paciente)
};

// Valor fixo por paciente quando não se usa LTV (para comparação conservadora)
const HARD_PATIENT_VALUE_BRL = 100;

// Máximo de variação de orçamento por ciclo de otimização (evita mudanças bruscas)
const MAX_BUDGET_CHANGE_PCT = 30;

// Mínimo de gasto para que uma decisão seja confiável estatisticamente
const MIN_SPEND_FOR_DECISION = 50; // R$ 50

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(value: number, total: number): number {
  return total === 0 ? 0 : parseFloat(((value / total) * 100).toFixed(2));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function brl(value: number): string {
  return `R$ ${value.toFixed(2)}`;
}

// ─── Budget Optimizer ─────────────────────────────────────────────────────────

export class BudgetOptimizer {
  private readonly logsDir = path.resolve(__dirname, '../../logs');

  // ── Constrói o perfil de performance de um canal ────────────────────────────

  buildMetaPerformance(campaignId: string, campaignName: string, metrics: AdMetrics, dailyBudget: number): ChannelPerformance {
    const rate = LEAD_TO_PATIENT_RATE.META;
    const patients = Math.round(metrics.leads * rate);
    const cpa = patients > 0 ? metrics.spend / patients : Infinity;
    const cpl = metrics.leads > 0 ? metrics.spend / metrics.leads : Infinity;

    return {
      platform: 'META',
      campaignId,
      campaignName,
      spend: metrics.spend,
      leads: metrics.leads,
      patients,
      cpa,
      cpl,
      ctr: metrics.ctr,
      cpc: metrics.cpc,
      dailyBudget,
      impressions: metrics.impressions,
      clicks: metrics.clicks,
      leadToPatientRate: rate,
    };
  }

  buildGooglePerformance(campaignId: string, campaignName: string, metrics: GoogleMetrics, dailyBudget: number): ChannelPerformance {
    const rate = LEAD_TO_PATIENT_RATE.GOOGLE;
    // No Google, conversions = leads diretos (formulário / clique em telefone)
    const patients = Math.round(metrics.conversions * rate);
    const cpa = patients > 0 ? metrics.cost / patients : Infinity;
    const cpl = metrics.conversions > 0 ? metrics.cost / metrics.conversions : Infinity;

    return {
      platform: 'GOOGLE',
      campaignId,
      campaignName: metrics.campaignName,
      spend: metrics.cost,
      leads: metrics.conversions,
      patients,
      cpa,
      cpl,
      ctr: metrics.ctr,
      cpc: metrics.averageCpc,
      dailyBudget,
      impressions: metrics.impressions,
      clicks: metrics.clicks,
      leadToPatientRate: rate,
    };
  }

  buildLinkedInPerformance(campaignId: string, campaignName: string, metrics: LinkedInMetrics, dailyBudget: number): ChannelPerformance {
    const rate = LEAD_TO_PATIENT_RATE.LINKEDIN;
    const patients = Math.round(metrics.leads * rate);
    const cpa = patients > 0 ? metrics.costInLocalCurrency / patients : Infinity;
    const cpl = metrics.leads > 0 ? metrics.costInLocalCurrency / metrics.leads : Infinity;
    const clicks = metrics.clicks;
    const ctr = metrics.impressions > 0 ? pct(clicks, metrics.impressions) : 0;
    const cpc = clicks > 0 ? metrics.costInLocalCurrency / clicks : 0;

    return {
      platform: 'LINKEDIN',
      campaignId,
      campaignName,
      spend: metrics.costInLocalCurrency,
      leads: metrics.leads,
      patients,
      cpa,
      cpl,
      ctr,
      cpc,
      dailyBudget,
      impressions: metrics.impressions,
      clicks,
      leadToPatientRate: rate,
    };
  }

  // ── Analisa um canal e emite uma decisão ────────────────────────────────────

  private analyzeChannel(channel: ChannelPerformance): OptimizerDecision {
    const productLine = getProductLineForPlatform(channel.platform);
    const ltv = calculateLTV(productLine);
    const zone = classifyCPA(channel.cpa, ltv);

    let action: OptimizerActionType;
    let reason: string;
    let budgetDeltaPct: number | undefined;
    let urgency: DecisionUrgency;

    // Dados insuficientes para decisão confiável
    if (channel.spend < MIN_SPEND_FOR_DECISION) {
      return {
        platform: channel.platform,
        campaignId: channel.campaignId,
        campaignName: channel.campaignName,
        action: 'MAINTAIN',
        reason: `Gasto insuficiente (${brl(channel.spend)}) para decisão estatística. Mínimo: ${brl(MIN_SPEND_FOR_DECISION)}.`,
        currentCPA: channel.cpa,
        hardThreshold: HARD_PATIENT_VALUE_BRL,
        ltvThreshold: ltv.maxAcceptableCPA,
        urgency: 'INFO',
        executedAt: new Date().toISOString(),
      };
    }

    switch (zone) {
      case 'EXCELLENT':
        // CPA ≤ 10% LTV — escalar agressivamente
        budgetDeltaPct = clamp(30, 10, MAX_BUDGET_CHANGE_PCT);
        action = 'SCALE_UP';
        reason = `CPA ${brl(channel.cpa)} está na zona EXCELENTE (≤ ${brl(ltv.conservativeCPA)}). ROI/LTV: ${(ltv.ltv / channel.cpa).toFixed(1)}×. Aumentando orçamento ${budgetDeltaPct}%.`;
        urgency = 'INFO';
        break;

      case 'GOOD':
        // CPA entre 10% e 20% LTV — escalar com moderação
        budgetDeltaPct = 15;
        action = 'SCALE_UP';
        reason = `CPA ${brl(channel.cpa)} está na zona BOA. ROI/LTV: ${(ltv.ltv / channel.cpa).toFixed(1)}×. Aumentando orçamento ${budgetDeltaPct}%.`;
        urgency = 'INFO';
        break;

      case 'ACCEPTABLE':
        // CPA dentro do limite aceitável — manter
        action = 'MAINTAIN';
        reason = `CPA ${brl(channel.cpa)} está dentro do limite aceitável (≤ ${brl(ltv.maxAcceptableCPA)}). Mantendo configuração atual.`;
        urgency = 'INFO';
        break;

      case 'RISKY':
        // CPA entre maxAcceptable e aggressiveCPA — reduzir
        budgetDeltaPct = -20;
        action = channel.ctr < 0.8 ? 'NEW_CREATIVE' : 'SCALE_DOWN';
        if (channel.ctr < 0.8) {
          reason = `CPA ${brl(channel.cpa)} elevado e CTR baixo (${channel.ctr.toFixed(2)}%). Criativo perdendo eficiência — gerando novo conteúdo.`;
        } else {
          reason = `CPA ${brl(channel.cpa)} na zona de risco (> ${brl(ltv.maxAcceptableCPA)}). Reduzindo orçamento ${Math.abs(budgetDeltaPct)}% para estabilizar.`;
        }
        urgency = 'WARNING';
        break;

      case 'UNVIABLE':
        // CPA acima do máximo absoluto — pausar
        action = 'PAUSE';
        reason = `CPA ${brl(channel.cpa)} INVIÁVEL (limite LTV: ${brl(ltv.aggressiveCPA)}, limite conservador: ${brl(HARD_PATIENT_VALUE_BRL)}). Campanha pausada. Revisar público e criativo antes de reativar.`;
        urgency = 'CRITICAL';
        break;

      default:
        action = 'MAINTAIN';
        reason = 'Estado indeterminado.';
        urgency = 'INFO';
    }

    return {
      platform: channel.platform,
      campaignId: channel.campaignId,
      campaignName: channel.campaignName,
      action,
      reason,
      budgetDeltaPct,
      currentCPA: parseFloat(channel.cpa.toFixed(2)),
      hardThreshold: HARD_PATIENT_VALUE_BRL,
      ltvThreshold: ltv.maxAcceptableCPA,
      urgency,
      executedAt: new Date().toISOString(),
    };
  }

  // ── Plano de realocação entre canais ────────────────────────────────────────

  private planReallocations(channels: ChannelPerformance[]): ReallocationPlan[] {
    const valid = channels.filter((c) => c.spend >= MIN_SPEND_FOR_DECISION && isFinite(c.cpa));
    if (valid.length < 2) return [];

    const sorted = [...valid].sort((a, b) => a.cpa - b.cpa);
    const best = sorted[0];   // canal mais eficiente
    const worst = sorted[sorted.length - 1]; // canal menos eficiente

    const bestLtv = calculateLTV(getProductLineForPlatform(best.platform));
    const worstLtv = calculateLTV(getProductLineForPlatform(worst.platform));

    // Só realoca se a diferença de CPA for significativa (>40%) e o pior estiver em zona ruim
    const cpaDiffPct = ((worst.cpa - best.cpa) / best.cpa) * 100;
    const worstZone = classifyCPA(worst.cpa, worstLtv);

    if (cpaDiffPct < 40 || !['RISKY', 'UNVIABLE'].includes(worstZone)) return [];

    // Transfere até 20% do orçamento do pior para o melhor
    const transferPct = worstZone === 'UNVIABLE' ? 30 : 20;
    const amountBRL = parseFloat((worst.dailyBudget * (transferPct / 100)).toFixed(2));

    return [
      {
        fromPlatform: worst.platform,
        toPlatform: best.platform,
        amountBRL,
        reason: `${worst.platform} CPA ${brl(worst.cpa)} (zona: ${worstZone}) vs ${best.platform} CPA ${brl(best.cpa)} — diferença de ${cpaDiffPct.toFixed(0)}%. Transferindo ${brl(amountBRL)}/dia.`,
      },
    ];
  }

  // ── Análise completa ─────────────────────────────────────────────────────────

  analyze(channels: ChannelPerformance[]): OptimizerReport {
    const totalSpend = channels.reduce((s, c) => s + c.spend, 0);
    const totalLeads = channels.reduce((s, c) => s + c.leads, 0);
    const totalPatients = channels.reduce((s, c) => s + c.patients, 0);
    const blendedCPA = totalPatients > 0 ? totalSpend / totalPatients : Infinity;
    const blendedCPL = totalLeads > 0 ? totalSpend / totalLeads : Infinity;

    const decisions = channels.map((c) => this.analyzeChannel(c));
    const reallocations = this.planReallocations(channels);

    // Projeções de melhoria com as decisões aplicadas
    const projectedMonthlySavings = this.projectSavings(channels, decisions);
    const projectedMonthlyPatientGain = this.projectPatientGain(channels, decisions);

    const roiAtHardValue = totalSpend > 0
      ? ((totalPatients * HARD_PATIENT_VALUE_BRL - totalSpend) / totalSpend) * 100
      : 0;

    // ROI médio ponderado usando LTV de cada canal
    const weightedLTVRevenue = channels.reduce((s, c) => {
      const ltv = calculateLTV(getProductLineForPlatform(c.platform));
      return s + c.patients * ltv.ltv;
    }, 0);
    const roiAtLTV = totalSpend > 0
      ? ((weightedLTVRevenue - totalSpend) / totalSpend) * 100
      : 0;

    return {
      analyzedAt: new Date().toISOString(),
      periodDays: 7,
      totalSpend: parseFloat(totalSpend.toFixed(2)),
      totalLeads,
      totalPatients,
      blendedCPA: parseFloat(blendedCPA.toFixed(2)),
      blendedCPL: parseFloat(blendedCPL.toFixed(2)),
      channels,
      decisions,
      reallocations,
      projectedMonthlySavings: parseFloat(projectedMonthlySavings.toFixed(2)),
      projectedMonthlyPatientGain: Math.round(projectedMonthlyPatientGain),
      roiAtHardValue: parseFloat(roiAtHardValue.toFixed(1)),
      roiAtLTV: parseFloat(roiAtLTV.toFixed(1)),
    };
  }

  private projectSavings(channels: ChannelPerformance[], decisions: OptimizerDecision[]): number {
    let savings = 0;
    for (const decision of decisions) {
      const channel = channels.find((c) => c.campaignId === decision.campaignId);
      if (!channel) continue;
      if (decision.action === 'PAUSE') savings += channel.dailyBudget * 30;
      if (decision.action === 'SCALE_DOWN' && decision.budgetDeltaPct) {
        savings += channel.dailyBudget * Math.abs(decision.budgetDeltaPct / 100) * 30;
      }
    }
    return savings;
  }

  private projectPatientGain(channels: ChannelPerformance[], decisions: OptimizerDecision[]): number {
    let gain = 0;
    for (const decision of decisions) {
      const channel = channels.find((c) => c.campaignId === decision.campaignId);
      if (!channel || !isFinite(channel.cpa) || channel.cpa === 0) continue;
      if (decision.action === 'SCALE_UP' && decision.budgetDeltaPct) {
        const extraBudgetMonthly = channel.dailyBudget * (decision.budgetDeltaPct / 100) * 30;
        gain += extraBudgetMonthly / channel.cpa;
      }
    }
    return gain;
  }

  // ── Logging estruturado do relatório ────────────────────────────────────────

  logReport(report: OptimizerReport): void {
    const sep = '─'.repeat(60);
    logger.info(sep);
    logger.info('RELATÓRIO DE OTIMIZAÇÃO DE INVESTIMENTO');
    logger.info(sep);
    logger.info(`Período analisado:  ${report.periodDays} dias`);
    logger.info(`Total investido:    ${brl(report.totalSpend)}`);
    logger.info(`Total leads:        ${report.totalLeads}`);
    logger.info(`Total pacientes:    ${report.totalPatients}`);
    logger.info(`CPA combinado:      ${brl(report.blendedCPA)}`);
    logger.info(`CPL combinado:      ${brl(report.blendedCPL)}`);
    logger.info(`ROI (R$100/pac):    ${report.roiAtHardValue.toFixed(1)}%`);
    logger.info(`ROI (LTV real):     ${report.roiAtLTV.toFixed(1)}%`);
    logger.info('');
    logger.info('PERFORMANCE POR CANAL:');
    for (const c of report.channels) {
      const ltv = calculateLTV(getProductLineForPlatform(c.platform));
      const zone = classifyCPA(c.cpa, ltv);
      const emoji = { EXCELLENT: '🟢', GOOD: '🟢', ACCEPTABLE: '🟡', RISKY: '🟠', UNVIABLE: '🔴' }[zone];
      logger.info(`  ${emoji} ${c.platform.padEnd(10)} | Gasto: ${brl(c.spend).padEnd(12)} | ${c.patients} pac | CPA: ${brl(c.cpa)} | CTR: ${c.ctr.toFixed(2)}%`);
    }
    logger.info('');
    logger.info('DECISÕES:');
    for (const d of report.decisions) {
      const icon = { INFO: 'ℹ', WARNING: '⚠', CRITICAL: '🚨' }[d.urgency];
      logger.info(`  ${icon}  [${d.platform}] ${d.action}: ${d.reason}`);
      if (d.budgetDeltaPct !== undefined) {
        const sign = d.budgetDeltaPct > 0 ? '+' : '';
        logger.info(`      → Orçamento: ${sign}${d.budgetDeltaPct}%`);
      }
    }
    if (report.reallocations.length > 0) {
      logger.info('');
      logger.info('REALOCAÇÕES:');
      for (const r of report.reallocations) {
        logger.info(`  ↩  ${r.fromPlatform} → ${r.toPlatform}: ${brl(r.amountBRL)}/dia | ${r.reason}`);
      }
    }
    logger.info('');
    logger.info(`Economia projetada (30 dias):     ${brl(report.projectedMonthlySavings)}`);
    logger.info(`Ganho de pacientes projetado/mês: +${report.projectedMonthlyPatientGain}`);
    logger.info(sep);

    this.saveReport(report);
  }

  private saveReport(report: OptimizerReport): void {
    if (!fs.existsSync(this.logsDir)) fs.mkdirSync(this.logsDir, { recursive: true });
    const filename = path.join(
      this.logsDir,
      `optimizer_${new Date().toISOString().slice(0, 10)}.json`,
    );
    fs.writeFileSync(filename, JSON.stringify(report, null, 2), 'utf-8');
    logger.info(`Relatório de otimização salvo em: ${filename}`);
  }

  // ── LTV summary para exibição ────────────────────────────────────────────────

  logLTVProfiles(): void {
    logger.info('PERFIS LTV CONFIGURADOS:');
    logger.info(formatLTVSummary(calculateLTV('facilita_prep')));
    logger.info(formatLTVSummary(calculateLTV('iaso_clinica')));
  }
}

export const budgetOptimizer = new BudgetOptimizer();
