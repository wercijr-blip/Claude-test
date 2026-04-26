import fs from 'fs';
import path from 'path';
import logger from '../utils/logger';
import type { AdCampaign, DailyReport, PlatformSummary, AdMetrics } from '../types';

const LOGS_DIR = path.resolve(__dirname, '../../logs');

export class ReportAgent {
  private activeCampaigns: AdCampaign[] = [];

  registerCampaign(campaign: AdCampaign): void {
    const existing = this.activeCampaigns.findIndex((c) => c.id === campaign.id);
    if (existing >= 0) {
      this.activeCampaigns[existing] = campaign;
    } else {
      this.activeCampaigns.push(campaign);
    }
  }

  updateMetrics(campaignId: string, metrics: AdMetrics): void {
    const camp = this.activeCampaigns.find((c) => c.id === campaignId);
    if (camp) {
      camp.metrics = metrics;
    }
  }

  async generateMonthlyReport(year: number, month: number): Promise<DailyReport> {
    logger.info(`Gerando relatório mensal ${year}-${String(month).padStart(2, '0')}`);

    const totalSpend = this.activeCampaigns.reduce((s, c) => s + (c.metrics?.spend ?? 0), 0);
    const totalReach = this.activeCampaigns.reduce((s, c) => s + (c.metrics?.reach ?? 0), 0);
    const totalLeads = this.activeCampaigns.reduce((s, c) => s + (c.metrics?.leads ?? 0), 0);

    const byPlatform: Record<string, PlatformSummary> = {};
    for (const camp of this.activeCampaigns) {
      const p = camp.platform;
      if (!byPlatform[p]) {
        byPlatform[p] = { spend: 0, reach: 0, leads: 0, clicks: 0, cpl: 0 };
      }
      byPlatform[p].spend += camp.metrics?.spend ?? 0;
      byPlatform[p].reach += camp.metrics?.reach ?? 0;
      byPlatform[p].leads += camp.metrics?.leads ?? 0;
      byPlatform[p].clicks += camp.metrics?.clicks ?? 0;
    }

    for (const [platform, summary] of Object.entries(byPlatform)) {
      summary.cpl = summary.leads > 0 ? summary.spend / summary.leads : 0;
      byPlatform[platform] = {
        ...summary,
        spend: parseFloat(summary.spend.toFixed(2)),
        cpl: parseFloat(summary.cpl.toFixed(2)),
      };
    }

    const report: DailyReport = {
      date: `${year}-${String(month).padStart(2, '0')}`,
      campaigns: this.activeCampaigns,
      posts: [],
      totalSpend: parseFloat(totalSpend.toFixed(2)),
      totalReach,
      totalLeads,
      costPerLead: totalLeads > 0 ? parseFloat((totalSpend / totalLeads).toFixed(2)) : 0,
      byPlatform,
    };

    this.saveReport(report, year, month);
    this.logSummary(report);

    return report;
  }

  private saveReport(report: DailyReport, year: number, month: number): void {
    if (!fs.existsSync(LOGS_DIR)) {
      fs.mkdirSync(LOGS_DIR, { recursive: true });
    }

    const filename = path.join(LOGS_DIR, `report_${year}-${String(month).padStart(2, '0')}.json`);
    fs.writeFileSync(filename, JSON.stringify(report, null, 2), 'utf-8');
    logger.info(`Relatório salvo em: ${filename}`);
  }

  private logSummary(report: DailyReport): void {
    logger.info('═══════════════════════════════════════════');
    logger.info(`RELATÓRIO MENSAL — ${report.date}`);
    logger.info(`  Total Gasto:   R$ ${report.totalSpend.toFixed(2)}`);
    logger.info(`  Total Alcance: ${report.totalReach.toLocaleString('pt-BR')} pessoas`);
    logger.info(`  Total Leads:   ${report.totalLeads}`);
    logger.info(`  Custo/Lead:    R$ ${report.costPerLead.toFixed(2)}`);
    logger.info('  Por Plataforma:');
    for (const [platform, s] of Object.entries(report.byPlatform)) {
      logger.info(
        `    ${platform.padEnd(8)} → R$ ${s.spend.toFixed(2)} | ${s.leads} leads | CPL R$ ${s.cpl.toFixed(2)}`,
      );
    }
    logger.info('═══════════════════════════════════════════');
  }

  loadLatestReport(): DailyReport | null {
    if (!fs.existsSync(LOGS_DIR)) return null;
    const files = fs
      .readdirSync(LOGS_DIR)
      .filter((f) => f.startsWith('report_') && f.endsWith('.json'))
      .sort()
      .reverse();

    if (!files.length) return null;

    const content = fs.readFileSync(path.join(LOGS_DIR, files[0]), 'utf-8');
    return JSON.parse(content) as DailyReport;
  }
}

export const reportAgent = new ReportAgent();
