export type Platform =
  | 'INSTAGRAM_FEED'
  | 'INSTAGRAM_REEL'
  | 'GOOGLE_ADS'
  | 'LINKEDIN_POST'
  | 'YOUTUBE_SCRIPT';

export type Brand = 'facilita_prep' | 'iaso_clinica';

export interface ContentRequest {
  platform: Platform;
  audience: string;
  contentType?: string;
  brand: Brand;
}

export interface InstagramVersion {
  headline: string;
  body: string;
  cta: string;
  hashtags: string[];
}

export interface ScriptSegment {
  timeStart: string;
  timeEnd: string;
  text: string;
  direction: string;
}

export interface GeneratedContent {
  platform: Platform;
  brand: Brand;
  // Instagram Feed
  caption?: string;
  firstLine?: string;
  // Instagram Reel (multiple versions)
  versions?: InstagramVersion[];
  // Google Ads
  headlines?: string[];
  descriptions?: string[];
  displayUrl?: string;
  // LinkedIn
  hook?: string;
  body?: string;
  cta?: string;
  // YouTube
  segments?: ScriptSegment[];
  hashtags?: string[];
  // metadata
  generatedAt: string;
  tokensUsed?: number;
}

export interface AdCampaign {
  id: string;
  name: string;
  platform: 'META' | 'GOOGLE' | 'LINKEDIN';
  budget: number;
  status: 'ACTIVE' | 'PAUSED' | 'ENDED';
  metrics: AdMetrics;
}

export interface AdMetrics {
  impressions: number;
  clicks: number;
  spend: number;
  leads: number;
  cpc: number;
  cpm: number;
  ctr: number;
  reach?: number;
}

export interface PostResult {
  platform: Platform | 'INSTAGRAM' | 'LINKEDIN';
  success: boolean;
  postId?: string;
  error?: string;
  simulatedAt?: string;
}

export interface DailyReport {
  date: string;
  campaigns: AdCampaign[];
  posts: PostResult[];
  totalSpend: number;
  totalReach: number;
  totalLeads: number;
  costPerLead: number;
  byPlatform: Record<string, PlatformSummary>;
}

export interface PlatformSummary {
  spend: number;
  reach: number;
  leads: number;
  clicks: number;
  cpl: number;
}

export interface CampaignConfig {
  name: string;
  objective: 'TRAFFIC' | 'LEAD_GENERATION' | 'BRAND_AWARENESS';
  dailyBudget: number;
  targeting: Record<string, unknown>;
  startTime: string;
  destinationUrl: string;
  content: GeneratedContent;
}

export interface GoogleCampaignConfig {
  name: string;
  budgetBRL: number;
  keywords?: string[];
  content?: GeneratedContent;
}

export interface LinkedInAdConfig {
  name: string;
  dailyBudget: number;
  content: GeneratedContent;
}

export interface GoogleMetrics {
  campaignName: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  ctr: number;
  averageCpc: number;
}

export interface LinkedInMetrics {
  impressions: number;
  clicks: number;
  costInLocalCurrency: number;
  leads: number;
}

export interface OptimizationAction {
  campaignId: string;
  platform: string;
  action: 'PAUSE' | 'REDUCE_BIDS' | 'NEW_CREATIVE' | 'CHANGE_AUDIENCE';
  reason: string;
  executedAt: string;
}
