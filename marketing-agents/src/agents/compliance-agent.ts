import Anthropic from '@anthropic-ai/sdk';
import logger from '../utils/logger';
import type { GeneratedContent, ComplianceResult, ComplianceIssue, ComplianceStatus } from '../types';

const SIM = process.env.SIMULATION_MODE === 'true';

// ─── CFM / CONAR rules reference ─────────────────────────────────────────────

const COMPLIANCE_SYSTEM = `Você é um especialista em regulamentação de publicidade médica no Brasil.
Sua função é revisar conteúdo de marketing para clínicas e serviços de saúde e identificar violações antes da publicação.

NORMAS APLICÁVEIS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CFM — Resolução 1974/2011 (Publicidade Médica):
• Art. 3º — Proibido uso de superlativos: "o melhor", "o único", "pioneiro", "nº 1", "mais avançado"
• Art. 4º — Proibido prometer ou garantir resultados: "garante cura", "certeza de", "elimina definitivamente"
• Art. 5º — Proibido comparações com outros médicos ou clínicas de forma depreciativa
• Art. 6º — Proibido uso de "antes e depois" em qualquer formato
• Art. 7º — Proibido sensacionalismo: "milagroso", "revolucionário", "inédito"
• Art. 8º — Ao citar médico específico, obrigatório incluir CRM e especialidade
• Art. 9º — Proibido induzir procedimentos ou consultas desnecessárias via medo ou urgência falsa
• Art. 11 — Telemedicina: deve indicar claramente que é consulta online (CFM 2.314/2022)
• Art. 13 — Proibido anunciar preços de forma que induza automedicação

CFM — Resolução 2.294/2021 (Redes Sociais):
• Médicos podem divulgar seu trabalho, mas sem autopromoção excessiva
• Depoimentos de pacientes são proibidos como propaganda
• Antes/depois é proibido mesmo que paciente autorize

CONAR — Código Brasileiro de Autorregulamentação Publicitária:
• Art. 27 — Proibido explorar medo, superstição ou ansiedade para vender
• Art. 28 — Proibido enganar sobre eficácia, segurança ou resultados
• Art. 36 — Publicidade dirigida a público vulnerável exige cuidado redobrado
• Art. 58 — Publicidade de saúde não pode incentivar uso inadequado de medicamentos

PrEP — Regras específicas:
• Correto: "PrEP reduz o risco de HIV em até 99% quando tomada corretamente"
• Errado: "PrEP previne 100% do HIV" ou "PrEP cura HIV"
• Sempre reforçar que é necessária prescrição médica
• Mencionar que está disponível no SUS é permitido e recomendado
• Proibido induzir que qualquer pessoa pode tomar sem consulta

PALAVRAS DE ALERTA (verificar contexto):
Superlativos: melhor, único, pioneiro, número 1, líder, incomparável, exclusivo
Garantias: garante, certeza, definitivamente, sempre, nunca falha, 100%
Sensacionalismo: milagroso, revolucionário, inédito, fantástico, incrível
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Retorne APENAS um JSON válido neste formato exato:
{
  "status": "APPROVED" | "WARNING" | "BLOCKED",
  "issues": [
    {
      "rule": "CFM 1974/2011 Art. 3º",
      "description": "Descrição clara da violação",
      "severity": "INFO" | "WARNING" | "VIOLATION",
      "excerpt": "trecho exato do texto problemático"
    }
  ],
  "suggestions": ["sugestão de correção 1", "sugestão 2"]
}

CRITÉRIOS DE STATUS:
• APPROVED — nenhuma violação encontrada (issues pode ter apenas INFO)
• WARNING  — há problemas que devem ser revisados mas não bloqueiam (severidade WARNING)
• BLOCKED  — há violação clara de norma (severidade VIOLATION) — não publicar`;

// ─── Mock compliance scenarios for simulation ──────────────────────────────

const MOCK_APPROVED: ComplianceResult = {
  status: 'APPROVED',
  issues: [
    { rule: 'CFM 1974/2011 Art. 11', description: 'Consulta online identificada corretamente', severity: 'INFO' },
  ],
  suggestions: [],
  checkedAt: new Date().toISOString(),
};

const MOCK_WARNING: ComplianceResult = {
  status: 'WARNING',
  issues: [
    {
      rule: 'CFM 1974/2011 Art. 3º',
      description: 'Expressão com tom superlativo detectada — revisar para garantir conformidade',
      severity: 'WARNING',
      excerpt: 'melhor forma de se proteger',
    },
  ],
  suggestions: [
    'Substituir por "uma forma eficaz de se proteger" para evitar superlativo',
  ],
  checkedAt: new Date().toISOString(),
};

