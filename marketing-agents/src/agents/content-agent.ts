import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import logger from '../utils/logger';
import { withRetry } from '../utils/scheduler';
import { SYSTEM_PROMPT, USER_PROMPTS } from '../config/prompts';
import type { ContentRequest, GeneratedContent, Platform } from '../types';

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

// ─── Mock data for simulation mode ──────────────────────────────────────────

const MOCK_CONTENT: Record<Platform, Partial<GeneratedContent>> = {
  INSTAGRAM_FEED: {
    caption:
      'Sua saúde sexual importa 💙 A PrEP reduz em até 99% o risco de infecção pelo HIV. Disponível pelo SUS ou na Facilita PrEP — consulta online com infectologista em minutos.',
    firstLine: 'Proteja-se com a PrEP 💙',
    hashtags: [
      'PrEP',
      'PrevenãoHIV',
      'SaúdeSexual',
      'LGBT',
      'FacilitaPrEP',
      'Telemedicina',
      'SaúdePública',
      'HIV',
      'SUS',
      'Infectologia',
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
      'PrEP Online – Consulta Rápida',
      'Previna o HIV com PrEP',
      'Infectologista Online 24h',
      'PrEP pelo SUS ou Online',
      'Facilita PrEP – Agende Já',
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
    body: 'Como infectologista, vejo diariamente o impacto transformador da Profilaxia Pré-Exposição (PrEP) na vida de meus pacientes. Estudos mostram que a PrEP reduz o risco de infecção pelo HIV em até 99% quando usada corretamente. Apesar disso, estima-se que apenas 15% das pessoas elegíveis no Brasil têm acesso ao tratamento. Barreiras como estigma, falta de informação e dificuldade de acesso aos serviços de saúde ainda impedem que milhares de brasileiros se beneficiem dessa ferramenta. Na Clínica IASO e pela plataforma Facilita PrEP, trabalhamos para democratizar esse acesso, com atendimento humanizado, especializado e sem julgamentos. Precisamos falar mais sobre prevenção combinada do HIV.',
    cta: 'Marque um colega que trabalha na área de saúde sexual. Vamos ampliar essa conversa.',
    hashtags: ['Infectologia', 'PrEP', 'SaúdeSexual', 'HIV'],
  },
  YOUTUBE_SCRIPT: {
    segments: [
      {
        timeStart: '0s',
        timeEnd: '5s',
        text: 'Você sabia que existe um remédio que previne o HIV?',
        direction: 'Close no rosto, expressão curiosa, fundo colorido',
      },
      {
        timeStart: '5s',
        timeEnd: '30s',
        text: 'Chama-se PrEP — Profilaxia Pré-Exposição. Tomada todos os dias, ela reduz em até 99% o risco de contrair o HIV. Está disponível gratuitamente no SUS ou pela Facilita PrEP, com consulta online e sem julgamentos.',
        direction: 'Infográfico animado mostrando comprimido e escudo protetor',
      },
      {
        timeStart: '30s',
        timeEnd: '45s',
        text: 'Qualquer pessoa com risco aumentado de exposição ao HIV pode usar a PrEP. O infectologista vai avaliar seu caso e emitir a receita — tudo online, no conforto da sua casa.',
        direction: 'Tela dividida: médico no computador / paciente em casa sorrindo',
      },
      {
        timeStart: '45s',
        timeEnd: '60s',
        text: 'Não espere. Proteja-se hoje. Acesse facilitaprep.com.br e agende sua consulta.',
        direction: 'Logo Facilita PrEP, URL grande, música animada',
      },
    ],
    caption: 'PrEP: prevenção do HIV disponível pelo SUS e online | Facilita PrEP',
  },
};

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
      tokensUsed: 0, // simulation
      ...mock,
    };

    logger.info('[SIMULATION] Conteúdo gerado com sucesso', {
      platform: request.platform,
      previewKey: request.platform === 'INSTAGRAM_FEED' ? result.firstLine : result.hook,
    });

    return result;
  }

  private async callClaudeAPI(request: ContentRequest): Promise<GeneratedContent> {
    const promptFn = USER_PROMPTS[request.platform];
    if (!promptFn) {
      throw new Error(`Plataforma não suportada: ${request.platform}`);
    }

    const userPrompt = promptFn(request.audience, request.brand);

    const response = await this.client!.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const rawText = response.content[0].type === 'text' ? response.content[0].text : '';
    const parsed = JSON.parse(rawText);
    const tokensUsed = response.usage.input_tokens + response.usage.output_tokens;

    logger.info('Conteúdo gerado via Claude API', {
      platform: request.platform,
      audience: request.audience,
      brand: request.brand,
      tokensUsed,
    });

    const validated = this.validateAndMap(request, parsed, tokensUsed);
    return validated;
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
      case 'INSTAGRAM_FEED': {
        const v = InstagramFeedSchema.parse(data);
        return { ...base, ...v };
      }
      case 'INSTAGRAM_REEL': {
        const v = InstagramReelSchema.parse(data);
        return { ...base, ...v };
      }
      case 'GOOGLE_ADS': {
        const v = GoogleAdsSchema.parse(data);
        return { ...base, ...v };
      }
      case 'LINKEDIN_POST': {
        const v = LinkedInSchema.parse(data);
        return { ...base, ...v };
      }
      case 'YOUTUBE_SCRIPT': {
        const v = YoutubeSchema.parse(data);
        return { ...base, ...v };
      }
      default:
        throw new Error(`Plataforma desconhecida: ${request.platform}`);
    }
  }
}

export const contentAgent = new ContentAgent();
