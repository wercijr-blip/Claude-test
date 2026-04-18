import axios from 'axios';
import logger from '../utils/logger';
import { withRetry } from '../utils/scheduler';
import type { VideoRequest, VideoJob, VideoFormat } from '../types';

// ─── Format dimensions ────────────────────────────────────────────────────────

const HEYGEN_DIMENSIONS: Record<VideoFormat, { width: number; height: number }> = {
  REEL_VERTICAL: { width: 1080, height: 1920 },
  FEED_SQUARE:   { width: 1080, height: 1080 },
  YOUTUBE:       { width: 1920, height: 1080 },
};

const RUNWAY_RATIO: Record<VideoFormat, string> = {
  REEL_VERTICAL: '720:1280',
  FEED_SQUARE:   '1280:1280',
  YOUTUBE:       '1280:768',
};

// USD cost per video minute per provider
const COST_PER_MIN_USD: Record<string, number> = {
  HEYGEN: 0.50,
  RUNWAY: 0.30,
};

// ─── Simulation helpers ───────────────────────────────────────────────────────

function mockJobId(provider: string): string {
  return `SIM_${provider}_VID_${Date.now()}_${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

// ─── Video Agent ──────────────────────────────────────────────────────────────

export class VideoAgent {
  private isSimulation: boolean;
  private heygenKey: string;
  private runwayKey: string;
  private heygenAvatarId: string;
  private heygenVoiceId: string;

  constructor() {
    this.isSimulation = process.env.SIMULATION_MODE === 'true';
    this.heygenKey      = process.env.HEYGEN_API_KEY ?? '';
    this.runwayKey      = process.env.RUNWAY_API_KEY ?? '';
    // ID do avatar e voz do Dr. Werciley configurados no HeyGen
    this.heygenAvatarId = process.env.HEYGEN_AVATAR_ID ?? 'default_avatar';
    this.heygenVoiceId  = process.env.HEYGEN_VOICE_ID  ?? 'pt_BR_male_1';
  }

  // ── Main entry point ─────────────────────────────────────────────────────────

  async generateVideo(request: VideoRequest): Promise<VideoJob> {
    if (this.isSimulation) {
      return this.simulateGeneration(request);
    }

    const provider = request.provider === 'HEYGEN' ? 'HEYGEN'
                   : request.provider === 'RUNWAY'  ? 'RUNWAY'
                   : this.heygenKey                 ? 'HEYGEN' : 'RUNWAY';

    if (provider === 'HEYGEN' && this.heygenKey) {
      return withRetry(() => this.submitHeyGen(request), 3, 3000);
    }

    if (provider === 'RUNWAY' && this.runwayKey) {
      return withRetry(() => this.submitRunway(request), 3, 3000);
    }

    logger.warn('Nenhuma API de vídeo configurada — usando simulação');
    return this.simulateGeneration(request);
  }

  // ── HeyGen — avatar falando o roteiro (ideal para Dr. Werciley) ──────────────

  private async submitHeyGen(request: VideoRequest): Promise<VideoJob> {
    logger.info('Submetendo geração de vídeo ao HeyGen', {
      format: request.format,
      scriptPreview: request.script.slice(0, 80),
      avatarId: request.avatarId ?? this.heygenAvatarId,
    });

    const dim = HEYGEN_DIMENSIONS[request.format];

    const res = await axios.post(
      'https://api.heygen.com/v2/video/generate',
      {
        video_inputs: [{
          character: {
            type: 'avatar',
            avatar_id: request.avatarId ?? this.heygenAvatarId,
            avatar_style: 'normal',
          },
          voice: {
            type: 'text',
            voice_id: request.voiceId ?? this.heygenVoiceId,
            input_text: request.script,
            speed: 1.0,
          },
          background: {
            type: 'color',
            value: request.brand === 'iaso_clinica' ? '#f8f9fa' : '#e8f4ff',
          },
        }],
        dimension: dim,
        title: `${request.brand} — ${request.format} — ${new Date().toISOString().slice(0, 10)}`,
        caption: false,
      },
      {
        headers: {
          'X-Api-Key': this.heygenKey,
          'Content-Type': 'application/json',
        },
      },
    );

    const videoId: string = res.data?.data?.video_id;
    if (!videoId) throw new Error('HeyGen não retornou video_id');

    logger.info('Vídeo HeyGen submetido — processando assincronamente', { videoId });

    return {
      jobId: videoId,
      provider: 'HEYGEN',
      status: 'PROCESSING',
      submittedAt: new Date().toISOString(),
      costUSD: COST_PER_MIN_USD.HEYGEN * ((request.durationSeconds ?? 60) / 60),
    };
  }

  // ── Runway Gen-3 — vídeo criativo/animado ────────────────────────────────────

  private async submitRunway(request: VideoRequest): Promise<VideoJob> {
    logger.info('Submetendo geração de vídeo ao Runway Gen-3', {
      format: request.format,
      scriptPreview: request.script.slice(0, 80),
    });

    const res = await axios.post(
      'https://api.runwayml.com/v1/image_to_video',
      {
        promptText: request.script,
        ratio: RUNWAY_RATIO[request.format],
        duration: Math.min(request.durationSeconds ?? 10, 10), // Runway máx 10s por chamada
        model: 'gen3a_turbo',
      },
      {
        headers: {
          Authorization: `Bearer ${this.runwayKey}`,
          'Content-Type': 'application/json',
          'X-Runway-Version': '2024-11-06',
        },
      },
    );

    const taskId: string = res.data?.id;
    if (!taskId) throw new Error('Runway não retornou task id');

    logger.info('Vídeo Runway submetido — processando assincronamente', { taskId });

    return {
      jobId: taskId,
      provider: 'RUNWAY',
      status: 'PROCESSING',
      submittedAt: new Date().toISOString(),
      costUSD: COST_PER_MIN_USD.RUNWAY * ((request.durationSeconds ?? 10) / 60),
    };
  }

  // ── Poll status until completion (max 10 min) ─────────────────────────────────

  async pollUntilComplete(job: VideoJob, timeoutMs = 600_000): Promise<VideoJob> {
    if (job.status === 'COMPLETED' || job.provider === 'SIMULATION') return job;

    const deadline = Date.now() + timeoutMs;
    const intervalMs = 15_000; // verificar a cada 15s

    logger.info(`Aguardando conclusão do vídeo ${job.provider}:${job.jobId}...`);

    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, intervalMs));

      const updated = await this.checkStatus(job);
      if (updated.status === 'COMPLETED') {
        logger.info(`Vídeo concluído: ${updated.videoUrl}`);
        return updated;
      }
      if (updated.status === 'FAILED') {
        logger.error(`Geração de vídeo falhou: ${job.jobId}`);
        return updated;
      }

      logger.info(`[${job.provider}] Vídeo ainda processando (${job.jobId})`);
    }

    logger.warn(`Timeout aguardando vídeo ${job.jobId} — verifique manualmente`);
    return { ...job, status: 'FAILED' };
  }

  private async checkStatus(job: VideoJob): Promise<VideoJob> {
    try {
      if (job.provider === 'HEYGEN') {
        const res = await axios.get(
          `https://api.heygen.com/v1/video_status.get?video_id=${job.jobId}`,
          { headers: { 'X-Api-Key': this.heygenKey } },
        );
        const data = res.data?.data;
        if (data?.status === 'completed') {
          return { ...job, status: 'COMPLETED', videoUrl: data.video_url, thumbnailUrl: data.thumbnail_url, completedAt: new Date().toISOString() };
        }
        if (data?.status === 'failed') return { ...job, status: 'FAILED' };
      }

      if (job.provider === 'RUNWAY') {
        const res = await axios.get(
          `https://api.runwayml.com/v1/tasks/${job.jobId}`,
          { headers: { Authorization: `Bearer ${this.runwayKey}`, 'X-Runway-Version': '2024-11-06' } },
        );
        const data = res.data;
        if (data?.status === 'SUCCEEDED') {
          return { ...job, status: 'COMPLETED', videoUrl: data.output?.[0], completedAt: new Date().toISOString() };
        }
        if (data?.status === 'FAILED') return { ...job, status: 'FAILED' };
      }
    } catch (err) {
      logger.warn(`Erro ao verificar status do vídeo ${job.jobId}:`, err);
    }
    return job;
  }

  // ── Simulation ─────────────────────────────────────────────────────────────────

  private simulateGeneration(request: VideoRequest): VideoJob {
    const jobId = mockJobId(request.provider === 'SIMULATION' ? 'HEYGEN' : request.provider);
    const duration = request.durationSeconds ?? 60;

    logger.info('[SIMULATION] Vídeo submetido para geração', {
      jobId,
      provider: request.provider,
      format: request.format,
      brand: request.brand,
      durationSeconds: duration,
      scriptPreview: request.script.slice(0, 100),
    });

    // Em simulação, o vídeo fica "completo" imediatamente com URL mock
    const mockVideoUrl = `https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4`;
    const mockThumb = `https://picsum.photos/seed/${Math.floor(Math.random() * 999)}/1080/1920`;

    logger.info('[SIMULATION] Vídeo concluído (mock)', { jobId, videoUrl: mockVideoUrl });

    return {
      jobId,
      provider: 'SIMULATION',
      status: 'COMPLETED',
      videoUrl: mockVideoUrl,
      thumbnailUrl: mockThumb,
      durationSeconds: duration,
      submittedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      costUSD: 0,
    };
  }

  // ── Convenience helpers ─────────────────────────────────────────────────────────

  async generateDrWercileyReel(script: string): Promise<VideoJob> {
    return this.generateVideo({
      script,
      format: 'REEL_VERTICAL',
      provider: 'HEYGEN',
      avatarId: this.heygenAvatarId,
      voiceId: this.heygenVoiceId,
      brand: 'iaso_clinica',
      durationSeconds: 60,
    });
  }

  async generateAnimatedReel(script: string, brand: 'facilita_prep' | 'iaso_clinica'): Promise<VideoJob> {
    return this.generateVideo({
      script,
      format: 'REEL_VERTICAL',
      provider: 'RUNWAY',
      brand,
      durationSeconds: 30,
    });
  }
}

export const videoAgent = new VideoAgent();
