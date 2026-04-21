import fs from 'fs';
import path from 'path';
import logger from './logger';
import type { ContentJob, Brand } from '../types';

const VAULT_PATH = path.resolve(
  process.env.OBSIDIAN_VAULT_PATH ?? path.join(process.cwd(), 'vault'),
);

// ── Helpers ────────────────────────────────────────────────────────────────────

function vaultFile(...parts: string[]): string {
  return path.join(VAULT_PATH, ...parts);
}

function safeRead(filePath: string): string | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

function safeWrite(filePath: string, content: string): void {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf-8');
  } catch (err) {
    logger.warn(`[Vault] Erro ao escrever ${filePath}:`, err);
  }
}

function currentWeek(): string {
  const now  = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(((now.getTime() - jan1.getTime()) / 86_400_000 + jan1.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

// ── Readers ────────────────────────────────────────────────────────────────────

export function readBriefing(weekStr?: string): string | null {
  const week = weekStr ?? currentWeek();
  const content = safeRead(vaultFile('briefings', `${week}.md`));
  if (content) logger.info(`[Vault] Briefing da semana ${week} carregado`);
  return content;
}

export function readBrandVoice(brand: Brand): string | null {
  const filename = brand === 'facilita_prep' ? 'facilita-prep.md' : 'iaso-clinica.md';
  return safeRead(vaultFile('brand-voice', filename));
}

export function readComplianceNotes(): string | null {
  return safeRead(vaultFile('compliance', 'cfm-notas.md'));
}

export function readPersonas(): string | null {
  return safeRead(vaultFile('strategy', 'personas.md'));
}

/**
 * Assembles all vault context relevant to a brand into a single string
 * that can be injected into the AI system prompt.
 */
export function buildVaultContext(brand: Brand): string {
  const sections: string[] = [];

  const briefing = readBriefing();
  if (briefing) sections.push(`## Pauta da semana\n${briefing}`);

  const brandVoice = readBrandVoice(brand);
  if (brandVoice) sections.push(`## Voz e tom da marca\n${brandVoice}`);

  const compliance = readComplianceNotes();
  if (compliance) sections.push(`## Notas de compliance\n${compliance}`);

  const personas = readPersonas();
  if (personas) sections.push(`## Personas-alvo\n${personas}`);

  if (sections.length === 0) return '';

  logger.info(`[Vault] Contexto montado para ${brand}: ${sections.length} seção(ões)`);
  return sections.join('\n\n');
}

// ── Writers ────────────────────────────────────────────────────────────────────

/**
 * Appends a published post entry to the monthly history log in the vault.
 * Called automatically by ApprovalAgent after every successful publish.
 */
export function appendPublishedPost(job: ContentJob): void {
  const month    = new Date().toISOString().slice(0, 7);
  const filePath = vaultFile('history', `${month}.md`);

  const entry = [
    `\n## ${new Date().toLocaleString('pt-BR')} — ${job.label}`,
    ``,
    `| Campo | Valor |`,
    `|-------|-------|`,
    `| Plataforma | ${job.platform} |`,
    `| Marca | ${job.brand} |`,
    `| Post ID | ${job.publishedPostId ?? 'n/a'} |`,
    job.imageUrl ? `| Imagem | [ver](${job.imageUrl}) |` : '',
    job.videoUrl ? `| Vídeo | [ver](${job.videoUrl}) |` : '',
    ``,
    `> ${job.preview}`,
    ``,
    `---`,
  ].filter(Boolean).join('\n');

  const existing = safeRead(filePath) ?? `# Histórico de Publicações — ${month}\n`;
  safeWrite(filePath, existing + entry);
  logger.info(`[Vault] Publicação registrada no histórico: ${job.label}`);
}

/**
 * Writes a markdown report to vault/reports/YYYY-MM.md so it shows up
 * in Obsidian alongside briefings and brand assets.
 */
export function writeReport(markdownContent: string, month?: string): void {
  const m        = month ?? new Date().toISOString().slice(0, 7);
  const filePath = vaultFile('reports', `${m}.md`);
  safeWrite(filePath, markdownContent);
  logger.info(`[Vault] Relatório salvo em vault/reports/${m}.md`);
}

/**
 * Creates a blank weekly briefing template if one does not exist yet.
 * Returns the path so the orchestrator can log it.
 */
export function createWeeklyBriefingTemplate(): string {
  const week     = currentWeek();
  const filePath = vaultFile('briefings', `${week}.md`);
  if (fs.existsSync(filePath)) return filePath;

  const template = `# Briefing — Semana ${week}

## 🎯 Foco desta semana

> Escreva aqui o tema principal das publicações desta semana.
> Exemplo: "Semana de conscientização sobre PrEP para jovens LGBT"

## 📋 Pautas específicas

- [ ]
- [ ]
- [ ]

## 🚫 Evitar esta semana

> Temas, palavras ou abordagens que NÃO devem aparecer nesta semana.

## 💬 Tom e abordagem

> Como quer que o conteúdo soe? Mais educativo? Emotivo? Com urgência?

## 📅 Datas importantes

> Algum evento, feriado ou data comemorativa relevante esta semana?

## 🔗 Referências

> Links, artigos ou notícias que os agentes devem levar em conta.
`;

  safeWrite(filePath, template);
  logger.info(`[Vault] Novo template de briefing criado: vault/briefings/${week}.md`);
  return filePath;
}
