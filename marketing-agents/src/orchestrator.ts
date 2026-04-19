import 'dotenv/config';
import { z } from 'zod';
import logger from './utils/logger';
import { scheduleTask, getNextRun } from './utils/scheduler';
import { contentAgent } from './agents/content-agent';
import { instagramAgent } from './agents/instagram-agent';
import { googleAgent } from './agents/google-agent';
import { linkedinAgent } from './agents/linkedin-agent';
import { reportAgent } from './agents/report-agent';
import { budgetOptimizer } from './optimizer/budget-optimizer';
import { imageAgent } from './agents/image-agent';
import { videoAgent } from './agents/video-agent';
import { financialAgent } from './agents/financial-agent';
import { leadAgent } from './agents/lead-agent';
import { approvalAgent } from './agents/approval-agent';
import { complianceAgent } from './agents/compliance-agent';
import { startDashboardServer, markRoutineStart, markRoutineDone } from './dashboard/server';
import { META_AUDIENCES, GOOGLE_KEYWORDS_PREP } from './config/targets';
import type { AdCampaign, ChannelPerformance } from './types';

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

// ─── Session state ────────────────────────────────────────────────────────────

interface CampaignState {
  id: string;
  dailyBudget: number;
  status: 'ACTIVE' | 'PAUSED';
}

const session: {
  meta?: CampaignState;
  google?: CampaignState;
  linkedin?: CampaignState;
} = {};

// ─── Compliance + schedule helper ────────────────────────────────────────────

async function scheduleWithCompliance(params: {
  content: import('./types').GeneratedContent;
  brand: import('./types').Brand;
  platform: string;
  label: string;
  preview: string;
  imageUrl?: string;
  videoUrl?: string;
  publishFn: (job: import('./types').ContentJob) => Promise<string | undefined>;
}) {
  const { content, publishFn, ...rest } = params;
  const compliance = await complianceAgent.check(content);

  if (compliance.status === 'BLOCKED') {
    logger.warn(`[Orchestrator] ⛔ Publicação BLOQUEADA por compliance: ${rest.label}`);
    logger.warn(`[Orchestrator]    Motivo: ${compliance.issues.map(i => i.description).join(' | ')}`);
    return null;
  }

  const job = approvalAgent.schedule({ ...rest, delayMinutes: 5, publishFn });
  job.compliance = compliance;
  return job;
}

// ─── Routine 1: Daily content post (Mon/Wed/Fri 09:00) ───────────────────────