// ─── ComplianceAgent ─────────────────────────────────────────────────────────

export class ComplianceAgent {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? 'sim' });
  }

  async check(content: GeneratedContent, context?: string): Promise<ComplianceResult> {
    const text = this.extractText(content);

    if (SIM) {
      // Simulate: ~80% approved, ~15% warning, ~5% blocked
      const rand = Math.random();
      const result = rand > 0.20 ? MOCK_APPROVED : rand > 0.05 ? MOCK_WARNING : this.mockBlocked(text);
      result.checkedAt = new Date().toISOString();
      this.logResult(result, content.platform);
      return result;
    }

    try {
      const userMsg = `Plataforma: ${content.platform}\nMarca: ${content.brand}\n${context ? `Contexto: ${context}\n` : ''}
CONTEÚDO PARA REVISÃO:
${text}`;

      const msg = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: COMPLIANCE_SYSTEM,
        messages: [{ role: 'user', content: userMsg }],
      });

      const raw  = msg.content[0].type === 'text' ? msg.content[0].text : '{}';
      const json = raw.match(/\{[\s\S]*\}/)?.[0] ?? '{}';
      const parsed: Partial<ComplianceResult> = JSON.parse(json);

      const result: ComplianceResult = {
        status:      this.validateStatus(parsed.status),
        issues:      Array.isArray(parsed.issues) ? parsed.issues : [],
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
        checkedAt:   new Date().toISOString(),
      };

      this.logResult(result, content.platform);
      return result;

    } catch (err) {
      logger.warn('[ComplianceAgent] Erro na verificação — aprovando com aviso de revisão manual', err);
      return {
        status: 'WARNING',
        issues: [{ rule: 'Sistema', description: 'Verificação automática falhou — revisão manual necessária', severity: 'WARNING' }],
        suggestions: ['Revisar manualmente antes de publicar'],
        checkedAt: new Date().toISOString(),
      };
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private extractText(c: GeneratedContent): string {
    const parts: string[] = [];
    if (c.caption)       parts.push(`Legenda: ${c.caption}`);
    if (c.firstLine)     parts.push(`Primeira linha: ${c.firstLine}`);
    if (c.hook)          parts.push(`Gancho: ${c.hook}`);
    if (c.body)          parts.push(`Corpo: ${c.body}`);
    if (c.cta)           parts.push(`CTA: ${c.cta}`);
    if (c.headlines)     parts.push(`Títulos: ${c.headlines.join(' | ')}`);
    if (c.descriptions)  parts.push(`Descrições: ${c.descriptions.join(' | ')}`);
    if (c.versions)      c.versions.forEach((v, i) => parts.push(`Versão ${i+1}: ${v.headline} — ${v.body} — ${v.cta}`));
    if (c.segments)      parts.push(`Script: ${c.segments.map(s => s.text).join(' ')}`);
    if (c.hashtags)      parts.push(`Hashtags: ${c.hashtags.join(' ')}`);
    return parts.join('\n');
  }

  private validateStatus(s: unknown): ComplianceStatus {
    if (s === 'APPROVED' || s === 'WARNING' || s === 'BLOCKED') return s;
    return 'WARNING';
  }

  private mockBlocked(text: string): ComplianceResult {
    return {
      status: 'BLOCKED',
      issues: [
        {
          rule: 'CFM 1974/2011 Art. 4º',
          description: 'Garantia de resultado detectada — publicação bloqueada',
          severity: 'VIOLATION',
          excerpt: text.slice(0, 80),
        },
      ],
      suggestions: [
        'Remover qualquer garantia de resultado',
        'Substituir por linguagem informativa: "pode ajudar", "estudos mostram"',
      ],
      checkedAt: new Date().toISOString(),
    };
  }

  private logResult(r: ComplianceResult, platform: string) {
    const icon = { APPROVED: '✅', WARNING: '⚠️', BLOCKED: '🚫' };
    logger.info(`[ComplianceAgent] ${icon[r.status]} ${r.status} — ${platform} — ${r.issues.length} issue(s)`);
    r.issues.filter(i => i.severity !== 'INFO').forEach(i =>
      logger.warn(`[ComplianceAgent]   ${i.severity}: ${i.rule} — ${i.description}`)
    );
  }
}

export const complianceAgent = new ComplianceAgent();
