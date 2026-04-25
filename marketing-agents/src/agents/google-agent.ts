import axios from 'axios';
import logger from '../utils/logger';
import { withRetry } from '../utils/scheduler';
import { GOOGLE_KEYWORDS_PREP } from '../config/targets';
import type { GeneratedContent, GoogleCampaignConfig, GoogleMetrics } from '../types';

const ADS_BASE = 'https://googleads.googleapis.com/v14/customers';

// ─── Simulation helpers ───────────────────────────────────────────────────────

function mockCampaignId(): string {
  return `SIM_GOOG_CAMP_${Date.now()}`;
}

function mockGoogleMetrics(): GoogleMetrics {
  return {
    campaignName: 'Simulação PrEP — Busca',
    impressions: Math.floor(Math.random() * 20000) + 5000,
    clicks: Math.floor(Math.random() * 600) + 100,
    cost: parseFloat((Math.random() * 150 + 30).toFixed(2)),
    conversions: Math.floor(Math.random() * 25) + 3,
    ctr: parseFloat((Math.random() * 3 + 0.5).toFixed(2)),
    averageCpc: parseFloat((Math.random() * 3 + 0.5).toFixed(2)),
  };
}

// ─── Google Ads Agent ─────────────────────────────────────────────────────────

export class GoogleAgent {
  private isSimulation: boolean;
  private customerId: string;
  private devToken: string;
  private accessToken: string;

  constructor() {
    this.isSimulation = process.env.SIMULATION_MODE === 'true';
    this.customerId = process.env.GOOGLE_ADS_CUSTOMER_ID ?? '';
    this.devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? '';
    this.accessToken = process.env.GOOGLE_ADS_REFRESH_TOKEN ?? '';
  }

  private get headers() {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      'developer-token': this.devToken,
      'Content-Type': 'application/json',
    };
  }

  async createSearchCampaign(config: GoogleCampaignConfig): Promise<string> {
    if (this.isSimulation) {
      const campaignId = mockCampaignId();
      logger.info('[SIMULATION] Campanha Google Ads criada', {
        campaignId,
        name: config.name,
        budgetBRL: config.budgetBRL,
      });
      return campaignId;
    }

    return withRetry(async () => {
      const res = await axios.post(
        `${ADS_BASE}/${this.customerId}/campaigns:mutate`,
        {
          operations: [
            {
              create: {
                name: config.name,
                advertisingChannelType: 'SEARCH',
                status: 'PAUSED',
                campaignBudget: {
                  amountMicros: config.budgetBRL * 1_000_000,
                  deliveryMethod: 'STANDARD',
                },
                targetSpend: {},
              },
            },
          ],
        },
        { headers: this.headers },
      );

      const campaignId: string = res.data.results[0].resourceName.split('/').pop()!;
      logger.info('Campanha Google Ads criada', { campaignId, name: config.name });
      return campaignId;
    });
  }

  async addKeywords(campaignId: string, keywords: string[] = GOOGLE_KEYWORDS_PREP): Promise<void> {
    if (this.isSimulation) {
      logger.info('[SIMULATION] Keywords adicionadas', {
        campaignId,
        count: keywords.length,
        sample: keywords.slice(0, 3),
      });
      return;
    }

    const operations = keywords.flatMap((kw) => [
      { create: { campaign: `customers/${this.customerId}/campaigns/${campaignId}`, keyword: { text: kw, matchType: 'BROAD' } } },
      { create: { campaign: `customers/${this.customerId}/campaigns/${campaignId}`, keyword: { text: kw, matchType: 'PHRASE' } } },
    ]);

    await axios.post(
      `${ADS_BASE}/${this.customerId}/adGroupCriteria:mutate`,
      { operations },
      { headers: this.headers },
    );

    logger.info('Keywords adicionadas', { campaignId, count: keywords.length });
  }

  async createResponsiveSearchAd(campaignId: string, content: GeneratedContent): Promise<void> {
    if (this.isSimulation) {
      logger.info('[SIMULATION] Anúncio responsivo criado', {
        campaignId,
        headlines: content.headlines?.slice(0, 2),
        descriptions: content.descriptions?.slice(0, 1),
      });
      return;
    }

    if (!content.headlines || !content.descriptions) {
      throw new Error('Conteúdo inválido para Google Ads: faltam headlines ou descriptions');
    }

    const headlines = content.headlines.map((text) => ({ text }));
    const descriptions = content.descriptions.map((text) => ({ text }));

    await axios.post(
      `${ADS_BASE}/${this.customerId}/ads:mutate`,
      {
        operations: [
          {
            create: {
              campaign: `customers/${this.customerId}/campaigns/${campaignId}`,
              responsiveSearchAd: { headlines, descriptions, path1: 'prep', path2: 'hiv' },
              finalUrls: ['https://facilitaprep.com.br'],
            },
          },
        ],
      },
      { headers: this.headers },
    );

    logger.info('Anúncio responsivo criado', { campaignId });
  }

  async getCampaignReport(startDate: string, endDate: string): Promise<GoogleMetrics> {
    if (this.isSimulation) {
      const metrics = mockGoogleMetrics();
      logger.info('[SIMULATION] Relatório Google Ads', { startDate, endDate, ...metrics });
      return metrics;
    }

    const query = `
      SELECT campaign.name, metrics.impressions, metrics.clicks,
             metrics.cost_micros, metrics.conversions, metrics.ctr, metrics.average_cpc
      FROM campaign
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
    `.trim();

    const res = await axios.post(
      `${ADS_BASE}/${this.customerId}/googleAds:searchStream`,
      { query },
      { headers: this.headers },
    );

    const row = res.data[0]?.results?.[0] ?? {};
    const m = row.metrics ?? {};

    return {
      campaignName: row.campaign?.name ?? 'Desconhecida',
      impressions: Number(m.impressions ?? 0),
      clicks: Number(m.clicks ?? 0),
      cost: Number(m.costMicros ?? 0) / 1_000_000,
      conversions: Number(m.conversions ?? 0),
      ctr: Number(m.ctr ?? 0) * 100,
      averageCpc: Number(m.averageCpc ?? 0) / 1_000_000,
    };
  }
}

export const googleAgent = new GoogleAgent();