async function dailyContentPost() {
  markRoutineStart('daily');
  logger.info('── Rotina: Postagem Diária de Conteúdo ──────────────────────────');

  // ── Instagram Feed → fila de aprovação ──────────────────────────────────────
  const igContent = await contentAgent.generateContent({
    platform: 'INSTAGRAM_FEED', audience: 'lgbt_adulto_brasil', brand: 'facilita_prep',
  });
  const igImagePrompt = await contentAgent.generateImagePrompt(igContent, 'SQUARE');
  const igImage = await imageAgent.generateForInstagramFeed(igImagePrompt.prompt, igImagePrompt.negativePrompt, 'facilita_prep');
  await scheduleWithCompliance({
    content: igContent, brand: 'facilita_prep', platform: 'INSTAGRAM_FEED',
    label: 'Instagram Feed — Facilita PrEP',
    preview: igContent.firstLine ?? igContent.caption?.slice(0, 120) ?? '',
    imageUrl: igImage.url,
    publishFn: async () => { const r = await instagramAgent.postToInstagram(igContent, igImage.url); return r.postId; },
  });

  // ── Instagram Reel → fila de aprovação ───────────────────────────────────────
  const reelContent = await contentAgent.generateContent({
    platform: 'YOUTUBE_SCRIPT', audience: 'lgbt_adulto_brasil', brand: 'facilita_prep',
  });
  const reelScript = (reelContent.segments ?? []).map(s => s.text).join(' ');
  const reelVideo  = await videoAgent.generateAnimatedReel(reelScript, 'facilita_prep');
  if (reelVideo.status === 'COMPLETED' && reelVideo.thumbnailUrl) {
    await scheduleWithCompliance({
      content: reelContent, brand: 'facilita_prep', platform: 'INSTAGRAM_REEL',
      label: 'Instagram Reel — Facilita PrEP',
      preview: reelScript.slice(0, 120),
      imageUrl: reelVideo.thumbnailUrl,
      videoUrl: reelVideo.videoUrl,
      publishFn: async () => { const r = await instagramAgent.postInstagramStory(reelVideo.thumbnailUrl!, 'https://facilitaprep.com.br'); return r.postId; },
    });
  }

  // ── LinkedIn → fila de aprovação ─────────────────────────────────────────────
  const liContent = await contentAgent.generateContent({
    platform: 'LINKEDIN_POST', audience: 'profissionais_saude', brand: 'iaso_clinica',
  });
  const liImagePrompt = await contentAgent.generateImagePrompt(liContent, 'LANDSCAPE');
  const liImage = await imageAgent.generateForLinkedIn(liImagePrompt.prompt, liImagePrompt.negativePrompt);
  await scheduleWithCompliance({
    content: liContent, brand: 'iaso_clinica', platform: 'LINKEDIN_POST',
    label: 'LinkedIn Post — Clínica IASO',
    preview: liContent.hook ?? liContent.body?.slice(0, 120) ?? '',
    imageUrl: liImage.url,
    publishFn: async () => { const r = await linkedinAgent.createOrganizationPost(liContent); return r.postId; },
  });

  // ── Vídeo Dr. Werciley (HeyGen) — gerado em background ───────────────────────
  const drVideoScript = (liContent.hook ?? '') + ' ' + (liContent.body ?? '').slice(0, 500);
  const drVideo = await videoAgent.generateDrWercileyReel(drVideoScript);
  logger.info('Vídeo Dr. Werciley submetido', {
    jobId: drVideo.jobId, status: drVideo.status,
    url: drVideo.videoUrl?.slice(0, 60) ?? '(processando…)',
  });

  // Google Ads — criar se não existir
  if (!session.google) {
    const googleContent = await contentAgent.generateContent({
      platform: 'GOOGLE_ADS',
      audience: 'busca_prep_brasil',
      brand: 'facilita_prep',
    });
    const dailyBudget = 30;
    const campaignId = await googleAgent.createSearchCampaign({
      name: `PrEP Busca — ${new Date().toISOString().slice(0, 10)}`,
      budgetBRL: dailyBudget,
    });
    await googleAgent.addKeywords(campaignId, GOOGLE_KEYWORDS_PREP);
    await googleAgent.createResponsiveSearchAd(campaignId, googleContent);
    session.google = { id: campaignId, dailyBudget, status: 'PAUSED' };
    reportAgent.registerCampaign({
      id: campaignId,
      name: `PrEP Busca — ${new Date().toISOString().slice(0, 10)}`,
      platform: 'GOOGLE',
      budget: dailyBudget,
      status: 'PAUSED',
      metrics: { impressions: 0, clicks: 0, spend: 0, leads: 0, cpc: 0, cpm: 0, ctr: 0 },
    });
  }

  // Meta Ads — criar se não existir
  if (!session.meta) {
    const metaContent = await contentAgent.generateContent({
      platform: 'INSTAGRAM_FEED',
      audience: 'lgbt_adulto_brasil',
      brand: 'facilita_prep',
    });
    const dailyBudget = 25;
    const campaignId = await instagramAgent.createCampaign({
      name: `PrEP Awareness — ${new Date().toISOString().slice(0, 10)}`,
      objective: 'LEAD_GENERATION',
      dailyBudget,
      targeting: META_AUDIENCES.lgbt_brasil,
      startTime: new Date().toISOString(),
      destinationUrl: 'https://facilitaprep.com.br',
      content: metaContent,
    });
    session.meta = { id: campaignId, dailyBudget, status: 'PAUSED' };
    reportAgent.registerCampaign({
      id: campaignId,
      name: `PrEP Awareness — ${new Date().toISOString().slice(0, 10)}`,
      platform: 'META',
      budget: dailyBudget,
      status: 'PAUSED',
      metrics: { impressions: 0, clicks: 0, spend: 0, leads: 0, cpc: 0, cpm: 0, ctr: 0 },
    });
  }

  // LinkedIn Ads — criar se não existir
  if (!session.linkedin) {
    const liAdContent = await contentAgent.generateContent({
      platform: 'LINKEDIN_POST',
      audience: 'profissionais_saude_brasilia',
      brand: 'iaso_clinica',
    });
    const dailyBudget = 20;
    const campaignId = await linkedinAgent.createLinkedInAd({
      name: `IASO Branding LinkedIn — ${new Date().toISOString().slice(0, 10)}`,
      dailyBudget,
      content: liAdContent,
    });
    session.linkedin = { id: campaignId, dailyBudget, status: 'PAUSED' };
    reportAgent.registerCampaign({
      id: campaignId,
      name: `IASO Branding LinkedIn — ${new Date().toISOString().slice(0, 10)}`,
      platform: 'LINKEDIN',
      budget: dailyBudget,
      status: 'PAUSED',
      metrics: { impressions: 0, clicks: 0, spend: 0, leads: 0, cpc: 0, cpm: 0, ctr: 0 },
    });
  }

  logger.info('── Postagem diária concluída ─────────────────────────────────────');
  markRoutineDone('daily', true);
}

