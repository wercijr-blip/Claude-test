# MARKETING.md — Facilita PrEP

Playbook operacional de tráfego pago e marketing digital.
Atualizar sempre que uma regra mudar ou aprendizado relevante surgir.

---

## 1. Regras de Escalabilidade de Orçamento

**Regra dos 20%:** Nunca aumentar orçamento de campanha ativa mais que 20% por semana.
Aumentos maiores reiniciam a fase de aprendizado do Smart Bidding.

**Orçamento mínimo por conjunto/campanha:**
- Meta Ads: R$750/dia por conjunto (= 5× CPA alvo de R$150)
- Google Ads: R$750/dia por campanha de conversão
- Abaixo desse valor: o algoritmo não sai do aprendizado (meta: 50 conversões/mês)

**Quando pausar a escala:**
- CPA subiu >30% em relação à baseline dos últimos 7 dias
- Frequência Meta >2,5 em público frio (sinal de saturação)
- ROAS caiu >25% por 5 dias consecutivos

**Antes de escalar verificar:**
```
[ ] LLM_DAILY_LIMIT configurado para suportar volume (atualizar via Railway)
[ ] connectionLimit MySQL = 20 em produção (padrão atual: 10)
[ ] BullMQ: fila de PDF sem backlog >50 jobs
[ ] Redis: latência < 100ms (verificar Upstash dashboard)
```

---

## 2. Calendário de Sazonalidade

| Data | Evento | Ação de marketing |
|------|--------|-------------------|
| 1º de dezembro | Dia Mundial de Luta contra a AIDS | Campanha de awareness, criativo específico, aumento de verba |
| Carnaval (fev/mar) | Período de alto risco | Pre-load criativos com 30 dias de antecedência, aumentar budget |
| Junho | Mês do Orgulho LGBTQIA+ | Criativos inclusivos, parceria com influenciadores da comunidade |
| 27 de agosto | Dia Nacional de Luta contra a AIDS | Campanha secundária, conteúdo educativo |
| Black Friday (nov) | Sensível — produto de saúde | Promoção de bônus (não desconto), ex.: "Consulta de retorno inclusa" |
| Ano Novo (dez/jan) | Resolução de saúde | Campanha "Cuide da sua saúde em 2025", topo de funil |

**Regra:** Criativos sazonais devem estar aprovados 30 dias antes da data.
Reservar verba incremental 15 dias antes de picos sazonais.

---

## 3. Template de Briefing Criativo

```
BRIEFING #[N] — [CANAL] — [DATA]

CANAL: Meta Feed / Meta Reels / Google Search / Google Display / TikTok
TEMPERATURA: Frio (novo) / Morno (engajou) / Quente (remarketing)
OBJETIVO: Conversão (lead) / Awareness / Consideração / Remarketing

PÚBLICO:
- Quem é: [perfil demográfico e psicográfico]
- Dor principal: [o que os mantém acordados às 3h]
- Desejo: [resultado que querem alcançar]
- Objeção #1: [por que não comprariam hoje]

MENSAGEM PRINCIPAL: [uma frase que resolve a dor e comunica o benefício]
CTA: [uma ação — "Garantir minha consulta", "Quero minha receita", etc.]

FORMATO E DIMENSÕES:
- Reels/TikTok: 9:16, 15–30s, legenda obrigatória
- Feed: 4:5 (1080×1350), estático ou vídeo
- Stories: 9:16, 1080×1920
- Google Display: 1200×628, 300×250, 160×600

COPY HEADLINE (máx 40 caracteres): [...]
COPY DESCRIÇÃO (máx 125 caracteres): [...]

HOOK (primeiros 3s do vídeo / primeira linha do texto): [...]
PROVA SOCIAL (número, depoimento ou dado): [...]

REFERÊNCIAS: [links de criativos concorrentes ou referências de estilo]

PRAZO DE ENTREGA: [data]
RESPONSÁVEL CRIATIVO: [nome]
APROVADOR: [nome]
APROVAÇÃO ATÉ: [data — mínimo 5 dias antes do lançamento]
```

---

## 4. Regras de Fadiga de Criativo

**Meta Ads — pausar quando:**
- Frequência > 2,5 em público frio por 3+ dias consecutivos
- Frequência > 4,0 em remarketing por 3+ dias consecutivos
- CTR caiu >30% em relação à média dos 7 dias anteriores
- Quality Ranking = "Below Average" sem melhora em 7 dias

