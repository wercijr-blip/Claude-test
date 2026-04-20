import fs from 'fs';
import path from 'path';
import logger from '../utils/logger';
import type { ContentJob, JobStatus, Brand, ComplianceResult } from '../types';

const STATE_FILE   = path.join(process.cwd(), 'logs', 'approval-queue.json');
const PAUSE_FILE   = path.join(process.cwd(), 'logs', 'publish-paused.json');
const REVIEW_TTL   = 30 * 60 * 1000; // 30 minutos para aprovar antes de publicar automaticamente

interface ApprovalState {
  jobs: ContentJob[];
}

interface PublishFn {
  (job: ContentJob): Promise<string | undefined>; // retorna postId
}

// ─── ApprovalAgent ────────────────────────────────────────────────────────────

export class ApprovalAgent {
  private state: ApprovalState = { jobs: [] };
  private publishers: Map<string, PublishFn> = new Map();

  constructor() { this.loadState(); }

  // ── State ──────────────────────────────────────────────────────────────────

  private loadState() {
    try {
      if (fs.existsSync(STATE_FILE))
        this.state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    } catch { /* fresh start */ }
  }

  private saveState() {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(this.state, null, 2));
  }

  private genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  // ── Global pause ───────────────────────────────────────────────────────────

  isPaused(): boolean {
    try {
      if (!fs.existsSync(PAUSE_FILE)) return false;
      return JSON.parse(fs.readFileSync(PAUSE_FILE, 'utf-8')).paused === true;
    } catch { return false; }
  }

  setPause(paused: boolean) {
    fs.mkdirSync(path.dirname(PAUSE_FILE), { recursive: true });
    fs.writeFileSync(PAUSE_FILE, JSON.stringify({ paused, updatedAt: new Date().toISOString() }));
    logger.info(`[ApprovalAgent] Publicações ${paused ? '⏸ PAUSADAS' : '▶ RETOMADAS'}`);
  }

  // ── Register publisher per platform ───────────────────────────────────────

  registerPublisher(platform: string, fn: PublishFn) {
    this.publishers.set(platform, fn);
  }

  // ── Schedule content ──────────────────────────────────────────────────────

  schedule(params: {
    brand: Brand;
    platform: string;
    label: string;
    preview: string;
    imageUrl?: string;
    videoUrl?: string;
    compliance?: ComplianceResult;
    delayMinutes?: number;
    publishFn: PublishFn;
  }): ContentJob {
    const { delayMinutes = 5, publishFn, ...rest } = params;
    const scheduledFor = new Date(Date.now() + delayMinutes * 60_000).toISOString();

    const job: ContentJob = {
      id: this.genId(),
      ...rest,
      status: 'SCHEDULED',
      scheduledFor,
      regenerationCount: 0,
      createdAt: new Date().toISOString(),
    };

    this.publishers.set(job.id, publishFn);
    this.state.jobs.push(job);
    this.saveState();
    logger.info(`[ApprovalAgent] Agendado: ${job.label} → auto-publica em ${delayMinutes} min (${job.id})`);
    return job;
  }

  // ── Request preview (owner asks to review first) ───────────────────────────

  requestPreview(jobId: string): ContentJob | null {
    const job = this.state.jobs.find(j => j.id === jobId);
    if (!job || !['SCHEDULED'].includes(job.status)) return null;
    job.status        = 'PENDING_REVIEW';
    job.reviewDeadline = new Date(Date.now() + REVIEW_TTL).toISOString();
    this.saveState();
    logger.info(`[ApprovalAgent] Preview solicitado: ${job.label} — prazo 30 min (${jobId})`);
    return job;
  }

  // ── Approve ────────────────────────────────────────────────────────────────

  async approve(jobId: string): Promise<ContentJob | null> {
    const job = this.state.jobs.find(j => j.id === jobId);
    if (!job || !['SCHEDULED','PENDING_REVIEW'].includes(job.status)) return null;
    job.status = 'APPROVED';
    this.saveState();
    await this.publish(job);
    return job;
  }

  // ── Reject with suggestions ────────────────────────────────────────────────

  reject(jobId: string, suggestions: string): ContentJob | null {
    const job = this.state.jobs.find(j => j.id === jobId);
    if (!job || !['SCHEDULED','PENDING_REVIEW','APPROVED'].includes(job.status)) return null;
    job.status                = 'REJECTED';
    job.rejectionSuggestions  = suggestions;
    job.regenerationCount++;
    this.saveState();
    logger.info(`[ApprovalAgent] Reprovado: ${job.label} — sugestão: "${suggestions}" (${jobId})`);
    return job;
  }

  // ── Request removal of published post ─────────────────────────────────────

  async requestRemoval(jobId: string): Promise<ContentJob | null> {
    const job = this.state.jobs.find(j => j.id === jobId);
    if (!job || job.status !== 'PUBLISHED') return null;

    const SIM = process.env.SIMULATION_MODE === 'true';
    if (SIM) {
      logger.info(`[ApprovalAgent][SIM] Post retirado: ${job.label} (postId: ${job.publishedPostId})`);
    } else {
      logger.warn(`[ApprovalAgent] Retirada solicitada para ${job.label} — postId: ${job.publishedPostId} — remover manualmente na plataforma se a API não suportar`);
      // Instagram delete: DELETE /media/{media-id} (não suportado para posts publicados pela Graph API básica)
      // LinkedIn delete: DELETE /ugcPosts/{id} (suportado)
    }

    job.status = 'REMOVED';
    this.saveState();
    logger.info(`[ApprovalAgent] Retirada registrada: ${job.label}`);
    return job;
  }

  // ── Internal publish ───────────────────────────────────────────────────────

  private async publish(job: ContentJob) {
    const fn = this.publishers.get(job.id);
    if (!fn) {
      logger.warn(`[ApprovalAgent] Sem publisher para job ${job.id}`);
      job.status = 'FAILED';
      this.saveState();
      return;
    }
    try {
      logger.info(`[ApprovalAgent] Publicando: ${job.label}`);
      const postId = await fn(job);
      job.status          = 'PUBLISHED';
      job.publishedAt     = new Date().toISOString();
      job.publishedPostId = postId;
      this.saveState();
      logger.info(`[ApprovalAgent] ✅ Publicado: ${job.label} (postId: ${postId ?? 'n/a'})`);
    } catch (err: unknown) {
      job.status = 'FAILED';
      this.saveState();
      logger.error(`[ApprovalAgent] ❌ Falha ao publicar ${job.label}:`, err);
    }
  }

  // ── Process queue (run every minute via cron) ──────────────────────────────

  async processQueue(): Promise<void> {
    const now     = Date.now();
    const paused  = this.isPaused();
    let changed   = false;

    for (const job of this.state.jobs) {
      // Auto-publish SCHEDULED jobs past their time (unless globally paused)
      if (job.status === 'SCHEDULED' && !paused && new Date(job.scheduledFor).getTime() <= now) {
        await this.publish(job);
        changed = true;
        continue;
      }

      // PENDING_REVIEW expired → auto-publish
      if (job.status === 'PENDING_REVIEW' && job.reviewDeadline && new Date(job.reviewDeadline).getTime() <= now) {
        logger.info(`[ApprovalAgent] Prazo expirado — publicando automaticamente: ${job.label}`);
        job.status = 'APPROVED';
        await this.publish(job);
        changed = true;
      }
    }

    if (changed) this.saveState();
  }

  // ── Getters ────────────────────────────────────────────────────────────────

  getQueue(): ContentJob[] { return this.state.jobs; }

  getPending(): ContentJob[] {
    return this.state.jobs.filter(j => ['SCHEDULED','PENDING_REVIEW','REJECTED'].includes(j.status));
  }

  getJob(id: string): ContentJob | undefined {
    return this.state.jobs.find(j => j.id === id);
  }
}

export const approvalAgent = new ApprovalAgent();
