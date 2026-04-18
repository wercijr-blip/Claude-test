import express, { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger';

const DASHBOARD_USER = process.env.DASHBOARD_USER ?? 'admin';
const DASHBOARD_PASS = process.env.DASHBOARD_PASSWORD ?? 'agentes2026';
const PORT           = parseInt(process.env.DASHBOARD_PORT ?? '3001', 10);
const LOG_FILE       = path.join(process.cwd(), 'logs', 'agent.log');
const LOGS_DIR       = path.join(process.cwd(), 'logs');

// ─── Routine status registry ──────────────────────────────────────────────────

export interface RoutineStatus {
  name: string;
  lastRun?: string;
  lastResult?: 'success' | 'error';
  running: boolean;
}

const routines: Record<string, RoutineStatus> = {
  daily:            { name: 'Postagem Diária',         running: false },
  optimization:     { name: 'Otimização Semanal',      running: false },
  monthly:          { name: 'Relatório Mensal',        running: false },
  leads_email:      { name: 'Leads — E-mail Queue',    running: false },
  leads_followup:   { name: 'Leads — Follow-up HOT',  running: false },
  leads_reactivation:{ name: 'Leads — Reativação',    running: false },
};

export function markRoutineStart(key: string)   { if (routines[key]) routines[key].running = true; }
export function markRoutineDone(key: string, ok: boolean) {
  if (!routines[key]) return;
  routines[key].running    = false;
  routines[key].lastRun    = new Date().toISOString();
  routines[key].lastResult = ok ? 'success' : 'error';
}

// ─── Basic auth ───────────────────────────────────────────────────────────────

function basicAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization ?? '';
  if (!auth.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Marketing Agents"');
    return res.status(401).send('Autenticação necessária');
  }
  const [user, pass] = Buffer.from(auth.slice(6), 'base64').toString().split(':');
  if (user !== DASHBOARD_USER || pass !== DASHBOARD_PASS) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Marketing Agents"');
    return res.status(401).send('Usuário ou senha incorretos');
  }
  next();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readJson(file: string) {
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch { return null; }
}

function latestFile(prefix: string): string | null {
  try {
    const files = fs.readdirSync(LOGS_DIR)
      .filter(f => f.startsWith(prefix) && f.endsWith('.json'))
      .sort().reverse();
    return files[0] ? path.join(LOGS_DIR, files[0]) : null;
  } catch { return null; }
}

// ─── Server factory ───────────────────────────────────────────────────────────

export function startDashboardServer(triggers: {
  daily:        () => Promise<void>;
  optimization: () => Promise<void>;
  monthly:      () => Promise<void>;
}) {
  const app = express();
  app.use(basicAuth);
  app.use(express.json());

  // ── Static dashboard ────────────────────────────────────────────────────────
  app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));

  // ── Status ──────────────────────────────────────────────────────────────────
  app.get('/api/status', (_req, res) => {
    res.json({
      uptime:     Math.floor(process.uptime()),
      simulation: process.env.SIMULATION_MODE === 'true',
      pid:        process.pid,
      routines,
      timestamp:  new Date().toISOString(),
    });
  });

  // ── Logs (últimas N linhas) ─────────────────────────────────────────────────
  app.get('/api/logs', (req, res) => {
    const n = Math.min(500, parseInt((req.query.lines as string) ?? '150', 10));
    if (!fs.existsSync(LOG_FILE)) return res.json({ lines: [] });
    const all = fs.readFileSync(LOG_FILE, 'utf-8').trim().split('\n');
    // Remove ANSI color codes for clean display
    const clean = all.slice(-n).map(l => l.replace(/\x1B\[[0-9;]*m/g, ''));
    res.json({ lines: clean, total: all.length });
  });

  // ── Logs SSE (stream em tempo real) ────────────────────────────────────────
  app.get('/api/logs/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    let lastSize = fs.existsSync(LOG_FILE) ? fs.statSync(LOG_FILE).size : 0;

    const interval = setInterval(() => {
      if (!fs.existsSync(LOG_FILE)) return;
      const stat = fs.statSync(LOG_FILE);
      if (stat.size <= lastSize) return;
      const buf = Buffer.alloc(stat.size - lastSize);
      const fd  = fs.openSync(LOG_FILE, 'r');
      fs.readSync(fd, buf, 0, buf.length, lastSize);
      fs.closeSync(fd);
      lastSize = stat.size;
      const lines = buf.toString('utf-8')
        .trim().split('\n')
        .map(l => l.replace(/\x1B\[[0-9;]*m/g, ''))
        .filter(Boolean);
      lines.forEach(line => res.write(`data: ${JSON.stringify(line)}\n\n`));
    }, 2000);

    req.on('close', () => clearInterval(interval));
  });

  // ── Financial ───────────────────────────────────────────────────────────────
  app.get('/api/financial', (_req, res) => {
    const f = latestFile('financial_');
    res.json(f ? readJson(f) : null);
  });

  // ── Leads ───────────────────────────────────────────────────────────────────
  app.get('/api/leads', (_req, res) => {
    res.json(readJson(path.join(LOGS_DIR, 'leads-state.json')) ?? { leads: [] });
  });

  // ── Report ──────────────────────────────────────────────────────────────────
  app.get('/api/report', (_req, res) => {
    const f = latestFile('report_');
    res.json(f ? readJson(f) : null);
  });

  // ── Trigger routines ────────────────────────────────────────────────────────
  app.post('/api/trigger/:routine', async (req, res) => {
    const { routine } = req.params;
    const fn = triggers[routine as keyof typeof triggers];
    if (!fn) return res.status(404).json({ error: 'Rotina não encontrada' });
    if (routines[routine]?.running) return res.status(409).json({ error: 'Rotina já em execução' });

    res.json({ ok: true, message: `▶ Rotina "${routine}" iniciada` });
    markRoutineStart(routine);
    try {
      await fn();
      markRoutineDone(routine, true);
    } catch (err) {
      markRoutineDone(routine, false);
      logger.error(`Erro na rotina ${routine}:`, err);
    }
  });

  app.listen(PORT, () => {
    logger.info(`╔═══════════════════════════════════════╗`);
    logger.info(`║  Dashboard: http://localhost:${PORT}      ║`);
    logger.info(`║  Usuário: ${DASHBOARD_USER.padEnd(27)}║`);
    logger.info(`╚═══════════════════════════════════════╝`);
  });
}
