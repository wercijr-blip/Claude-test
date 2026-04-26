import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import logger from '../utils/logger';
import { withRetry } from '../utils/scheduler';
import { SYSTEM_PROMPT, USER_PROMPTS } from '../config/prompts';
import type { ContentRequest, GeneratedContent, Platform, ImageAspectRatio, ImageStyle } from '../types';

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const InstagramFeedSchema = z.object({
  caption: z.string(),
  hashtags: z.array(z.string()),
  firstLine: z.string(),
});

const InstagramReelSchema = z.object({
  versions: z.array(
    z.object({
      headline: z.string(),
      body: z.string(),
      cta: z.string(),
      hashtags: z.array(z.string()),
    }),
  ),
});

const GoogleAdsSchema = z.object({
  headlines: z.array(z.string()),
  descriptions: z.array(z.string()),
  displayUrl: z.string(),
});

const LinkedInSchema = z.object({
  hook: z.string(),
  body: z.string(),
  cta: z.string(),
  hashtags: z.array(z.string()),
});

const YoutubeSchema = z.object({
  segments: z.array(
    z.object({
      timeStart: z.string(),
      timeEnd: z.string(),
      text: z.string(),
      direction: z.string(),
    }),
  ),
  caption: z.string(),
});

// ─── Mock data for simulation mode ───────────────────────────────────────────

const MOCK_CONTENT: Record<Platform, Partial<GeneratedContent>> = {
  INSTAGRAM_FEED: {
    caption:
      'Sua saúde sexual importa 💙 A PrEP reduz em até 99% o risco de infecção pelo HIV. Disponível pelo SUS ou na Facilita PrEP — consulta online com infectologista em minutos.',
    firstLine: 'Proteja-se com a PrEP 💙',
    hashtags: [
      'PrEP', 'PrevenãoHIV', 'SaúdeSexual', 'LGBT', 'FacilitaPrEP',
      'Telemedicina', 'SaúdePública', 'HIV', 'SUS', 'Infectologia',
    ],
  },
  INSTAGRAM_REEL: {
    versions: [
      {
        headline: 'Você conhece a PrEP?',
        body: 'Remédio que previne o HIV em até 99%. Pelo SUS ou online — rápido, seguro e sem julgamentos.',
        cta: 'Saiba mais no link da bio',
        hashtags: ['PrEP', 'HIV', 'SaúdeSexual', 'LGBT', 'FacilitaPrEP'],
      },
      {
        headline: 'PrEP: prevenção que funciona',
        body: 'Consulta com infectologista online. Receita em até 24h. Comece sua proteção hoje.',
        cta: 'Agende sua consulta',
        hashtags: ['PrEP', 'Telemedicina', 'Infectologia', 'SaúdeSexual', 'PrevenãoHIV'],
      },
      {
        headline: 'Não espere para se proteger',
        body: 'A PrEP é gratuita no SUS. Nós facilitamos o acesso com consulta online rápida e acolhedora.',
        cta: 'Clique no link e saiba como',
        hashtags: ['PrEP', 'SUS', 'SaúdeLGBT', 'HIV', 'FacilitaPrEP'],
      },
    ],
  },
  GOOGLE_ADS: {
    headlines: [
      'PrEP Online – Consulta Rápida', 'Previna o HIV com PrEP',
      'Infectologista Online 24h', 'PrEP pelo SUS ou Online', 'Facilita PrEP – Agende Já',
    ],
    descriptions: [
      'Consulta com infectologista online. Receita em 24h. Prevenção do HIV acessível e sem julgamentos.',
      'A PrEP reduz em até 99% o risco de HIV. Atendimento humanizado e rápido. Agende agora.',
      'Telemedicina para PrEP no Brasil. Médico especialista, privacidade e agilidade garantidas.',
    ],
    displayUrl: 'facilitaprep.com.br/prep',
  },
  LINKEDIN_POST: {
    hook: 'A PrEP salva vidas — e ainda é subutilizada no Brasil.',
    body: 'Como infectologista, vejo diariamente o impacto transformador da Profilaxia Pré-Exposição (PrEP) na vida de meus pacientes. Estudos mostram que a PrEP reduz o risco de infecção pelo HIV em até 99% quando usada corretamente. Apesar disso, estima-se que apenas 15% das pessoas elegíveis no Brasil têm acesso ao tratamento. Barreiras como estigma, falta de informação e dificuldade de acesso aos serviços de saúde ainda impedem que milhares de brasileiros se beneficiem dessa ferramenta. Na Clínica IASO e pela plataforma Facilita PrEP, trabalhamos para democratizar esse acesso, com atendimento humanizado, especializado e sem julgamentos.',
    cta: 'Marque um colega que trabalha na área de saúde sexual. Vamos ampliar essa conversa.',
    hashtags: ['Infectologia', 'PrEP', 'SaúdeSexual', 'HIV'],
  },
  YOUTUBE_SCRIPT: {
    segments: [
      { timeStart: '0s', timeEnd: '5s', text: 'Você sabia que existe um remédio que previne o HIV?', direction: 'Close no rosto, expressão curiosa, fundo colorido' },
      { timeStart: '5s', timeEnd: '30s', text: 'Chama-se PrEP — Profilaxia Pré-Exposição. Tomada todos os dias, ela reduz em até 99% o risco de contrair o HIV. Está disponível gratuitamente no SUS ou pela Facilita PrEP, com consulta online e sem julgamentos.', direction: 'Infográfico animado mostrando comprimido e escudo protetor' },
      { timeStart: '30s', timeEnd: '45s', text: 'Qualquer pessoa com risco aumentado de exposição ao HIV pode usar a PrEP. O infectologista vai avaliar seu caso e emitir a receita — tudo online, no conforto da sua casa.', direction: 'Tela dividida: médico no computador / paciente em casa sorrindo' },
      { timeStart: '45s', timeEnd: '60s', text: 'Não espere. Proteja-se hoje. Acesse facilitaprep.com.br e agende sua consulta.', direction: 'Logo Facilita PrEP, URL grande, música animada' },
    ],
    caption: 'PrEP: prevenção do HIV disponível pelo SUS e online | Facilita PrEP',
  },
};

