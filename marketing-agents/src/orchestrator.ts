import 'dotenv/config';
import path from 'path';
import { z } from 'zod';
import logger from './utils/logger';
import { scheduleTask, getNextRun } from './utils/scheduler';
import { contentAgent } from './agents/content-agent';
import { instagramAgent } from './agents/instagram-agent';
import { googleAgent } from './agents/google-agent';
import { linkedinAgent } from './agents/linkedin-agent';
import { reportAgent } from './agents/report-agent';
import { META_AUDIENCES, GOOGLE_KEYWORDS_PREP } from './config/targets';
import type { AdCampaign } from './types';

// ─── Env validation ───────────────────────────────────────────────────────────

const EnvSchema = z.object({
  ANTHROPIC_API_KEY: z.string().optional(),
  META_ACCESS_TOKEN: z.string().optional(),
  META_AD_ACCOUNT_ID: z.string().optional(),
  META_PAGE_ID: z.string().optional(),
  INSTAGRAM_BUSINESS_ACCOUNT_ID: z.string().optional(),
  GOOGLE_ADS_DEVELOPER_TOKEN: z.string().optional(),
  GOOGLE_ADS_CUSTOMER_ID: z.string().optional(),
  GOOGLE_ADS_REFRESH_TOKEN: z.string().optional(),
  LINKEDIN_ACCESS_TOKEN: z.string().optional(),
  LINKEDIN_ORGANIZATION_ID: z.string().optional(),
  LINKEDIN_AD_ACCOUNT_ID: z.string().optional(),
  SIMULATION_MODE: z.string().default('true'),
});

function validateEnv() {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    logger.error('Variáveis de ambiente inválidas:', result.error.flatten());
    process.exit(1);
  }

  const isSimulation = process.env.SIMULATION_MODE === 'true';
  if (!isSimulation && !process.env.ANTHROPIC_API_KEY) {
    logger.warn('ANTHROPIC_API_KEY não definida — usando modo simulação para content-agent');
  }

  logger.info(`Modo: ${isSimulation ? 'SIMULAÇÃO' : 'PRODUÇÃO'}`);
  return result.data;
}

// ─── Active campaign IDs (persisted in memory for this session) ───────────────
const sessionCampaigns: { meta?: string; google?: string; linkedin?: string } = {};

// ─── Routine 1: Daily content post (Mon/Wed/Fri 09:00) ───────────────────────

async function dailyContentPost() {
  logger.info('── Rotina: Postagem Diária de Conteúdo ──────────────────────────');

  // Instagram Feed — Facilita PrEP
  const igContent = await contentAgent.generateContent({
    platform: 'INSTAGRAM_FEED',
    audience: 'lgbt_adulto_brasil',
    brand: 'facilita_prep',
  });
  const igResult = await instagramAgent.postToInstagram(igContent);
  logger.info('Instagram result', { success: igResult.success, postId: igResult.postId });

  // LinkedIn — Clínica IASO
  const liContent = await contentAgent.generateContent({
    platform: 'LINKEDIN_POST',
    audience: 'profissionais_saude',
    brand: 'iaso_clinica',
  });
  const liResult = await linkedinAgent.createOrganizationPost(liContent);
  logger.info('LinkedIn result', { success: liResult.success, postId: liResult.postId });

  // Google Ads — create if not exists
  if (!sessionCampaigns.google) {
    const googleContent = await contentAgent.generateContent({
      platform: 'GOOGLE_ADS',
      audience: 'busca_prep_brasil',
      brand: 'facilita_prep',
    });

    const campaignId = await googleAgent.createSearchCampaign({
      name: `PrEP Busca — ${new Date().toISOString().slice(0, 10)}`,
      budgetBRL: 30,
    });

    await googleAgent.addKeywords(campaignId, GOOGLE_KEYWORDS_PREP);
    await googleAgent.createResponsiveSearchAd(campaignId, googleContent);
    sessionCampaigns.google = campaignId;

    const googleCamp: AdCampaign = {
      id: campaignId,
      name: `PrEP Busca — ${new Date().toISOString().slice(0, 10)}`,
      platform: 'GOOGLE',
      budget: 30,
      status: 'PAUSED',
      metrics: { impressions: 0, clicks: 0, spend: 0, leads: 0, cpc: 0, cpm: 0, ctr: 0 },
    };
    reportAgent.registerCampaign(googleCamp);
  }

  // Meta campaign — create if not exists
  if (!sessionCampaigns.meta) {
    const metaContent = await contentAgent.generateContent({
      platform: 'INSTAGRAM_FEED',
      audience: 'lgbt_adulto_brasil',
      brand: 'facilita_prep',
    });

    const campaignId = await instagramAgent.createCampaign({
      name: `PrEP Awareness — ${new Date().toISOString().slice(0, 10)}`,
      objective: 'LEAD_GENERATION',
      dailyBudget: 25,
      targeting: META_AUDIENCES.lgbt_brasil,
      startTime: new Date().toISOString(),
      destinationUrl: 'https://facilitaprep.com.br',
      content: metaContent,
    });

    sessionCampaigns.meta = campaignId;

    const metaCamp: AdCampaign = {
      id: campaignId,
      name: `PrEP Awareness — ${new Date().toISOString().slice(0, 10)}`,
      platform: 'META',
      budget: 25,
      status: 'PAUSED',
      metrics: { impressions: 0, clicks: 0, spend: 0, leads: 0, cpc: 0, cpm: 0, ctr: 0 },
    };
    reportAgent.registerCampaign(metaCamp);
  }

  // LinkedIn Ads — create if not exists
  if (!sessionCampaigns.linkedin) {
    const liAdContent = await contentAgent.generateContent({
      platform: 'LINKEDIN_POST',
      audience: 'profissionais_saude_brasilia',
      brand: 'iaso_clinica',
    });

    const campaignId = await linkedinAgent.createLinkedInAd({
      name: `IASO Branding LinkedIn — ${new Date().toISOString().slice(0, 10)}`,
      dailyBudget: 20,
      content: liAdContent,
    });

    sessionCampaigns.linkedin = campaignId;

    const liCamp: AdCampaign = {
      id: campaignId,
      name: `IASO Branding LinkedIn — ${new Date().toISOString().slice(0, 10)}`,
      platform: 'LINKEDIN',
      budget: 20,
      status: 'PAUSED',
      metrics: { impressions: 0, clicks: 0, spend: 0, leads: 0, cpc: 0, cpm: 0, ctr: 0 },
    };
    reportAgent.registerCampaign(liCamp);
  }

  logger.info('── Postagem diária concluída ─────────────────────────────────────');
}