// ─── Routine 2: Weekly optimization WITH BudgetOptimizer (Mon 08:00) ─────────

async function weeklyAdOptimization() {
  markRoutineStart('optimization');
  logger.info('── Rotina: Otimização Inteligente de Investimento ───────────────');

  budgetOptimizer.logLTVProfiles();

  const today = new Date();
  const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const channels: ChannelPerformance[] = [];

  // ── Coletar e construir performance de cada canal ────────────────────────────

  if (session.meta) {
    const metrics = await instagramAgent.getCampaignMetrics(session.meta.id);
    reportAgent.updateMetrics(session.meta.id, metrics);
    channels.push(
      budgetOptimizer.buildMetaPerformance(
        session.meta.id,
        `PrEP Awareness — Meta`,
        metrics,
        session.meta.dailyBudget,
      ),
    );
  }

  if (session.google) {
    const metrics = await googleAgent.getCampaignReport(fmt(lastWeek), fmt(today));
    channels.push(
      budgetOptimizer.buildGooglePerformance(
        session.google.id,
        metrics.campaignName,
        metrics,
        session.google.dailyBudget,
      ),
    );
    reportAgent.updateMetrics(session.google.id, {
      impressions: metrics.impressions,
      clicks: metrics.clicks,
      spend: metrics.cost,
      leads: metrics.conversions,
      cpc: metrics.averageCpc,
      cpm: 0,
      ctr: metrics.ctr,
    });
  }

  if (session.linkedin) {
    const metrics = await linkedinAgent.getAdMetrics(session.linkedin.id);
    channels.push(
      budgetOptimizer.buildLinkedInPerformance(
        session.linkedin.id,
        `IASO Branding — LinkedIn`,
        metrics,
        session.linkedin.dailyBudget,
      ),
    );
    reportAgent.updateMetrics(session.linkedin.id, {
      impressions: metrics.impressions,
      clicks: metrics.clicks,
      spend: metrics.costInLocalCurrency,
      leads: metrics.leads,
      cpc: metrics.clicks > 0 ? metrics.costInLocalCurrency / metrics.clicks : 0,
      cpm: metrics.impressions > 0 ? (metrics.costInLocalCurrency / metrics.impressions) * 1000 : 0,
      ctr: metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) * 100 : 0,
    });
  }

  // ── Analisar e tomar decisões com o BudgetOptimizer ─────────────────────────

  if (channels.length === 0) {
    logger.warn('Nenhum canal com dados suficientes para otimização.');
    return;
  }

  const report = budgetOptimizer.analyze(channels);
  budgetOptimizer.logReport(report);

  // ── Executar as decisões do optimizer ────────────────────────────────────────

  for (const decision of report.decisions) {
    await executeOptimizerDecision(decision, report);
  }

  // ── Executar realocações de orçamento ────────────────────────────────────────

  for (const realloc of report.reallocations) {
    logger.info(`Realocando orçamento: ${realloc.fromPlatform} → ${realloc.toPlatform} (${realloc.amountBRL}/dia)`);
    applyBudgetReallocation(realloc.fromPlatform, realloc.toPlatform, realloc.amountBRL);
  }

  logger.info('── Otimização inteligente concluída ─────────────────────────────');
  markRoutineDone('optimization', true);
}