// ─── Mock image prompts ───────────────────────────────────────────────────────

const MOCK_IMAGE_PROMPTS: Record<string, string> = {
  facilita_prep_PORTRAIT:
    'Close-up portrait of a confident young trans Brazilian woman, smiling directly at camera, holding a small white pill bottle with a heart on it. Warm studio lighting, colorful bokeh background in pride colors. Photorealistic, editorial style. No text.',
  facilita_prep_SQUARE:
    'A young Brazilian gay couple in their late 20s smiling confidently at a smartphone screen showing a telemedicine consultation. Modern apartment, warm natural light, diverse skin tones. Clean and empowering aesthetic. Soft blue and white color palette. No text.',
  facilita_prep_LANDSCAPE:
    'Split scene: a young diverse Brazilian person on a video call with a doctor on screen. Home environment on left, doctor office on right. Modern, warm colors. Empowering and accessible healthcare mood. No text.',
  iaso_clinica_PORTRAIT:
    'Professional Brazilian male doctor in his 40s, dark skin, white coat, in a modern clinic office in Brasília. Warm lighting, bookshelves with medical books, laptop open. Approachable and trustworthy expression. Vertical composition.',
  iaso_clinica_SQUARE:
    'Overhead view of a modern medical office desk with a stethoscope, laptop showing charts, coffee cup, and small Brazilian flag. Clean minimal aesthetic, neutral tones. Professional healthcare branding.',
  iaso_clinica_LANDSCAPE:
    'Wide shot of a modern medical clinic reception in Brasília with diverse staff and patients. Bright, clean environment. Professional, welcoming, inclusive atmosphere. No text.',
};

// ─── Image prompt generation config ──────────────────────────────────────────

const IMAGE_PROMPT_SYSTEM = `
Você é um diretor de arte especializado em campanhas de saúde sexual inclusiva para o Brasil.
Cria prompts detalhados para geração de imagens por IA (Ideogram / DALL-E 3).

REGRAS:
- Pessoas diversas e representativas do público LGBT+ e saúde no Brasil
- Nunca mostrar nudez, conteúdo sexual explícito ou estigmatizante
- Cores quentes, ambientes acolhedores, linguagem visual empática
- Para saúde: profissionais, ambientes médicos modernos, telemedicina
- Estilo fotorrealista para anúncios de performance; ilustração para awareness
- Responda APENAS com o prompt em inglês (mais preciso para IAs de imagem)
- Máximo 200 palavras no prompt
`.trim();

export interface ImagePromptResult {
  prompt: string;
  negativePrompt: string;
  aspectRatio: ImageAspectRatio;
  style: ImageStyle;
}

// ─── Content Agent ────────────────────────────────────────────────────────────

export class ContentAgent {
  private client: Anthropic | null = null;
  private isSimulation: boolean;

  constructor() {
    this.isSimulation = process.env.SIMULATION_MODE === 'true';
    if (!this.isSimulation && process.env.ANTHROPIC_API_KEY) {
      this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    }
  }