// ─── Routine 2: Weekly ad optimization (Mon 08:00) ───────────────────────────

async function weeklyAdOptimization() {
  logger.info('── Rotina: Otimização Semanal de Anúncios ───────────────────────');

  const today = new Date();
  const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  // Coletar métricas
  if (sessionCampaigns.meta) {
    const metrics = await instagramAgent.getCampaignMetrics(sessionCampaigns.meta);
    reportAgent.updateMetrics(sessionCampaigns.meta, metrics);

    if (metrics.ctr < 0.8) {
      logger.warn(`CTR Meta baixo (${metrics.ctr.toFixed(2)}%) — pausando e recriando creative...`);
      await instagramAgent.pauseCampaign(sessionCampaigns.meta);
      const newContent = await contentAgent.generateContent({
        platform: 'INSTAGRAM_FEED',
        audience: 'lgbt_adulto_brasil',
        brand: 'facilita_prep',
      });
      logger.info('Novo creative gerado', { firstLine: newContent.firstLine });
    } else {
      logger.info(`Meta CTR OK: ${metrics.ctr.toFixed(2)}%`);
    }
  }

  if (sessionCampaigns.google) {
    const metrics = await googleAgent.getCampaignReport(fmt(lastWeek), fmt(today));
    if (metrics.averageCpc > 3.0) {
      logger.warn(`CPC Google alto (R$ ${metrics.averageCpc.toFixed(2)}) — reduzindo lances 20%...`);
      // Na API real: ajustaria bids. Em simulação, só loga.
    } else {
      logger.info(`Google CPC OK: R$ ${metrics.averageCpc.toFixed(2)}`);
    }
  }

  if (sessionCampaigns.linkedin) {
    const metrics = await linkedinAgent.getAdMetrics(sessionCampaigns.linkedin);
    reportAgent.updateMetrics(sessionCampaigns.linkedin, {
      impressions: metrics.impressions,
      clicks: metrics.clicks,
      spend: metrics.costInLocalCurrency,
      leads: metrics.leads,
      cpc: metrics.clicks > 0 ? metrics.costInLocalCurrency / metrics.clicks : 0,
      cpm:
        metrics.impressions > 0 ? (metrics.costInLocalCurrency / metrics.impressions) * 1000 : 0,
      ctr: metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) * 100 : 0,
    });
    logger.info('LinkedIn métricas coletadas', { impressions: metrics.impressions, leads: metrics.leads });
  }

  logger.info('── Otimização semanal concluída ─────────────────────────────────');
}

// ─── Routine 3: Monthly report (1st of month 07:00) ──────────────────────────

async function monthlyReport() {
  logger.info('── Rotina: Relatório Mensal ──────────────────────────────────────');
  const now = new Date();
  const month = now.getMonth() === 0 ? 12 : now.getMonth(); // previous month
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

  await reportAgent.generateMonthlyReport(year, month);
  logger.info('── Relatório mensal concluído ────────────────────────────────────');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  logger.info('╔══════════════════════════════════════════════════════════╗');
  logger.info('║  Marketing Agents — Facilita PrEP + Clínica IASO         ║');
  logger.info('╚══════════════════════════════════════════════════════════╝');

  validateEnv();

  const args = process.argv.slice(2);
  const runNow = args.includes('--run-now');
  const reportOnly = args.includes('--report-only');

  if (reportOnly) {
    await monthlyReport();
    process.exit(0);
  }

  // Schedule routines
  const CRON_DAILY = '0 9 * * 1,3,5';
  const CRON_WEEKLY = '0 8 * * 1';
  const CRON_MONTHLY = '0 7 1 * *';

  scheduleTask({ name: 'Postagem Diária', expression: CRON_DAILY, handler: dailyContentPost });
  scheduleTask({ name: 'Otimização Semanal', expression: CRON_WEEKLY, handler: weeklyAdOptimization });
  scheduleTask({ name: 'Relatório Mensal', expression: CRON_MONTHLY, handler: monthlyReport });

  logger.info('');
  logger.info('Próximas execuções agendadas:');
  logger.info(`  Postagem Diária    → ${getNextRun(CRON_DAILY)}`);
  logger.info(`  Otimização Semanal → ${getNextRun(CRON_WEEKLY)}`);
  logger.info(`  Relatório Mensal   → ${getNextRun(CRON_MONTHLY)}`);
  logger.info('');

  if (runNow) {
    logger.info('Flag --run-now detectada. Executando ciclo completo agora...');
    await dailyContentPost();
    await weeklyAdOptimization();
    await monthlyReport();
    logger.info('Ciclo --run-now concluído. Mantendo agendador ativo...');
  }

  logger.info('Agendador ativo. Aguardando próximas execuções...');
}

main().catch((err) => {
  logger.error('Erro fatal no orchestrator:', err);
  process.exit(1);
});
