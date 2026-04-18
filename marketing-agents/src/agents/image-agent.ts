import axios from 'axios';
import logger from '../utils/logger';
import { withRetry } from '../utils/scheduler';
import type { ImageRequest, GeneratedImage, ImageAspectRatio } from '../types';

// ─── Aspect ratio maps ────────────────────────────────────────────────────────

const IDEOGRAM_ASPECT: Record<ImageAspectRatio, string> = {
  SQUARE:    'ASPECT_1_1',
  PORTRAIT:  'ASPECT_9_16',
  LANDSCAPE: 'ASPECT_16_9',
};

const DALLE_SIZE: Record<ImageAspectRatio, string> = {
  SQUARE:    '1024x1024',
  PORTRAIT:  '1024x1792',
  LANDSCAPE: '1792x1024',
};

// USD cost per image per provider
const COST_USD: Record<string, number> = {
  IDEOGRAM: 0.08,
  DALLE3:   0.04,
};

// ─── Simulation helpers ───────────────────────────────────────────────────────

// Uses picsum.photos as placeholder — deterministic by seed so same content = same image
function mockImageUrl(aspectRatio: ImageAspectRatio): string {
  const seed = Math.floor(Math.random() * 900) + 100;
  const dims: Record<ImageAspectRatio, string> = {
    SQUARE: '1024/1024', PORTRAIT: '608/1080', LANDSCAPE: '1920/1080',
  };
  return `https://picsum.photos/seed/${seed}/${dims[aspectRatio]}`;
}

// ─── Image Agent ──────────────────────────────────────────────────────────────

export class ImageAgent {
  private isSimulation: boolean;
  private ideogramKey: string;
  private openaiKey: string;

  constructor() {
    this.isSimulation = process.env.SIMULATION_MODE === 'true';
    this.ideogramKey = process.env.IDEOGRAM_API_KEY ?? '';
    this.openaiKey = process.env.OPENAI_API_KEY ?? '';
  }

  // ── Main entry point — tries Ideogram, falls back to DALL-E 3 ───────────────

  async generateImage(request: ImageRequest): Promise<GeneratedImage> {
    if (this.isSimulation) {
      return this.simulateGeneration(request);
    }

    if (this.ideogramKey) {
      return withRetry(() => this.callIdeogram(request), 3, 2000);
    }

    if (this.openaiKey) {
      logger.warn('IDEOGRAM_API_KEY não encontrada — usando DALL-E 3 como fallback');
      return withRetry(() => this.callDallE3(request), 3, 2000);
    }

    logger.warn('Nenhuma API de imagem configurada — usando simulação');
    return this.simulateGeneration(request);
  }

  // ── Ideogram v2 ──────────────────────────────────────────────────────────────

  private async callIdeogram(request: ImageRequest): Promise<GeneratedImage> {
    logger.info('Gerando imagem via Ideogram', {
      aspectRatio: request.aspectRatio,
      brand: request.brand,
      promptPreview: request.prompt.slice(0, 80),
    });

    const res = await axios.post(
      'https://api.ideogram.ai/generate',
      {
        image_request: {
          prompt: request.prompt,
          negative_prompt: request.negativePrompt,
          aspect_ratio: IDEOGRAM_ASPECT[request.aspectRatio],
          model: 'V_2',
          magic_prompt_option: 'AUTO',
          style_type: request.style === 'ILLUSTRATION' ? 'DESIGN' : 'REALISTIC',
        },
      },
      {
        headers: {
          'Api-Key': this.ideogramKey,
          'Content-Type': 'application/json',
        },
      },
    );

    const imageData = res.data?.data?.[0];
    if (!imageData?.url) throw new Error('Ideogram não retornou URL de imagem');

    logger.info('Imagem gerada via Ideogram', { url: imageData.url.slice(0, 60) });

    return {
      url: imageData.url,
      provider: 'IDEOGRAM',
      prompt: request.prompt,
      aspectRatio: request.aspectRatio,
      generatedAt: new Date().toISOString(),
      costUSD: COST_USD.IDEOGRAM,
    };
  }

  // ── DALL-E 3 (fallback) ───────────────────────────────────────────────────────

  private async callDallE3(request: ImageRequest): Promise<GeneratedImage> {
    logger.info('Gerando imagem via DALL-E 3', {
      aspectRatio: request.aspectRatio,
      brand: request.brand,
    });

    const res = await axios.post(
      'https://api.openai.com/v1/images/generations',
      {
        model: 'dall-e-3',
        prompt: request.prompt,
        n: 1,
        size: DALLE_SIZE[request.aspectRatio],
        quality: 'standard',
        response_format: 'url',
      },
      {
        headers: {
          Authorization: `Bearer ${this.openaiKey}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const url: string = res.data?.data?.[0]?.url;
    if (!url) throw new Error('DALL-E 3 não retornou URL de imagem');

    logger.info('Imagem gerada via DALL-E 3', { url: url.slice(0, 60) });

    return {
      url,
      provider: 'DALLE3',
      prompt: request.prompt,
      aspectRatio: request.aspectRatio,
      generatedAt: new Date().toISOString(),
      costUSD: COST_USD.DALLE3,
    };
  }

  // ── Simulation ────────────────────────────────────────────────────────────────

  private simulateGeneration(request: ImageRequest): GeneratedImage {
    const url = mockImageUrl(request.aspectRatio);
    logger.info('[SIMULATION] Imagem gerada', {
      provider: 'SIMULATION',
      aspectRatio: request.aspectRatio,
      brand: request.brand,
      url,
    });
    return {
      url,
      provider: 'SIMULATION',
      prompt: request.prompt,
      aspectRatio: request.aspectRatio,
      generatedAt: new Date().toISOString(),
      costUSD: 0,
    };
  }

  // ── Convenience helpers ───────────────────────────────────────────────────────

  async generateForInstagramFeed(prompt: string, negativePrompt: string, brand: 'facilita_prep' | 'iaso_clinica'): Promise<GeneratedImage> {
    return this.generateImage({ prompt, negativePrompt, aspectRatio: 'SQUARE', style: 'PHOTOREALISTIC', brand, platform: 'INSTAGRAM_FEED' });
  }

  async generateForReel(prompt: string, negativePrompt: string, brand: 'facilita_prep' | 'iaso_clinica'): Promise<GeneratedImage> {
    return this.generateImage({ prompt, negativePrompt, aspectRatio: 'PORTRAIT', style: 'PHOTOREALISTIC', brand, platform: 'INSTAGRAM_REEL' });
  }

  async generateForLinkedIn(prompt: string, negativePrompt: string): Promise<GeneratedImage> {
    return this.generateImage({ prompt, negativePrompt, aspectRatio: 'LANDSCAPE', style: 'PHOTOREALISTIC', brand: 'iaso_clinica', platform: 'LINKEDIN_POST' });
  }
}

export const imageAgent = new ImageAgent();