  // ── Text content ─────────────────────────────────────────────────────────────

  async generateContent(request: ContentRequest): Promise<GeneratedContent> {
    if (this.isSimulation || !this.client) {
      return this.simulateGeneration(request);
    }
    return withRetry(() => this.callClaudeAPI(request), 3, 1000);
  }

  private simulateGeneration(request: ContentRequest): GeneratedContent {
    logger.info('[SIMULATION] Gerando conteúdo simulado', {
      platform: request.platform,
      audience: request.audience,
      brand: request.brand,
    });
    const mock = MOCK_CONTENT[request.platform] ?? {};
    const result: GeneratedContent = {
      platform: request.platform,
      brand: request.brand,
      generatedAt: new Date().toISOString(),
      tokensUsed: 0,
      ...mock,
    };
    logger.info('[SIMULATION] Conteúdo gerado com sucesso', {
      platform: request.platform,
      previewKey: result.firstLine ?? result.hook,
    });
    return result;
  }

  private async callClaudeAPI(request: ContentRequest): Promise<GeneratedContent> {
    const promptFn = USER_PROMPTS[request.platform];
    if (!promptFn) throw new Error(`Plataforma não suportada: ${request.platform}`);

    const systemPrompt = request.vaultContext
      ? `${SYSTEM_PROMPT}\n\n# CONTEXTO ESTRATÉGICO DA SEMANA (do vault do proprietário)\n${request.vaultContext}`
      : SYSTEM_PROMPT;

    const response = await this.client!.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: promptFn(request.audience, request.brand) }],
    });

    const rawText = response.content[0].type === 'text' ? response.content[0].text : '';
    const tokensUsed = response.usage.input_tokens + response.usage.output_tokens;
    logger.info('Conteúdo gerado via Claude API', { platform: request.platform, tokensUsed });
    return this.validateAndMap(request, JSON.parse(rawText), tokensUsed);
  }

  private validateAndMap(
    request: ContentRequest,
    data: Record<string, unknown>,
    tokensUsed: number,
  ): GeneratedContent {
    const base: GeneratedContent = {
      platform: request.platform,
      brand: request.brand,
      generatedAt: new Date().toISOString(),
      tokensUsed,
    };
    switch (request.platform) {
      case 'INSTAGRAM_FEED':  return { ...base, ...InstagramFeedSchema.parse(data) };
      case 'INSTAGRAM_REEL':  return { ...base, ...InstagramReelSchema.parse(data) };
      case 'GOOGLE_ADS':      return { ...base, ...GoogleAdsSchema.parse(data) };
      case 'LINKEDIN_POST':   return { ...base, ...LinkedInSchema.parse(data) };
      case 'YOUTUBE_SCRIPT':  return { ...base, ...YoutubeSchema.parse(data) };
      default: throw new Error(`Plataforma desconhecida: ${request.platform}`);
    }
  }

  // ── Image prompt ──────────────────────────────────────────────────────────────

  async generateImagePrompt(
    content: GeneratedContent,
    aspectRatio: ImageAspectRatio = 'PORTRAIT',
  ): Promise<ImagePromptResult> {
    const negativePrompt =
      'text, watermark, logo, nudity, explicit content, stigma, needle, blood, ugly, deformed, extra limbs';

    if (this.isSimulation || !this.client) {
      const key = `${content.brand}_${aspectRatio}`;
      const prompt = MOCK_IMAGE_PROMPTS[key] ?? MOCK_IMAGE_PROMPTS['facilita_prep_PORTRAIT'];
      logger.info('[SIMULATION] Image prompt gerado', { brand: content.brand, aspectRatio, chars: prompt.length });
      return { prompt, negativePrompt, aspectRatio, style: 'PHOTOREALISTIC' };
    }

    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      system: IMAGE_PROMPT_SYSTEM,
      messages: [{
        role: 'user',
        content: `Crie um prompt de imagem para IA.\nMarca: ${content.brand}\nPlataforma: ${content.platform}\nGancho: ${content.firstLine ?? content.hook ?? ''}\nCorpo: ${(content.body ?? content.caption ?? '').slice(0, 200)}\nProporção: ${aspectRatio}\n\nRetorne APENAS o prompt em inglês.`,
      }],
    });

    const prompt = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    logger.info('Image prompt gerado via Claude', { brand: content.brand, chars: prompt.length });
    return { prompt, negativePrompt, aspectRatio, style: 'PHOTOREALISTIC' };
  }
}

export const contentAgent = new ContentAgent();
