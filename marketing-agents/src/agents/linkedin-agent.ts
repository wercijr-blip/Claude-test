import axios, { AxiosInstance } from 'axios';
import logger from '../utils/logger';
import { withRetry } from '../utils/scheduler';
import { LINKEDIN_TARGETING } from '../config/targets';
import type { GeneratedContent, PostResult, LinkedInAdConfig, LinkedInMetrics } from '../types';

// ─── Simulation helpers ───────────────────────────────────────────────────────

function mockPostId(): string {
  return `SIM_LI_${Date.now()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function mockCampaignId(): string {
  return `SIM_LI_CAMP_${Date.now()}`;
}

function mockLinkedInMetrics(): LinkedInMetrics {
  return {
    impressions: Math.floor(Math.random() * 15000) + 3000,
    clicks: Math.floor(Math.random() * 300) + 50,
    costInLocalCurrency: parseFloat((Math.random() * 200 + 50).toFixed(2)),
    leads: Math.floor(Math.random() * 20) + 2,
  };
}

// ─── LinkedIn Agent ───────────────────────────────────────────────────────────

export class LinkedInAgent {
  private isSimulation: boolean;
  private http: AxiosInstance;
  private orgId: string;
  private adAccountId: string;

  constructor() {
    this.isSimulation = process.env.SIMULATION_MODE === 'true';
    this.orgId = process.env.LINKEDIN_ORGANIZATION_ID ?? '';
    this.adAccountId = process.env.LINKEDIN_AD_ACCOUNT_ID ?? '';

    this.http = axios.create({
      baseURL: 'https://api.linkedin.com/v2',
      headers: {
        Authorization: `Bearer ${process.env.LINKEDIN_ACCESS_TOKEN ?? ''}`,
        'Content-Type': 'application/json',
        'LinkedIn-Version': '202304',
      },
    });
  }

  // ── Postagem orgânica ────────────────────────────────────────────────────────

  async createOrganizationPost(content: GeneratedContent): Promise<PostResult> {
    if (this.isSimulation) {
      const postId = mockPostId();
      logger.info('[SIMULATION] Post LinkedIn criado', {
        postId,
        hook: content.hook,
        hashtags: content.hashtags,
      });
      return { platform: 'LINKEDIN', success: true, postId, simulatedAt: new Date().toISOString() };
    }

    return withRetry(async () => {
      const text = [
        content.hook ?? '',
        '',
        content.body ?? '',
        '',
        content.cta ?? '',
        '',
        (content.hashtags ?? []).map((h) => `#${h}`).join(' '),
      ]
        .join('\n')
        .trim();

      const res = await this.http.post('/ugcPosts', {
        author: `urn:li:organization:${this.orgId}`,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: { text },
            shareMediaCategory: 'NONE',
          },
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
        },
      });

      const postId: string = res.data.id;
      logger.info('Post LinkedIn publicado', { postId });
      return { platform: 'LINKEDIN' as const, success: true, postId };
    });
  }

  // ── LinkedIn Ads ─────────────────────────────────────────────────────────────

  async createLinkedInAd(config: LinkedInAdConfig): Promise<string> {
    if (this.isSimulation) {
      const campaignId = mockCampaignId();
      logger.info('[SIMULATION] Campanha LinkedIn criada', {
        campaignId,
        name: config.name,
        dailyBudget: config.dailyBudget,
      });
      return campaignId;
    }

    return withRetry(async () => {
      // Passo 1: Criar campanha
      const campRes = await this.http.post('/adCampaignsV2', {
        account: `urn:li:sponsoredAccount:${this.adAccountId}`,
        name: config.name,
        type: 'SPONSORED_UPDATES',
        costType: 'CPM',
        dailyBudget: {
          amount: config.dailyBudget.toString(),
          currencyCode: 'BRL',
        },
        targetingCriteria: LINKEDIN_TARGETING.brasil,
        status: 'PAUSED',
        objectiveType: 'BRAND_AWARENESS',
      });
      const campaignId: string = campRes.data.id;

      // Passo 2: Criar post orgânico como base do creative
      const postResult = await this.createOrganizationPost(config.content);
      const postUrn = `urn:li:ugcPost:${postResult.postId}`;

      // Passo 3: Criar creative
      const creativeRes = await this.http.post('/adCreativesV2', {
        campaign: `urn:li:sponsoredCampaign:${campaignId}`,
        reference: postUrn,
        status: 'ACTIVE',
      });
      const creativeId: string = creativeRes.data.id;

      // Passo 4: Criar ad
      await this.http.post('/adDirectSponsoredContentsV2', {
        campaign: `urn:li:sponsoredCampaign:${campaignId}`,
        creative: `urn:li:sponsoredCreative:${creativeId}`,
        status: 'PAUSED',
      });

      logger.info('Campanha LinkedIn criada', { campaignId, name: config.name });
      return campaignId;
    });
  }

  async getAdMetrics(campaignId: string): Promise<LinkedInMetrics> {
    if (this.isSimulation) {
      const metrics = mockLinkedInMetrics();
      logger.info('[SIMULATION] Métricas LinkedIn', { campaignId, ...metrics });
      return metrics;
    }

    const res = await this.http.get('/adAnalyticsV2', {
      params: {
        q: 'analytics',
        pivot: 'CAMPAIGN',
        campaigns: `urn:li:sponsoredCampaign:${campaignId}`,
        fields: 'impressions,clicks,costInLocalCurrency,leadGenerationMailContactInfoShares',
      },
    });

    const d = res.data.elements?.[0] ?? {};
    return {
      impressions: Number(d.impressions ?? 0),
      clicks: Number(d.clicks ?? 0),
      costInLocalCurrency: Number(d.costInLocalCurrency ?? 0),
      leads: Number(d.leadGenerationMailContactInfoShares ?? 0),
    };
  }
}

export const linkedinAgent = new LinkedInAgent();
