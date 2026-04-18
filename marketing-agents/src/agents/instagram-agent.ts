import axios from 'axios';
import logger from '../utils/logger';
import { withRetry } from '../utils/scheduler';
import type { GeneratedContent, PostResult, CampaignConfig, AdMetrics } from '../types';

const GRAPH_BASE = 'https://graph.facebook.com/v18.0';

// ─── Simulation helpers ───────────────────────────────────────────────────────

function mockPostId(): string {
  return `SIM_IG_${Date.now()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function mockCampaignId(): string {
  return `SIM_META_CAMP_${Date.now()}`;
}

function mockMetrics(): AdMetrics {
  return {
    impressions: Math.floor(Math.random() * 40000) + 10000,
    reach: Math.floor(Math.random() * 30000) + 8000,
    clicks: Math.floor(Math.random() * 800) + 200,
    spend: parseFloat((Math.random() * 80 + 20).toFixed(2)),
    leads: Math.floor(Math.random() * 30) + 5,
    cpc: parseFloat((Math.random() * 2 + 0.5).toFixed(2)),
    cpm: parseFloat((Math.random() * 15 + 5).toFixed(2)),
    ctr: parseFloat((Math.random() * 2 + 0.3).toFixed(2)),
  };
}

// ─── Instagram Agent ─────────────────────────────────────────────────────────

export class InstagramAgent {
  private isSimulation: boolean;
  private token: string;
  private igAccountId: string;
  private pageId: string;
  private adAccountId: string;

  constructor() {
    this.isSimulation = process.env.SIMULATION_MODE === 'true';
    this.token = process.env.META_ACCESS_TOKEN ?? '';
    this.igAccountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID ?? '';
    this.pageId = process.env.META_PAGE_ID ?? '';
    this.adAccountId = process.env.META_AD_ACCOUNT_ID ?? '';
  }

  // ── Postagem orgânica ───────────────────────────────────────────────────────

  async postToInstagram(content: GeneratedContent, imageUrl?: string): Promise<PostResult> {
    if (this.isSimulation) {
      const postId = mockPostId();
      logger.info('[SIMULATION] Post Instagram criado', {
        postId,
        firstLine: content.firstLine ?? content.hook,
        hashtags: content.hashtags?.slice(0, 3),
      });
      return { platform: 'INSTAGRAM', success: true, postId, simulatedAt: new Date().toISOString() };
    }

    return withRetry(async () => {
      const caption = `${content.caption ?? content.firstLine ?? ''}\n\n${(content.hashtags ?? []).join(' ')}`;

      let creationId: string;

      if (imageUrl) {
        const mediaRes = await axios.post(`${GRAPH_BASE}/${this.igAccountId}/media`, {
          image_url: imageUrl,
          caption,
          access_token: this.token,
        });
        creationId = mediaRes.data.id;
      } else {
        const mediaRes = await axios.post(`${GRAPH_BASE}/${this.igAccountId}/media`, {
          media_type: 'TEXT',
          caption,
          access_token: this.token,
        });
        creationId = mediaRes.data.id;
      }

      const publishRes = await axios.post(`${GRAPH_BASE}/${this.igAccountId}/media_publish`, {
        creation_id: creationId,
        access_token: this.token,
      });

      const postId: string = publishRes.data.id;
      logger.info('Post Instagram publicado', { postId });
      return { platform: 'INSTAGRAM' as const, success: true, postId };
    });
  }

  async postInstagramStory(imageUrl: string, linkUrl: string): Promise<PostResult> {
    if (this.isSimulation) {
      const postId = mockPostId();
      logger.info('[SIMULATION] Story Instagram criado', { postId, linkUrl });
      return { platform: 'INSTAGRAM', success: true, postId, simulatedAt: new Date().toISOString() };
    }

    return withRetry(async () => {
      const mediaRes = await axios.post(`${GRAPH_BASE}/${this.igAccountId}/media`, {
        image_url: imageUrl,
        media_type: 'STORIES',
        link: linkUrl,
        access_token: this.token,
      });

      const publishRes = await axios.post(`${GRAPH_BASE}/${this.igAccountId}/media_publish`, {
        creation_id: mediaRes.data.id,
        access_token: this.token,
      });

      return { platform: 'INSTAGRAM' as const, success: true, postId: publishRes.data.id };
    });
  }

  // ── Meta Ads ────────────────────────────────────────────────────────────────

  async createCampaign(config: CampaignConfig): Promise<string> {
    if (this.isSimulation) {
      const campaignId = mockCampaignId();
      logger.info('[SIMULATION] Campanha Meta criada', {
        campaignId,
        name: config.name,
        objective: config.objective,
        dailyBudget: config.dailyBudget,
      });
      return campaignId;
    }

    return withRetry(async () => {
      // Passo 1: Criar campanha
      const campRes = await axios.post(`${GRAPH_BASE}/${this.adAccountId}/campaigns`, {
        name: config.name,
        objective: config.objective,
        status: 'PAUSED',
        special_ad_categories: ['HEALTH_AND_WELLNESS'],
        access_token: this.token,
      });
      const campaignId: string = campRes.data.id;

      // Passo 2: Criar Ad Set
      const adSetRes = await axios.post(`${GRAPH_BASE}/${this.adAccountId}/adsets`, {
        name: `${config.name}_adset`,
        campaign_id: campaignId,
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'LINK_CLICKS',
        daily_budget: Math.round(config.dailyBudget * 100),
        targeting: config.targeting,
        start_time: config.startTime,
        status: 'PAUSED',
        access_token: this.token,
      });
      const adSetId: string = adSetRes.data.id;

      // Passo 3: Criar Creative
      const creativeRes = await axios.post(`${GRAPH_BASE}/${this.adAccountId}/adcreatives`, {
        name: `${config.name}_creative`,
        object_story_spec: {
          page_id: this.pageId,
          link_data: {
            message: config.content.body ?? config.content.caption,
            link: config.destinationUrl,
            call_to_action: { type: 'LEARN_MORE' },
          },
        },
        access_token: this.token,
      });
      const creativeId: string = creativeRes.data.id;

      // Passo 4: Criar Ad
      await axios.post(`${GRAPH_BASE}/${this.adAccountId}/ads`, {
        name: config.name,
        adset_id: adSetId,
        creative: { creative_id: creativeId },
        status: 'PAUSED',
        access_token: this.token,
      });

      logger.info('Campanha Meta criada', { campaignId, name: config.name });
      return campaignId;
    });
  }

  async getCampaignMetrics(campaignId: string): Promise<AdMetrics> {
    if (this.isSimulation) {
      const metrics = mockMetrics();
      logger.info('[SIMULATION] Métricas Meta', { campaignId, ...metrics });
      return metrics;
    }

    const res = await axios.get(
      `${GRAPH_BASE}/${campaignId}/insights?fields=impressions,reach,clicks,spend,leads,cpc,cpm&access_token=${this.token}`,
    );
    const d = res.data.data[0] ?? {};
    return {
      impressions: Number(d.impressions ?? 0),
      reach: Number(d.reach ?? 0),
      clicks: Number(d.clicks ?? 0),
      spend: Number(d.spend ?? 0),
      leads: Number(d.leads ?? 0),
      cpc: Number(d.cpc ?? 0),
      cpm: Number(d.cpm ?? 0),
      ctr: Number(d.ctr ?? 0),
    };
  }

  async pauseCampaign(campaignId: string): Promise<void> {
    if (this.isSimulation) {
      logger.info('[SIMULATION] Campanha Meta pausada', { campaignId });
      return;
    }
    await axios.post(`${GRAPH_BASE}/${campaignId}`, {
      status: 'PAUSED',
      access_token: this.token,
    });
    logger.info('Campanha Meta pausada', { campaignId });
  }

  async activateCampaign(campaignId: string): Promise<void> {
    if (this.isSimulation) {
      logger.info('[SIMULATION] Campanha Meta ativada', { campaignId });
      return;
    }
    await axios.post(`${GRAPH_BASE}/${campaignId}`, {
      status: 'ACTIVE',
      access_token: this.token,
    });
    logger.info('Campanha Meta ativada', { campaignId });
  }
}

export const instagramAgent = new InstagramAgent();
