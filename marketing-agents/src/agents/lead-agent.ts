import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger';
import type { Brand, Lead, LeadCaptureData, LeadZone, LeadStatus, FunnelReport } from '../types';

const SIM = process.env.SIMULATION_MODE === 'true';
const STATE_FILE = path.join(process.cwd(), 'logs', 'leads-state.json');

// ─── WhatsApp conversation templates ─────────────────────────────────────────

const WA: Record<Brand, Record<string, string>> = {
  facilita_prep: {
    welcome:     'Olá {nome}! 👋 Sou a assistente da *Facilita PrEP*.\nVocê demonstrou interesse em PrEP — prevenção do HIV com 99% de eficácia 💊\n\n1️⃣ Quero saber mais\n2️⃣ Quero agendar consulta\n3️⃣ Dúvidas sobre custo',
    info:        '*PrEP* previne o HIV com 99% de eficácia ✅\nConsulta online · Receita digital · Sem julgamentos\n\n👉 R$ 280 — quer agendar?',
    schedule:    'Acesse agora: *facilitaprep.manus.space* 🔗\nOu me informe seu e-mail para enviar o link!',
    followup_d1: 'Oi {nome}! Ficou com alguma dúvida sobre PrEP? Estou aqui 😊',
    followup_d3: '{nome}, sabia que o SUS oferece PrEP gratuitamente? Mas nossa consulta online tem acompanhamento personalizado. Quer saber mais?',
    reactivation:'Oi {nome}! Faz um tempo 😊 Ainda pensa em PrEP? Temos horários essa semana.',
  },
  iaso_clinica: {
    welcome:     'Olá {nome}! 👋 Bem-vindo à *Clínica IASO* — Infectologia em Brasília.\n\n1️⃣ Agendar consulta\n2️⃣ Informações sobre PrEP\n3️⃣ Exames e ISTs',
    info:        '*Clínica IASO* 🏥\n👨‍⚕️ Dr. Werciley Saraiva · Brasília-DF\nConsulta R$ 450 · Seg–Sex 8h–18h\nAtendimento humanizado e sigiloso.',
    schedule:    'Para agendar:\n📞 (61) 9xxxx-xxxx\nOu me informe e-mail e horário preferido 📅',
    followup_d1: 'Olá {nome}! Da Clínica IASO 😊 Ficou com alguma dúvida sobre a consulta?',
    reactivation:'Olá {nome}! O Dr. Werciley tem disponibilidade essa semana. Posso verificar horários?',
  },
};

// ─── Email sequences ──────────────────────────────────────────────────────────

const EMAIL_SEQ: Record<Brand, Array<{ day: number; subject: string; body: string }>> = {
  facilita_prep: [
    { day: 0,  subject: 'Bem-vindo à Facilita PrEP 💊',                             body: 'prep_welcome' },
    { day: 1,  subject: 'Como funciona a consulta online de PrEP (passo a passo)',   body: 'prep_how_it_works' },
    { day: 3,  subject: '5 dúvidas sobre PrEP respondidas por especialistas',        body: 'prep_faq' },
    { day: 7,  subject: 'Sua proteção contra o HIV não pode esperar ⚠️',             body: 'prep_urgency' },
    { day: 14, subject: '"PrEP mudou minha vida" — história real',                   body: 'prep_social_proof' },
    { day: 30, subject: 'Ainda pensando em PrEP? Podemos ajudar 💙',                 body: 'prep_reactivation' },
  ],
  iaso_clinica: [
    { day: 0,  subject: 'Bem-vindo à Clínica IASO — Infectologia em Brasília',      body: 'iaso_welcome' },
    { day: 1,  subject: 'Por que um infectologista especializado faz diferença',     body: 'iaso_specialist' },
    { day: 3,  subject: 'Saúde sexual: o que você precisa saber',                   body: 'iaso_sexual_health' },
    { day: 7,  subject: 'Agende com Dr. Werciley Saraiva — vagas limitadas',        body: 'iaso_cta' },
    { day: 30, subject: 'Sua saúde merece atenção especializada 🏥',                body: 'iaso_reactivation' },
  ],
};