async function executeOptimizerDecision(
  decision: { platform: string; campaignId: string; action: string; reason: string; budgetDeltaPct?: number },
  _report: unknown,
) {
  const { platform, campaignId, action, budgetDeltaPct } = decision;
  const state = platform === 'META' ? session.meta : platform === 'GOOGLE' ? session.google : session.linkedin;
  if (!state) return;

  switch (action) {
    case 'PAUSE':
      if (platform === 'META') {
        await instagramAgent.pauseCampaign(campaignId);
        state.status = 'PAUSED';
      }
      // LinkedIn e Google: log de aviso (APIs de pausa a implementar conforme necessidade)
      logger.warn(`[${platform}] Campanha pausada por decisão do optimizer.`);
      break;

    case 'NEW_CREATIVE': {
      // Gera novo conteúdo e pausa a campanha atual para substituição manual
      const brand = platform === 'LINKEDIN' ? 'iaso_clinica' : 'facilita_prep';
      const platformMap: Record<string, 'INSTAGRAM_FEED' | 'GOOGLE_ADS' | 'LINKEDIN_POST'> = {
        META: 'INSTAGRAM_FEED', GOOGLE: 'GOOGLE_ADS', LINKEDIN: 'LINKEDIN_POST',
      };
      const newContent = await contentAgent.generateContent({
        platform: platformMap[platform] ?? 'INSTAGRAM_FEED',
        audience: platform === 'LINKEDIN' ? 'profissionais_saude' : 'lgbt_adulto_brasil',
        brand,
      });
      logger.info(`[${platform}] Novo creative gerado`, {
        preview: newContent.firstLine ?? newContent.hook ?? newContent.headlines?.[0],
      });
      if (platform === 'META') {
        await instagramAgent.pauseCampaign(campaignId);
        state.status = 'PAUSED';
      }
      break;
    }

    case 'SCALE_UP':
    case 'SCALE_DOWN': {
      if (budgetDeltaPct === undefined) break;
      const change = state.dailyBudget * (budgetDeltaPct / 100);
      const newBudget = Math.max(5, parseFloat((state.dailyBudget + change).toFixed(2)));
      logger.info(`[${platform}] Ajuste de orçamento: R$${state.dailyBudget} → R$${newBudget} (${budgetDeltaPct > 0 ? '+' : ''}${budgetDeltaPct}%)`);
      state.dailyBudget = newBudget;
      // Na API real: chamaria updateBudget() de cada plataforma
      break;
    }

    case 'MAINTAIN':
    default:
      // Sem ação
      break;
  }
}

function applyBudgetReallocation(fromPlatform: string, toPlatform: string, amountBRL: number) {
  const stateMap: Record<string, CampaignState | undefined> = {
    META: session.meta, GOOGLE: session.google, LINKEDIN: session.linkedin,
  };
  const from = stateMap[fromPlatform];
  const to = stateMap[toPlatform];
  if (!from || !to) return;
  from.dailyBudget = Math.max(5, parseFloat((from.dailyBudget - amountBRL).toFixed(2)));
  to.dailyBudget = parseFloat((to.dailyBudget + amountBRL).toFixed(2));
  logger.info(`Orçamentos atualizados: ${fromPlatform} → R$${from.dailyBudget}/dia | ${toPlatform} → R$${to.dailyBudget}/dia`);
}

// ─── Routine 3: Monthly report (1st of month 07:00) ──────────────────────────

