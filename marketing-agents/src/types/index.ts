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

// ─── Media generation types ───────────────────────────────────────────────────

export type ImageAspectRatio =
  | 'SQUARE'      // 1:1  — feed Instagram / LinkedIn
  | 'PORTRAIT'    // 9:16 — Stories / Reels
  | 'LANDSCAPE';  // 16:9 — YouTube thumbnail / Google Display

export type ImageStyle =
  | 'PHOTOREALISTIC'   // foto realista de pessoas
  | 'ILLUSTRATION'     // ilustração vetorial / flat design
  | 'MINIMALIST';      // fundo sólido + tipografia

export interface ImageRequest {
  prompt: string;             // prompt detalhado para a IA
  negativePrompt?: string;    // o que evitar na imagem
  aspectRatio: ImageAspectRatio;
  style: ImageStyle;
  brand: Brand;
  platform: Platform | 'INSTAGRAM' | 'LINKEDIN';
}

export interface GeneratedImage {
  url: string;                // URL pública da imagem gerada
  provider: 'IDEOGRAM' | 'DALLE3' | 'SIMULATION';
  prompt: string;
  aspectRatio: ImageAspectRatio;
  generatedAt: string;
  costUSD?: number;
}

export type VideoFormat =
  | 'REEL_VERTICAL'   // 9:16 — Instagram Reels / TikTok
  | 'FEED_SQUARE'     // 1:1  — feed Instagram
  | 'YOUTUBE';        // 16:9 — YouTube

export type VideoProvider = 'HEYGEN' | 'RUNWAY' | 'SIMULATION';

export interface VideoRequest {
  script: string;             // texto que será narrado/animado
  format: VideoFormat;
  provider: VideoProvider;
  avatarId?: string;          // ID do avatar HeyGen (ex: Dr. Werciley)
  voiceId?: string;           // ID da voz HeyGen
  brand: Brand;
  durationSeconds?: number;
}

export interface VideoJob {
  jobId: string;
  provider: VideoProvider;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  videoUrl?: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  submittedAt: string;
  completedAt?: string;
  costUSD?: number;
}

export interface MediaBundle {
  content: GeneratedContent;
  image?: GeneratedImage;
  video?: VideoJob;
  imagePrompt?: string;       // prompt usado para gerar a imagem
}

// ─── Optimizer types ──────────────────────────────────────────────────────────

export type ProductLine = 'facilita_prep' | 'iaso_clinica';

export type OptimizerActionType =
  | 'MAINTAIN'      // CPA dentro do range ideal — manter
  | 'SCALE_UP'      // CPA excelente — aumentar orçamento
  | 'SCALE_DOWN'    // CPA elevado — reduzir orçamento
  | 'NEW_CREATIVE'  // CTR baixo — gerar novo conteúdo
  | 'PAUSE'         // CPA inaceitável — pausar campanha
  | 'REALLOCATE';   // Mover verba para canal mais eficiente

export type DecisionUrgency = 'INFO' | 'WARNING' | 'CRITICAL';

export interface ChannelPerformance {
  platform: 'META' | 'GOOGLE' | 'LINKEDIN';
  campaignId: string;
  campaignName: string;
  spend: number;
  leads: number;
  patients: number;         // leads × taxa de conversão lead→paciente
  cpa: number;              // custo por paciente captado
  cpl: number;              // custo por lead
  ctr: number;
  cpc: number;
  dailyBudget: number;
  impressions: number;
  clicks: number;
  leadToPatientRate: number; // taxa de conversão lead → paciente
}

export interface OptimizerDecision {
  platform: string;
  campaignId: string;
  campaignName: string;
  action: OptimizerActionType;
  reason: string;
  budgetDeltaPct?: number;  // ex: +20 ou -30 (percentual)
  currentCPA: number;
  hardThreshold: number;    // limite absoluto (ex: R$100)
  ltvThreshold: number;     // limite LTV-ajustado (ex: R$322)
  urgency: DecisionUrgency;
  executedAt: string;
}

export interface ReallocationPlan {
  fromPlatform: string;
  toPlatform: string;
  amountBRL: number;
  reason: string;
}

export interface LTVProfile {
  productLine: ProductLine;
  avgConsultationFee: number;
  consultationsPerYear: number;
  avgRetentionYears: number;
  grossMargin: number;
  ltv: number;
  maxAcceptableCPA: number;  // LTV × 33%
  conservativeCPA: number;   // LTV × 10% (CPA "excelente")
  aggressiveCPA: number;     // LTV × 50% (CPA "máximo arriscado")
}

export interface OptimizerReport {
  analyzedAt: string;
  periodDays: number;
  totalSpend: number;
  totalLeads: number;
  totalPatients: number;
  blendedCPA: number;
  blendedCPL: number;
  channels: ChannelPerformance[];
  decisions: OptimizerDecision[];
  reallocations: ReallocationPlan[];
  projectedMonthlySavings: number;
  projectedMonthlyPatientGain: number;
  roiAtHardValue: number;    // ROI considerando R$100/paciente
  roiAtLTV: number;          // ROI considerando LTV real
}