// ─── Partner channels ─────────────────────────────────────────────────────────

const PARTNERS = [
  { id: 'antra',      name: 'ANTRA',          type: 'ong',          reach: 15000, profile: 'MULHER_TRANS' },
  { id: 'abia',       name: 'ABIA',           type: 'ong',          reach: 22000, profile: 'HSH' },
  { id: 'grindr',     name: 'Grindr Ads',     type: 'app',          reach: 85000, profile: 'HSH' },
  { id: 'hornet',     name: 'Hornet Ads',     type: 'app',          reach: 35000, profile: 'HSH' },
  { id: 'daspu',      name: 'DASPu SP',       type: 'ong',          reach: 8000,  profile: 'PROFISSIONAL_SEXO' },
  { id: 'cfess',      name: 'CFESS',          type: 'institucional', reach: 50000, profile: 'GERAL' },
];

// ─── Scoring weights (simulation) ────────────────────────────────────────────

const SOURCE_W: Record<string, number> = {
  ORGANIC: 35, REFERRAL: 35, PARTNER_ONG: 30, WHATSAPP: 28,
  GOOGLE: 25, PARTNER_APP: 20, INSTAGRAM: 20, EMAIL: 15, LINKEDIN: 15,
};
const PROFILE_W: Record<string, number> = {
  HSH: 25, MULHER_TRANS: 25, PROFISSIONAL_SEXO: 20, PROFISSIONAL_SAUDE: 15, GERAL: 10,
};

function zoneFrom(score: number): LeadZone {
  return score >= 65 ? 'HOT' : score >= 35 ? 'WARM' : 'COLD';
}

// ─── Email HTML builder ───────────────────────────────────────────────────────

function emailHtml(templateKey: string, lead: Lead): string {
  const n = lead.name ?? 'você';
  const brand = lead.brand === 'facilita_prep';
  const color = brand ? '#7c3aed' : '#0891b2';
  const cta   = brand ? 'Agendar Consulta Online' : 'Agendar Consulta Presencial';
  const link  = brand ? 'https://facilitaprep.manus.space' : 'https://clinicaiaso.com.br';

  const bodies: Record<string, string> = {
    prep_welcome:      `<p>Olá ${n},</p><p>Você deu o primeiro passo para se proteger do HIV com <b>PrEP</b> — 99% de eficácia.</p><ul><li>Consulta 100% online</li><li>Receita digital</li><li>Sem julgamentos</li></ul>`,
    prep_how_it_works: `<p>Olá ${n},</p><p>A consulta Facilita PrEP é simples: <b>1.</b> Agenda online → <b>2.</b> Vídeo-consulta → <b>3.</b> Receita digital → <b>4.</b> Retirada na farmácia.</p>`,
    prep_faq:          `<p>Olá ${n},</p><p><b>5 dúvidas comuns sobre PrEP:</b></p><ol><li>PrEP é só para HSH? <i>Não — qualquer pessoa com risco.</i></li><li>Tem efeitos colaterais? <i>Mínimos e temporários.</i></li><li>Funciona de verdade? <i>99% com adesão correta.</i></li><li>O SUS oferece? <i>Sim, nos COAS e UBS credenciadas.</i></li><li>A consulta online é válida? <i>Sim, reconhecida pelo CFM.</i></li></ol>`,
    prep_urgency:      `<p>Olá ${n},</p><p>Cada dia sem proteção é um dia de risco evitável. <b>PrEP funciona</b> — e a consulta leva menos de 30 minutos.</p>`,
    prep_social_proof: `<p>Olá ${n},</p><p><i>"Antes do PrEP vivia com medo. Hoje tenho paz de espírito." — João, 29 anos, paciente Facilita PrEP.</i></p><p>Histórias reais de pessoas reais. Seja a próxima.</p>`,
    prep_reactivation: `<p>Olá ${n},</p><p>Faz um tempo que não conversamos 💙 Se ainda pensa em PrEP, estamos aqui. A qualquer momento.</p>`,
    iaso_welcome:      `<p>Olá ${n},</p><p>Bem-vindo à <b>Clínica IASO</b> — infectologia de excelência em Brasília com o Dr. Werciley Saraiva.</p>`,
    iaso_specialist:   `<p>Olá ${n},</p><p>Um infectologista especializado faz toda a diferença: diagnóstico preciso, tratamento personalizado, sem estigma.</p>`,
    iaso_sexual_health:`<p>Olá ${n},</p><p>Saúde sexual é saúde integral. ISTs têm tratamento, PrEP previne o HIV, e consulta regular mantém você protegido.</p>`,
    iaso_cta:          `<p>Olá ${n},</p><p>O Dr. Werciley tem vagas essa semana. Consulta de infectologia em ambiente seguro e sigiloso.</p>`,
    iaso_reactivation: `<p>Olá ${n},</p><p>Sua saúde não pode esperar 🏥 Estamos disponíveis para atendê-lo quando quiser.</p>`,
  };

  const bodyHtml = bodies[templateKey] ?? `<p>Olá ${n}, obrigado pelo interesse!</p>`;
  return `<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px">
    <h2 style="color:${color}">${lead.brand === 'facilita_prep' ? 'Facilita PrEP 💊' : 'Clínica IASO 🏥'}</h2>
    ${bodyHtml}
    <a href="${link}" style="background:${color};color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:16px">${cta} →</a>
    <p style="color:#999;font-size:11px;margin-top:24px">Para cancelar o recebimento, responda SAIR.</p>
  </div>`;
}