**Google Ads — pausar quando:**
- CTR < 0,5% por 30 dias em Search RSA
- Ad Strength = "Poor" sem assets adicionados por 14 dias
- QS < 5 em palavras-chave relevantes após 30 dias de veiculação

**Ação obrigatória ao detectar fadiga:**
1. Criar novo briefing com ângulo diferente (dor ≠ desejo ≠ prova social)
2. Não deletar o criativo pausado — arquivar com nota de performance
3. Reutilizar o post ID do Meta para preservar social proof (comentários/curtidas)

---

## 5. Estrutura da Biblioteca de Criativos

**Nomenclatura:** `[canal]-[temperatura]-[formato]-[v#]-[AAAA-MM].[ext]`

Exemplos:
- `meta-frio-reel-v1-2025-06.mp4`
- `google-quente-display-1200x628-v2-2025-01.png`
- `tiktok-morno-vertical-v1-2025-12.mp4`

**Tiers de performance:**

| Tier | Critério | Ação |
|------|----------|------|
| 🏆 Winning | CTR top 20% + CPA ≤ meta | Escalar, duplicar ângulo |
| 🧪 Testing | <4 semanas no ar ou dados insuficientes | Monitorar semanalmente |
| 📦 Archived | Pausado por fadiga ou performance baixa | Manter com anotação de aprendizado |

**Banco mínimo:** ≥ 2 semanas de criativos aprovados e prontos antes de qualquer campanha.
**Revisão:** Todo final de mês, mover criativos entre tiers com base em dados reais.

---

## 6. Playbook de Escalabilidade

### Escalabilidade Vertical (mais verba, mesmo público)
```
Semana 1:  Budget base estabelecido, CPA medido
Semana 2:  +20% se CPA ≤ meta × 1,1
Semana 3:  +20% se CPA ainda ok. Se CPA subiu >30%, voltar ao budget anterior.
Semana 4+: Repetir ciclo
```

### Escalabilidade Horizontal (novos públicos e canais)
1. **Novos públicos** → Lookalike 2% → Lookalike 3–5% → Interesses amplos
2. **Nova segmentação geográfica** → Expandir de capitais para interior, estado por estado
3. **Novo canal** → TikTok (awareness) → YouTube (consideração) → Display (remarketing)
4. **Novo ângulo criativo** → Rodar em campanha separada, budget mínimo por 30 dias antes de decisão

### Premissas de projeção (atualizar com dados reais mensalmente)
```
Se aumentar budget Meta em +50%:
  Volume esperado: +35–40% (eficiência cai levemente com escala)
  CPA esperado: +10–15%
  Prazo para estabilização: 14 dias
```

---

## 7. Limites de Infraestrutura Antes de Escalar

Verificar e ajustar via Railway antes de campanhas de escala (>2× budget atual):

```bash
# Aumentar limite diário de análise de exames por IA
LLM_DAILY_LIMIT=500  # padrão: 200 — trocar via Railway → Variables

# Aumentar pool de conexões MySQL em produção
# Editar server/db.ts: connectionLimit: 20 (padrão: 10)

# Verificar BullMQ jobs em fila
# Monitorar via /api/metrics (requer OPS_TOKEN no header X-Ops-Token)
```

---

## 8. Onboarding de Nova Agência ou Gestor

**Acessos a conceder:**
- [ ] Meta Business Manager: papel "Analista" ou "Anunciante"
- [ ] Google Ads MCC: acesso de leitura ou gestão conforme escopo
- [ ] Google Analytics 4: Analista
- [ ] Looker Studio: Visualizador do dashboard principal
- [ ] WhatsApp Business API (somente se gerenciar Click-to-WhatsApp)

**Documentos a entregar:**
- [ ] Este MARKETING.md
- [ ] EXPERIMENTOS.md com histórico de testes
- [ ] Brand guidelines (cores, fontes, tom de voz)
- [ ] Histórico de performance dos últimos 3 meses (CSV export)
- [ ] CPA alvo por campanha e canal
- [ ] Contato do responsável técnico (para CAPI, Enhanced Conversions)

**Acesso a revogar ao encerrar contrato:**
- [ ] Meta Business Manager
- [ ] Google Ads
- [ ] GA4
- [ ] Railway (se tiver acesso)
- [ ] GitHub (se tiver acesso)

**Regra:** Nenhum acesso permanece ativo após 7 dias do encerramento do contrato.