async function monthlyReport() {
  markRoutineStart('monthly');
  logger.info('── Rotina: Relatório Mensal ──────────────────────────────────────');
  const now = new Date();
  const month = now.getMonth() === 0 ? 12 : now.getMonth();
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  await reportAgent.generateMonthlyReport(year, month);

  // ── Relatório financeiro completo ─────────────────────────────────────────
  logger.info('── Relatório Financeiro ──────────────────────────────────────────');

  // Registrar aquisições do mês com base nas métricas coletadas
  if (session.meta) {
    const m = await instagramAgent.getCampaignMetrics(session.meta.id);
    financialAgent.registerAcquisition({
      platform: 'META',
      newPatients: Math.round(m.leads * 0.52),
      adSpend: m.spend,
      aiCost: 10.40 + 1.30 / 3,
    });
  }
  if (session.google) {
    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const m = await googleAgent.getCampaignReport(fmt(lastMonth), fmt(today));
    financialAgent.registerAcquisition({
      platform: 'GOOGLE',
      newPatients: Math.round(m.conversions * 0.63),
      adSpend: m.cost,
      aiCost: 1.30 / 3,
    });
  }
  if (session.linkedin) {
    const m = await linkedinAgent.getAdMetrics(session.linkedin.id);
    financialAgent.registerAcquisition({
      platform: 'LINKEDIN',
      newPatients: Math.round(m.leads * 0.35),
      adSpend: m.costInLocalCurrency,
      aiCost: 360 + 140 + 1.30 / 3,  // HeyGen + Runway dominam custo IA
    });
  }

  financialAgent.generateReport();
  logger.info('── Relatório mensal concluído ────────────────────────────────────');
  markRoutineDone('monthly', true);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  logger.info('╔══════════════════════════════════════════════════════════╗');
  logger.info('║  Marketing Agents — Facilita PrEP + Clínica IASO         ║');
  logger.info('╚══════════════════════════════════════════════════════════╝');

  validateEnv();

  const args = process.argv.slice(2);
  const runNow      = args.includes('--run-now');
  const reportOnly  = args.includes('--report-only');
  const financialOnly = args.includes('--financial');

  // Inicia o servidor web do dashboard
  if (!financialOnly && !reportOnly) {
    startDashboardServer({
      daily:        dailyContentPost,
      optimization: weeklyAdOptimization,
      monthly:      monthlyReport,
    });
  }

  if (financialOnly) {
    logger.info('Modo --financial: gerando relatório financeiro com dados simulados de 12 meses...');
    financialAgent.seedSimulationData();
    financialAgent.generateReport();
    process.exit(0);
  }

  if (reportOnly) {
    await monthlyReport();
    process.exit(0);
  }

  // Seed simulation data on first run
  if (process.env.SIMULATION_MODE === 'true') {
    financialAgent.seedSimulationData();
    await leadAgent.seedSimulationData();
    const funnel = leadAgent.generateFunnelReport();
    logger.info(`[Leads] Funil inicial: ${funnel.total} leads | HOT:${funnel.byZone['HOT'] ?? 0} | Convertidos:${funnel.byStatus['CONVERTED'] ?? 0}`);
  }

  const CRON_DAILY   = '0 9 * * 1,3,5';
  const CRON_WEEKLY  = '0 8 * * 1';
  const CRON_MONTHLY = '0 7 1 * *';
  const CRON_QUEUE   = '* * * * *';     // a cada 1 min: processa fila de aprovação
  const CRON_LEADS   = '0 */4 * * *';   // a cada 4h: processa fila de e-mails e follow-ups
  const CRON_REACTIVATION = '0 10 * * 3'; // quarta-feira: reativação de inativos

  scheduleTask({ name: 'Fila de Aprovação', expression: CRON_QUEUE, handler: async () => { await approvalAgent.processQueue(); } });
  scheduleTask({ name: 'Postagem Diária',      expression: CRON_DAILY,        handler: dailyContentPost });
  scheduleTask({ name: 'Otimização Semanal',   expression: CRON_WEEKLY,       handler: weeklyAdOptimization });
  scheduleTask({ name: 'Relatório Mensal',     expression: CRON_MONTHLY,      handler: monthlyReport });
  scheduleTask({ name: 'Leads — E-mail Queue', expression: CRON_LEADS,        handler: async () => { const n = await leadAgent.processEmailQueue(); logger.info(`[Leads] ${n} e-mails enviados`); } });
  scheduleTask({ name: 'Leads — Follow-up',    expression: CRON_LEADS,        handler: async () => { await leadAgent.followUpHotLeads(); } });
  scheduleTask({ name: 'Leads — Reativação',   expression: CRON_REACTIVATION, handler: async () => { await leadAgent.reactivateInactive(); } });

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