// ─── State interface ──────────────────────────────────────────────────────────

interface EmailQueueItem {
  id: string;
  leadId: string;
  to: string;
  subject: string;
  templateKey: string;
  scheduledAt: string;
  sentAt?: string;
}

interface LeadState {
  leads: Lead[];
  emailQueue: EmailQueueItem[];
}

// ─── LeadAgent ────────────────────────────────────────────────────────────────

export class LeadAgent {
  private anthropic: Anthropic;
  private state: LeadState = { leads: [], emailQueue: [] };

  constructor() {
    this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? 'sim' });
    this.loadState();
  }

  // ── State ──────────────────────────────────────────────────────────────────

  private loadState() {
    try {
      if (fs.existsSync(STATE_FILE)) {
        this.state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
      }
    } catch { /* fresh start */ }
  }

  private saveState() {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(this.state, null, 2));
  }

  private genId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // ── Lead capture ───────────────────────────────────────────────────────────

  async captureLead(data: LeadCaptureData): Promise<Lead> {
    const id = this.genId();
    const lead: Lead = {
      id,
      name: data.name,
      phone: data.phone,
      email: data.email,
      source: data.source,
      profile: data.profile,
      brand: data.brand,
      status: 'NEW',
      score: 0,
      zone: 'COLD',
      scoreFactors: [],
      createdAt: new Date().toISOString(),
      emailSequenceStep: 0,
      utmSource: data.utmSource,
      utmCampaign: data.utmCampaign,
      notes: data.intent ? [data.intent] : [],
      whatsappOptIn: data.whatsappOptIn ?? false,
    };

    await this.scoreLead(lead);
    this.state.leads.push(lead);

    if (lead.email) await this.triggerEmailSequence(lead);
    if (lead.phone && lead.whatsappOptIn) await this.sendWhatsAppWelcome(lead);

    this.saveState();
    logger.info(`[LeadAgent] Lead capturado: ${id} | ${lead.zone} | ${lead.source} | ${lead.brand}`);
    return lead;
  }

  // ── Lead scoring ───────────────────────────────────────────────────────────

  async scoreLead(lead: Lead): Promise<void> {
    if (SIM) {
      const base = (SOURCE_W[lead.source] ?? 15) + (PROFILE_W[lead.profile] ?? 10);
      const contact = (lead.phone ? 10 : 0) + (lead.email ? 10 : 0);
      const variance = ((lead.id.charCodeAt(0) % 10) - 5);
      lead.score = Math.min(100, Math.max(0, base + contact + variance));
      lead.zone = zoneFrom(lead.score);
      lead.scoreFactors = [`source:${lead.source}`, `profile:${lead.profile}`, `contact:${contact}`];
      return;
    }

    try {
      const msg = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 256,
        messages: [{
          role: 'user',
          content: `Avalie este lead de saúde e retorne JSON: {"score":0-100,"factors":["..."]}\nSource: ${lead.source}\nProfile: ${lead.profile}\nBrand: ${lead.brand}\nHas phone: ${!!lead.phone}\nHas email: ${!!lead.email}\nIntent: ${lead.notes[0] ?? 'N/A'}`,
        }],
      });
      const text = msg.content[0].type === 'text' ? msg.content[0].text : '{}';
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        lead.score = Math.min(100, Math.max(0, parsed.score ?? 50));
        lead.scoreFactors = parsed.factors ?? [];
      }
    } catch {
      lead.score = 40;
      lead.scoreFactors = ['scoring_error'];
    }
    lead.zone = zoneFrom(lead.score);
  }

  // ── WhatsApp ───────────────────────────────────────────────────────────────

  async sendWhatsAppWelcome(lead: Lead): Promise<void> {
    const template = WA[lead.brand]?.welcome ?? '';
    const text = template.replace('{nome}', lead.name ?? 'você');
    await this.sendWhatsApp(lead.phone!, text);
    lead.status = 'CONTACTED';
    lead.lastContactAt = new Date().toISOString();
  }

  async sendWhatsApp(phone: string, text: string): Promise<string> {
    if (SIM) {
      logger.info(`[LeadAgent][SIM] WhatsApp → ${phone.slice(-4).padStart(phone.length, '*')}: ${text.slice(0, 60)}…`);
      return `wa_sim_${this.genId()}`;
    }
    const { data } = await axios.post(
      `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      { messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: text } },
      { headers: { Authorization: `Bearer ${process.env.META_ACCESS_TOKEN}` } },
    );
    return data.messages?.[0]?.id ?? 'unknown';
  }

  // ── Email sequences ────────────────────────────────────────────────────────

  async triggerEmailSequence(lead: Lead): Promise<void> {
    const seq = EMAIL_SEQ[lead.brand];
    const now = new Date();
    for (const step of seq) {
      const scheduled = new Date(now.getTime() + step.day * 86400000);
      this.state.emailQueue.push({
        id: this.genId(),
        leadId: lead.id,
        to: lead.email!,
        subject: step.subject,
        templateKey: step.body,
        scheduledAt: scheduled.toISOString(),
      });
    }
    logger.info(`[LeadAgent] Sequência de ${seq.length} e-mails agendada para ${lead.email}`);
  }

  async processEmailQueue(): Promise<number> {
    const now = new Date();
    const due = this.state.emailQueue.filter(j => !j.sentAt && new Date(j.scheduledAt) <= now);
    let sent = 0;
    for (const job of due) {
      const lead = this.state.leads.find(l => l.id === job.leadId);
      if (!lead) { job.sentAt = now.toISOString(); continue; }
      const html = emailHtml(job.templateKey, lead);
      await this.sendEmail(job.to, job.subject, html);
      job.sentAt = now.toISOString();
      lead.emailSequenceStep++;
      lead.lastContactAt = now.toISOString();
      if (lead.status === 'NEW') lead.status = 'CONTACTED';
      sent++;
    }
    if (sent > 0) this.saveState();
    return sent;
  }

  async sendEmail(to: string, subject: string, html: string): Promise<string> {
    if (SIM) {
      logger.info(`[LeadAgent][SIM] Email → ${to}: ${subject}`);
      return `email_sim_${this.genId()}`;
    }
    await axios.post('https://api.sendgrid.com/v3/mail/send', {
      personalizations: [{ to: [{ email: to }] }],
      from: { email: process.env.SENDGRID_FROM_EMAIL ?? 'noreply@facilitaprep.com.br', name: 'Facilita PrEP' },
      subject,
      content: [{ type: 'text/html', value: html }],
    }, {
      headers: { Authorization: `Bearer ${process.env.SENDGRID_API_KEY}` },
    });
    return `sg_${this.genId()}`;
  }

  // ── Follow-up automation ───────────────────────────────────────────────────

  async followUpHotLeads(): Promise<number> {
    const hot = this.state.leads.filter(l => l.zone === 'HOT' && l.status === 'CONTACTED' && l.phone && l.whatsappOptIn);
    let count = 0;
    for (const lead of hot) {
      const lastContact = lead.lastContactAt ? new Date(lead.lastContactAt) : new Date(lead.createdAt);
      const daysSince = (Date.now() - lastContact.getTime()) / 86400000;
      if (daysSince >= 1 && daysSince < 2) {
        const msg = (WA[lead.brand]?.followup_d1 ?? '').replace('{nome}', lead.name ?? 'você');
        await this.sendWhatsApp(lead.phone!, msg);
        lead.lastContactAt = new Date().toISOString();
        count++;
      } else if (daysSince >= 3 && daysSince < 4 && lead.brand === 'facilita_prep') {
        const msg = (WA[lead.brand]?.followup_d3 ?? '').replace('{nome}', lead.name ?? 'você');
        await this.sendWhatsApp(lead.phone!, msg);
        lead.lastContactAt = new Date().toISOString();
        count++;
      }
    }
    if (count > 0) this.saveState();
    logger.info(`[LeadAgent] Follow-up enviado para ${count} leads HOT`);
    return count;
  }

  async reactivateInactive(daysThreshold = 30): Promise<number> {
    const cutoff = new Date(Date.now() - daysThreshold * 86400000);
    const inactive = this.state.leads.filter(l =>
      (l.status === 'CONTACTED' || l.status === 'QUALIFIED') &&
      new Date(l.lastContactAt ?? l.createdAt) < cutoff,
    );
    let count = 0;
    for (const lead of inactive) {
      if (lead.phone && lead.whatsappOptIn) {
        const msg = (WA[lead.brand]?.reactivation ?? '').replace('{nome}', lead.name ?? 'você');
        await this.sendWhatsApp(lead.phone, msg);
      } else if (lead.email) {
        const seq = EMAIL_SEQ[lead.brand];
        const last = seq[seq.length - 1];
        await this.sendEmail(lead.email, last.subject, emailHtml(last.body, lead));
      }
      lead.status = 'CONTACTED';
      lead.lastContactAt = new Date().toISOString();
      count++;
    }
    if (count > 0) this.saveState();
    logger.info(`[LeadAgent] Reativação enviada para ${count} leads inativos`);
    return count;
  }

  // ── Conversion ─────────────────────────────────────────────────────────────

  convertLead(leadId: string): Lead | null {
    const lead = this.state.leads.find(l => l.id === leadId);
    if (!lead) return null;
    lead.status = 'CONVERTED';
    lead.convertedAt = new Date().toISOString();
    this.saveState();
    logger.info(`[LeadAgent] Lead CONVERTIDO: ${leadId} | ${lead.brand} | score:${lead.score}`);
    return lead;
  }

  // ── Partner outreach ───────────────────────────────────────────────────────

  async runPartnerOutreach(): Promise<void> {
    logger.info('[LeadAgent] Iniciando outreach em canais parceiros...');
    for (const p of PARTNERS) {
      if (SIM) {
        const estimatedLeads = Math.round(p.reach * 0.002);
        logger.info(`[LeadAgent][SIM] Parceiro ${p.name} | alcance ${p.reach.toLocaleString()} | ~${estimatedLeads} leads estimados`);
      } else {
        logger.info(`[LeadAgent] Contato parceiro ${p.name} (${p.type}) — implementar via API/e-mail da ${p.name}`);
      }
    }
  }

  // ── Funnel report ──────────────────────────────────────────────────────────

  generateFunnelReport(): FunnelReport {
    const leads = this.state.leads;
    const total = leads.length;

    const byStatus: Record<string, number> = {};
    const byZone: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    const byBrand: Record<string, number> = {};

    for (const l of leads) {
      byStatus[l.status] = (byStatus[l.status] ?? 0) + 1;
      byZone[l.zone]     = (byZone[l.zone] ?? 0) + 1;
      bySource[l.source] = (bySource[l.source] ?? 0) + 1;
      byBrand[l.brand]   = (byBrand[l.brand] ?? 0) + 1;
    }

    const converted = byStatus['CONVERTED'] ?? 0;
    const contacted = leads.filter(l => l.status !== 'NEW').length;
    const avgScore  = total > 0 ? leads.reduce((s, l) => s + l.score, 0) / total : 0;
    const topSource = Object.entries(bySource).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'N/A';

    const report: FunnelReport = {
      total,
      byStatus,
      byZone,
      bySource,
      byBrand,
      conversionRate: total > 0 ? (converted / total) * 100 : 0,
      contactRate:    total > 0 ? (contacted / total) * 100 : 0,
      avgScore:       Math.round(avgScore),
      topSource,
      recentLeads: leads.slice(-5).reverse().map(l => ({
        id: l.id, name: l.name, source: l.source, zone: l.zone, status: l.status, createdAt: l.createdAt,
      })),
      generatedAt: new Date().toISOString(),
    };

    logger.info(`[LeadAgent] Funil: ${total} leads | ${converted} convertidos (${report.conversionRate.toFixed(1)}%) | top fonte: ${topSource}`);
    return report;
  }

  // ── Simulation seed ────────────────────────────────────────────────────────

  async seedSimulationData(): Promise<void> {
    if (this.state.leads.length > 0) return;
    logger.info('[LeadAgent] Gerando dados de simulação...');

    const sources = ['INSTAGRAM','GOOGLE','WHATSAPP','ORGANIC','PARTNER_ONG','REFERRAL','LINKEDIN'] as const;
    const profiles = ['HSH','MULHER_TRANS','PROFISSIONAL_SEXO','GERAL','PROFISSIONAL_SAUDE'] as const;
    const brands: Brand[] = ['facilita_prep','facilita_prep','facilita_prep','iaso_clinica'];
    const statuses: LeadStatus[] = ['NEW','CONTACTED','CONTACTED','QUALIFIED','QUALIFIED','CONVERTED','CONVERTED','CONVERTED','LOST'];
    const names = ['Ana Lima','Carlos Santos','Mariana Oliveira','João Costa','Fernanda Rocha','Rafael Souza','Priya Nair','Lucas Mendes','Camila Reis','Pedro Alves'];

    for (let i = 0; i < 40; i++) {
      const daysAgo = Math.floor(Math.random() * 90);
      const createdAt = new Date(Date.now() - daysAgo * 86400000).toISOString();
      const lead: Lead = {
        id: this.genId(),
        name: names[i % names.length] + ` ${i}`,
        phone: i % 3 !== 0 ? `+5561999${String(i).padStart(6,'0')}` : undefined,
        email: i % 4 !== 0 ? `lead${i}@example.com` : undefined,
        source: sources[i % sources.length],
        profile: profiles[i % profiles.length],
        brand: brands[i % brands.length],
        status: statuses[i % statuses.length],
        score: 0,
        zone: 'COLD',
        scoreFactors: [],
        createdAt,
        lastContactAt: statuses[i % statuses.length] !== 'NEW' ? new Date(Date.now() - (daysAgo - 1) * 86400000).toISOString() : undefined,
        convertedAt: statuses[i % statuses.length] === 'CONVERTED' ? new Date(Date.now() - (daysAgo - 3) * 86400000).toISOString() : undefined,
        emailSequenceStep: Math.floor(Math.random() * 4),
        notes: [],
        whatsappOptIn: i % 2 === 0,
      };
      await this.scoreLead(lead);
      this.state.leads.push(lead);
    }
    this.saveState();
    logger.info(`[LeadAgent] ${this.state.leads.length} leads de simulação criados`);
  }

  getLeads(): Lead[] { return this.state.leads; }
}

export const leadAgent = new LeadAgent();
