import fs from 'fs';
import path from 'path';
import logger from '../utils/logger';
import { calculateLTV } from '../optimizer/ltv-calculator';
import type {
  PatientCohort,
  MonthlyCosts,
  MonthlyPnL,
  FinancialAlert,
  FinancialReport,
  RevenueProjection,
  YTDSummary,
  AlertType,
  AlertSeverity,
} from '../types';

// ─── Revenue constants ────────────────────────────────────────────────────────
// Receita na consulta inicial (média ponderada 70% PrEP / 30% IASO)
const INITIAL_FEE_PREP  = 280;
const INITIAL_FEE_IASO  = 500;
// Receita recorrente por paciente ativo por mês (retorno a cada 3 meses ÷ 3)
const RECURRING_PREP    = 200 / 3;   // R$ 66,67
const RECURRING_IASO    = 400 / 3;   // R$ 133,33
// Retenção mensal de pacientes
const MONTHLY_RETENTION = 0.85;

// ─── Cost constants (BRL/month) ───────────────────────────────────────────────
const DEFAULT_AI_COSTS = { claude: 1.30, ideogram: 10.40, heygen: 360, runway: 140 };
const DEFAULT_INFRA    = 35;

// ─── Alert thresholds ─────────────────────────────────────────────────────────
const THRESHOLDS = {
  cac:          { warning: 80,  critical: 100 },
  margin:       { warning: 50,  critical: 20  },  // %
  ltvCac:       { warning: 5,   critical: 3   },
  revenueDropPct: { warning: 15, critical: 30 },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LOGS_DIR = path.resolve(__dirname, '../../logs');

function brl(v: number) { return `R$ ${v.toFixed(2)}`; }
function pct(v: number) { return `${v.toFixed(1)}%`; }
function ym(date = new Date()): string { return date.toISOString().slice(0, 7); }

function addMonths(base: string, n: number): string {
  const d = new Date(`${base}-01`);
  d.setMonth(d.getMonth() + n);
  return ym(d);
}

function monthsBetween(a: string, b: string): number {
  const [ay, am] = a.split('-').map(Number);
  const [by, bm] = b.split('-').map(Number);
  return (by - ay) * 12 + (bm - am);
}

// ─── Financial Agent ──────────────────────────────────────────────────────────

export class FinancialAgent {
  private cohorts: PatientCohort[] = [];
  private pnlHistory: MonthlyPnL[] = [];
  private isSimulation: boolean;

  constructor() {
    this.isSimulation = process.env.SIMULATION_MODE === 'true';
    this.loadState();
  }

  // ── State persistence ────────────────────────────────────────────────────────

  private statePath() { return path.join(LOGS_DIR, 'financial-state.json'); }

  private loadState() {
    if (!fs.existsSync(this.statePath())) return;
    try {
      const raw = JSON.parse(fs.readFileSync(this.statePath(), 'utf-8'));
      this.cohorts    = raw.cohorts    ?? [];
      this.pnlHistory = raw.pnlHistory ?? [];
    } catch { /* fresh start */ }
  }

  private saveState() {
    if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
    fs.writeFileSync(this.statePath(), JSON.stringify({ cohorts: this.cohorts, pnlHistory: this.pnlHistory }, null, 2));
  }

  // ── Register new patient acquisition ─────────────────────────────────────────

  registerAcquisition(params: {
    month?: string;
    platform: string;
    newPatients: number;
    adSpend: number;
    aiCost?: number;
    productMix?: { facilita_prep: number; iaso_clinica: number };
  }) {
    const month = params.month ?? ym();
    const id = `${month}-${params.platform}`;
    const cac = params.newPatients > 0
      ? (params.adSpend + (params.aiCost ?? 0)) / params.newPatients
      : 0;

    const existing = this.cohorts.findIndex((c) => c.id === id);
    const cohort: PatientCohort = {
      id,
      month,
      platform: params.platform,
      newPatients: params.newPatients,
      adSpend: params.adSpend,
      aiCost: params.aiCost ?? 0,
      cac,
      productMix: params.productMix ?? { facilita_prep: 0.7, iaso_clinica: 0.3 },
    };

    if (existing >= 0) this.cohorts[existing] = cohort;
    else this.cohorts.push(cohort);

    this.saveState();
    logger.info('Cohort de pacientes registrado', { id, newPatients: params.newPatients, cac: brl(cac) });
  }

  // ── Revenue calculation for a given month ────────────────────────────────────

  private calculateRevenue(targetMonth: string): { initial: number; recurring: number; activePatients: number } {
    let initial = 0;
    let recurring = 0;
    let activePatients = 0;

    for (const cohort of this.cohorts) {
      const age = monthsBetween(cohort.month, targetMonth);
      if (age < 0) continue;

      const retained = cohort.newPatients * Math.pow(MONTHLY_RETENTION, age);
      const prepCount  = retained * cohort.productMix.facilita_prep;
      const iasoCount  = retained * cohort.productMix.iaso_clinica;

      activePatients += retained;

      if (age === 0) {
        // Mês de aquisição → consulta inicial
        initial += prepCount * INITIAL_FEE_PREP + iasoCount * INITIAL_FEE_IASO;
      }
      // Todo mês → receita recorrente dos pacientes ativos
      recurring += prepCount * RECURRING_PREP + iasoCount * RECURRING_IASO;
    }

    return { initial, recurring, activePatients };
  }

  // ── Full P&L for a month ──────────────────────────────────────────────────────

  calculatePnL(targetMonth: string, costs: Partial<MonthlyCosts> = {}): MonthlyPnL {
    const { initial, recurring, activePatients } = this.calculateRevenue(targetMonth);
    const revenue = initial + recurring;

    const newPatients = this.cohorts
      .filter((c) => c.month === targetMonth)
      .reduce((s, c) => s + c.newPatients, 0);

    const totalAdSpend = this.cohorts
      .filter((c) => c.month === targetMonth)
      .reduce((s, c) => s + c.adSpend, 0);

    const monthlyCosts: MonthlyCosts = {
      month: targetMonth,
      adSpend: costs.adSpend ?? totalAdSpend,
      aiCosts: costs.aiCosts ?? DEFAULT_AI_COSTS,
      infrastructure: costs.infrastructure ?? DEFAULT_INFRA,
      total: 0,
    };
    const aiCostTotal = Object.values(monthlyCosts.aiCosts).reduce((s, v) => s + v, 0);
    monthlyCosts.total = monthlyCosts.adSpend + aiCostTotal + monthlyCosts.infrastructure;

    const grossProfit  = revenue - monthlyCosts.total;
    const grossMargin  = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
    const cac          = newPatients > 0 ? monthlyCosts.total / newPatients : 0;

    const ltvPrep = calculateLTV('facilita_prep').ltv;
    const ltvIaso = calculateLTV('iaso_clinica').ltv;
    const avgLTV  = ltvPrep * 0.7 + ltvIaso * 0.3;
    const ltvCacRatio  = cac > 0 ? avgLTV / cac : 0;
    const paybackMonths = cac > 0 ? cac / (avgLTV / 18) : 0;

    const alerts = this.generateAlerts({ cac, grossMargin, ltvCacRatio, revenue, targetMonth });

    return {
      month: targetMonth,
      revenue: parseFloat(revenue.toFixed(2)),
      initialConsultationRevenue: parseFloat(initial.toFixed(2)),
      recurringRevenue: parseFloat(recurring.toFixed(2)),
      costs: monthlyCosts,
      grossProfit: parseFloat(grossProfit.toFixed(2)),
      grossMargin: parseFloat(grossMargin.toFixed(1)),
      newPatients,
      activePatients: Math.round(activePatients),
      cac: parseFloat(cac.toFixed(2)),
      avgLTV: parseFloat(avgLTV.toFixed(2)),
      ltvCacRatio: parseFloat(ltvCacRatio.toFixed(1)),
      paybackMonths: parseFloat(paybackMonths.toFixed(1)),
      alerts,
    };
  }

  // ── 3-month revenue projection ────────────────────────────────────────────────

  projectRevenue(baseMonth: string, horizonMonths = 3): RevenueProjection[] {
    const projections: RevenueProjection[] = [];

    // Trend: average new patients from last 2 months
    const recentCohorts = this.cohorts.filter((c) => {
      const age = monthsBetween(c.month, baseMonth);
      return age >= 0 && age <= 1;
    });
    const avgNewPatients = recentCohorts.length > 0
      ? recentCohorts.reduce((s, c) => s + c.newPatients, 0) / recentCohorts.length
      : 50;
    const avgAdSpend = recentCohorts.length > 0
      ? recentCohorts.reduce((s, c) => s + c.adSpend, 0) / recentCohorts.length
      : 2250;

    for (let i = 1; i <= horizonMonths; i++) {
      const month = addMonths(baseMonth, i);
      // Optimistic growth: +10% new patients per month (optimizer effect)
      const projectedNew = Math.round(avgNewPatients * Math.pow(1.10, i));

      // Simulate registering the projected cohort temporarily
      const tempCohort: PatientCohort = {
        id: `${month}-PROJECTED`,
        month,
        platform: 'PROJECTED',
        newPatients: projectedNew,
        adSpend: avgAdSpend * Math.pow(1.08, i),
        aiCost: aiTotal(DEFAULT_AI_COSTS),
        cac: 0,
        productMix: { facilita_prep: 0.7, iaso_clinica: 0.3 },
      };
      this.cohorts.push(tempCohort);

      const { initial, recurring, activePatients } = this.calculateRevenue(month);
      const projectedRevenue = initial + recurring;
      const projectedCosts = (avgAdSpend * Math.pow(1.08, i)) + aiTotal(DEFAULT_AI_COSTS) + DEFAULT_INFRA;
      const projectedProfit = projectedRevenue - projectedCosts;

      projections.push({
        month,
        projectedNewPatients: projectedNew,
        projectedActivePatients: Math.round(activePatients),
        projectedRevenue: parseFloat(projectedRevenue.toFixed(2)),
        projectedCosts: parseFloat(projectedCosts.toFixed(2)),
        projectedProfit: parseFloat(projectedProfit.toFixed(2)),
        confidence: i === 1 ? 'HIGH' : i === 2 ? 'MEDIUM' : 'LOW',
      });

      // Remove temp cohort
      this.cohorts = this.cohorts.filter((c) => c.id !== `${month}-PROJECTED`);
    }

    return projections;
  }

  // ── Alerts ────────────────────────────────────────────────────────────────────

  private generateAlerts(params: {
    cac: number; grossMargin: number; ltvCacRatio: number;
    revenue: number; targetMonth: string;
  }): FinancialAlert[] {
    const alerts: FinancialAlert[] = [];

    const check = (
      type: AlertType, metric: number,
      thresholds: { warning: number; critical: number },
      above: boolean, // true = alert when metric > threshold; false = when < threshold
      message: (v: number, t: number) => string,
      action: string,
    ) => {
      const exceedsCritical = above ? metric > thresholds.critical : metric < thresholds.critical;
      const exceedsWarning  = above ? metric > thresholds.warning  : metric < thresholds.warning;
      if (exceedsCritical) {
        alerts.push({ type, severity: 'CRITICAL', message: message(metric, thresholds.critical), metric, threshold: thresholds.critical, action });
      } else if (exceedsWarning) {
        alerts.push({ type, severity: 'WARNING', message: message(metric, thresholds.warning), metric, threshold: thresholds.warning, action });
      }
    };

    check('CAC_HIGH', params.cac, THRESHOLDS.cac, true,
      (v, t) => `CAC ${brl(v)} acima do limite ${brl(t)}. Custo de aquisição em zona de risco.`,
      'Pausar campanhas com CPA elevado. Revisar público-alvo e criativo.');

    check('MARGIN_LOW', params.grossMargin, THRESHOLDS.margin, false,
      (v, t) => `Margem bruta ${pct(v)} abaixo do mínimo saudável ${pct(t)}.`,
      'Reduzir verba de anúncios ou aumentar ticket médio.');

    check('LTV_CAC_LOW', params.ltvCacRatio, THRESHOLDS.ltvCac, false,
      (v, t) => `Relação LTV:CAC ${v.toFixed(1)}× abaixo do mínimo ${t}×. Negócio pode não ser sustentável.`,
      'Aumentar LTV via upsell (planos mensais PrEP) ou reduzir CAC.');

    // Revenue drop vs previous month
    const prev = this.pnlHistory.find((p) => p.month === addMonths(params.targetMonth, -1));
    if (prev && prev.revenue > 0) {
      const dropPct = ((prev.revenue - params.revenue) / prev.revenue) * 100;
      if (dropPct > THRESHOLDS.revenueDropPct.critical) {
        alerts.push({ type: 'REVENUE_DROP', severity: 'CRITICAL', message: `Receita caiu ${pct(dropPct)} vs mês anterior. Checar churn e campanhas.`, metric: dropPct, threshold: THRESHOLDS.revenueDropPct.critical, action: 'Analisar cohorts com maior churn. Ativar campanha de retenção.' });
      } else if (dropPct > THRESHOLDS.revenueDropPct.warning) {
        alerts.push({ type: 'REVENUE_DROP', severity: 'WARNING', message: `Receita caiu ${pct(dropPct)} vs mês anterior.`, metric: dropPct, threshold: THRESHOLDS.revenueDropPct.warning, action: 'Monitorar e verificar se tendência continua.' });
      }
    }

    return alerts;
  }

  // ── YTD summary ───────────────────────────────────────────────────────────────

  private buildYTD(currentMonth: string): YTDSummary {
    const year = currentMonth.slice(0, 4);
    const history = this.pnlHistory.filter((p) => p.month.startsWith(year));

    if (!history.length) {
      return { totalRevenue: 0, totalCosts: 0, totalProfit: 0, totalNewPatients: 0, avgCAC: 0, avgMargin: 0, avgLTVCACRatio: 0, bestMonth: '-', bestMonthProfit: 0 };
    }

    const best = history.reduce((a, b) => b.grossProfit > a.grossProfit ? b : a);
    return {
      totalRevenue:    parseFloat(history.reduce((s, p) => s + p.revenue,      0).toFixed(2)),
      totalCosts:      parseFloat(history.reduce((s, p) => s + p.costs.total,  0).toFixed(2)),
      totalProfit:     parseFloat(history.reduce((s, p) => s + p.grossProfit,  0).toFixed(2)),
      totalNewPatients: history.reduce((s, p) => s + p.newPatients, 0),
      avgCAC:          parseFloat((history.reduce((s, p) => s + p.cac,         0) / history.length).toFixed(2)),
      avgMargin:       parseFloat((history.reduce((s, p) => s + p.grossMargin, 0) / history.length).toFixed(1)),
      avgLTVCACRatio:  parseFloat((history.reduce((s, p) => s + p.ltvCacRatio, 0) / history.length).toFixed(1)),
      bestMonth:       best.month,
      bestMonthProfit: best.grossProfit,
    };
  }

  // ── Full financial report ─────────────────────────────────────────────────────

  generateReport(targetMonth?: string): FinancialReport {
    const month = targetMonth ?? ym();
    const pnl = this.calculatePnL(month);

    // Store in history if not already there
    if (!this.pnlHistory.find((p) => p.month === month)) {
      this.pnlHistory.push(pnl);
      this.saveState();
    }

    const projections = this.projectRevenue(month);
    const ytd = this.buildYTD(month);

    const report: FinancialReport = {
      generatedAt: new Date().toISOString(),
      period: month,
      pnl,
      cohorts: this.cohorts.filter((c) => c.month === month),
      projections,
      ytd,
    };

    this.saveReport(report);
    this.logReport(report);
    return report;
  }

  // ── Simulation: seed 12-month historical data ─────────────────────────────────

  seedSimulationData() {
    const today = ym();
    const platforms = ['META', 'GOOGLE', 'LINKEDIN'] as const;
    const newPatientsByMonth = [25, 35, 51, 51, 51, 65, 65, 65, 80, 80, 80, 95];
    const spendByMonth       = [2250, 2250, 2250, 2650, 2650, 3000, 3000, 3000, 4000, 4000, 4000, 5000];

    logger.info('[SIMULATION] Semeando dados históricos de 12 meses...');

    this.cohorts    = [];
    this.pnlHistory = [];

    for (let i = 11; i >= 0; i--) {
      const month       = addMonths(today, -i);
      const totalPats   = newPatientsByMonth[11 - i];
      const totalSpend  = spendByMonth[11 - i];

      const split = [
        { platform: 'META',     pats: Math.round(totalPats * 0.40), spend: totalSpend * 0.40 },
        { platform: 'GOOGLE',   pats: Math.round(totalPats * 0.45), spend: totalSpend * 0.40 },
        { platform: 'LINKEDIN', pats: Math.round(totalPats * 0.15), spend: totalSpend * 0.20 },
      ];

      for (const s of split) {
        this.registerAcquisition({
          month,
          platform: s.platform,
          newPatients: s.pats,
          adSpend: s.spend,
          aiCost: aiTotal(DEFAULT_AI_COSTS) / 3,
        });
      }
    }

    logger.info('[SIMULATION] Dados históricos semeados', { cohorts: this.cohorts.length });
  }

  // ── Logging ───────────────────────────────────────────────────────────────────

  private logReport(r: FinancialReport) {
    const p = r.pnl;
    const sep = '═'.repeat(60);
    logger.info(sep);
    logger.info(`RELATÓRIO FINANCEIRO — ${r.period}`);
    logger.info(sep);
    logger.info(`Receita total:           ${brl(p.revenue)}`);
    logger.info(`  Consultas iniciais:    ${brl(p.initialConsultationRevenue)}`);
    logger.info(`  Recorrente (ativos):   ${brl(p.recurringRevenue)}`);
    logger.info(`Custos totais:           ${brl(p.costs.total)}`);
    logger.info(`  Verba de anúncios:     ${brl(p.costs.adSpend)}`);
    logger.info(`  IAs (todas):           ${brl(aiTotal(p.costs.aiCosts))}`);
    logger.info(`  Infra:                 ${brl(p.costs.infrastructure)}`);
    logger.info(`Lucro bruto:             ${brl(p.grossProfit)}`);
    logger.info(`Margem bruta:            ${pct(p.grossMargin)}`);
    logger.info('');
    logger.info(`Pacientes novos:         ${p.newPatients}`);
    logger.info(`Pacientes ativos:        ${p.activePatients}`);
    logger.info(`CAC:                     ${brl(p.cac)}`);
    logger.info(`LTV médio:               ${brl(p.avgLTV)}`);
    logger.info(`Relação LTV:CAC:         ${p.ltvCacRatio.toFixed(1)}×`);
    logger.info(`Payback:                 ${p.paybackMonths.toFixed(1)} meses`);

    if (r.ytd.totalRevenue > 0) {
      logger.info('');
      logger.info('ACUMULADO NO ANO (YTD):');
      logger.info(`  Receita:    ${brl(r.ytd.totalRevenue)}  |  Custo: ${brl(r.ytd.totalCosts)}  |  Lucro: ${brl(r.ytd.totalProfit)}`);
      logger.info(`  CAC médio:  ${brl(r.ytd.avgCAC)}  |  Margem: ${pct(r.ytd.avgMargin)}  |  LTV:CAC: ${r.ytd.avgLTVCACRatio.toFixed(1)}×`);
      logger.info(`  Melhor mês: ${r.ytd.bestMonth} (${brl(r.ytd.bestMonthProfit)} lucro)`);
    }

    logger.info('');
    logger.info('PROJEÇÃO PRÓXIMOS 3 MESES:');
    for (const proj of r.projections) {
      const conf = { HIGH: '🟢', MEDIUM: '🟡', LOW: '🟠' }[proj.confidence];
      logger.info(`  ${conf} ${proj.month}: ${proj.projectedNewPatients} pac novos | Receita ${brl(proj.projectedRevenue)} | Lucro ${brl(proj.projectedProfit)} [${proj.confidence}]`);
    }

    if (p.alerts.length) {
      logger.info('');
      logger.info('ALERTAS:');
      for (const alert of p.alerts) {
        const icon = { INFO: 'ℹ', WARNING: '⚠', CRITICAL: '🚨' }[alert.severity];
        logger.info(`  ${icon}  [${alert.type}] ${alert.message}`);
        logger.info(`     → ${alert.action}`);
      }
    } else {
      logger.info('');
      logger.info('✅ Sem alertas financeiros — todos os KPIs dentro dos limites.');
    }

    logger.info(sep);
  }

  private saveReport(report: FinancialReport) {
    if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
    const file = path.join(LOGS_DIR, `financial_${report.period}.json`);
    fs.writeFileSync(file, JSON.stringify(report, null, 2));
    logger.info(`Relatório financeiro salvo: ${file}`);
  }
}

function aiTotal(costs: { claude: number; ideogram: number; heygen: number; runway: number }): number {
  return costs.claude + costs.ideogram + costs.heygen + costs.runway;
}

export const financialAgent = new FinancialAgent();
