# Facilita PrEP — Playbook de Operações de Marketing

> Documento operacional para gestores de tráfego, agências e responsáveis de marketing.
> Ticket médio: R$150. Plataformas ativas: Google Ads, Meta Ads, TikTok Ads, WhatsApp.

---

## 1. Regras de Escalabilidade de Orçamento

### Regra dos 20%/semana

- **Nunca aumentar** o orçamento de um conjunto de anúncios em mais de 20% por semana.
- Aumentos acima de 20% reiniciam a fase de aprendizado no Meta e desestabilizam o algoritmo do Google.
- Aguardar **mínimo 7 dias corridos** entre cada aumento antes de avaliar o impacto.
- Regra se aplica tanto para orçamento diário quanto para orçamento vitalício (lifetime budget).

### Orçamento mínimo por conjunto de anúncios

- **Fórmula:** orçamento mínimo = 5× CPA alvo por dia.
- CPA alvo Facilita PrEP = R$150 (ticket = receita por conversão).
- **Orçamento mínimo operacional: R$750/dia por ad set.**
- Abaixo de R$750/dia o algoritmo não tem dados suficientes para otimizar (< 50 conversões/semana).
- Ad sets abaixo desse limiar devem ser consolidados ou pausados.

### Como detectar degradação de CPA

Monitorar semanalmente as métricas abaixo por ad set:

| Sinal | Limiar de alerta | Ação |
|---|---|---|
| CPA semana atual vs. média das 2 semanas anteriores | +25% | Investigar criativos e frequência |
| CPM crescente sem aumento de CTR | +20% em 7 dias | Verificar saturação de público |
| Frequência (Meta, cold audience) | >2.5 | Rotacionar criativos imediatamente |
| Taxa de conversão da landing page | queda >15% | Investigar funil pós-clique |
| ROAS abaixo do break-even | <1.0 por 3 dias consecutivos | Pausar escala, não pausar campanha ainda |

Ferramenta de monitoramento: exportar relatório semanal toda segunda-feira às 9h. Usar Google Sheets com fórmulas de variação % semana a semana.

### Quando pausar a escala (não necessariamente a campanha)

- CPA subiu mais de 40% acima da meta por 5+ dias consecutivos.
- Frequência > 3.5 em cold audience (Meta).
- Volume de consultas agendadas não acompanha o crescimento de gasto (indica problema de funil ou capacidade operacional).
- Equipe clínica sinalizou gargalo no atendimento — escalar tráfego sem capacidade de atendimento desperdiça orçamento e danifica a marca.

**Pausar escala != pausar campanha.** Manter orçamento atual estável enquanto diagnostica o problema.

---

## 2. Calendário Anual de Sazonalidade

### Datas de alta relevância para PrEP/HIV

| Data | Evento | Estratégia recomendada |
|---|---|---|
| **1 de dezembro** | Dia Mundial de Luta contra a AIDS | Maior data do ano. Aumentar orçamento em +50% na semana anterior. Criativos educativos + urgência. Meta: conversão e consciência. Parceria com influenciadores da saúde LGBTQIA+. |
| **Fevereiro (Carnaval)** | Período de alto risco de exposição | Campanha de prevenção 2 semanas antes do Carnaval. Foco em PrEP como proteção proativa. Segmentar grandes centros + destinos de Carnaval (Salvador, Rio, Recife, São Paulo). TikTok prioritário para público 18-30. |
| **Junho** | Mes do Orgulho LGBTQIA+ | Mês inteiro de campanha. Representatividade nos criativos. Budget +30% durante a semana da Parada (São Paulo: último domingo de junho). |
| **27 de agosto** | Dia Nacional do Teste de HIV | Campanha de conscientização. Conteúdo educativo sobre janela imunológica. CTA para teste + consulta PrEP. |
| **Novembro (semana antes de 1/dez)** | Aquecimento Dia Mundial da AIDS | Início de campanha de consciência para preparar audiência para 1/dezembro. |

### Datas gerais com impacto em conversão

| Data | Impacto esperado | Estratégia |
|---|---|---|
| **Black Friday** (última sexta de novembro) | Usuários em modo de compra; custo de mídia alto | Avaliar se vale competir. Testar oferta especial (ex: primeira consulta com desconto). |
| **Virada de Ano** (27 dez - 3 jan) | Resoluções de saúde; CPM menor | Campanha de "novo ano, nova proteção". Budget moderado. |
| **Início de ano letivo** (fevereiro) | Público universitário mais ativo | Segmentação por interesse universitário + regiões com campi grandes. |
| **Dias úteis vs. finais de semana** | Conversão cai ~20-30% no fim de semana | Usar dayparting: concentrar budget em ter-sex, especialmente das 12h às 21h. |

### Períodos para evitar escala agressiva

- Semana Santa (queda de engajamento em saúde preventiva).
- Julho (férias escolares — público B2C menos focado em saúde, CPM pode subir sem retorno).
- Eleições (CPM dispara por competição política; aguardar normalização).

---

## 3. Template de Briefing Criativo

Usar este template para **toda** nova solicitação de criativo. Preencher completamente antes de enviar para produção. Briefings incompletos são devolvidos automaticamente.

```
=== BRIEFING CRIATIVO — FACILITA PREP ===

DATA DE CRIAÇÃO: ____/____/______
NUMERO DO BRIEFING: BP-[ANO]-[SEQUENCIAL] (ex: BP-2026-047)

--- DISTRIBUIÇÃO ---
Canal: [ ] Meta (Feed/Stories/Reels) [ ] Google (Display/YouTube/RSA) [ ] TikTok [ ] WhatsApp
Temperatura: [ ] Cold (topo de funil) [ ] Warm (remarketing) [ ] Hot (fundo de funil)
Objetivo de campanha: [ ] Consciência [ ] Tráfego [ ] Lead [ ] Conversão [ ] Retenção

--- PÚBLICO ---
Segmento primário: _______________________________________________
Faixa etária: _______________________________________________
Localização: _______________________________________________
Comportamentos/Interesses chave: _______________________________________________
O que esse público já sabe sobre PrEP? [ ] Nada [ ] Conhece o conceito [ ] Considerando usar

--- MENSAGEM ---
Dor principal que o criativo deve tocar:
_______________________________________________

Desejo/aspiração que o criativo deve ativar:
_______________________________________________

Mensagem principal (máx. 1 frase):
_______________________________________________

Prova social ou credencial a incluir: (ex: "mais de X pacientes atendidos", "médico CRM")
_______________________________________________

Tom de voz: [ ] Educativo [ ] Empático [ ] Urgente [ ] Descontraído [ ] Científico

--- CTA ---
CTA principal (texto exato no botão/narração):
_______________________________________________
URL de destino:
_______________________________________________
UTM obrigatório: utm_source= | utm_medium= | utm_campaign= | utm_content=

--- FORMATO E ESPECIFICAÇÕES ---
| Formato          | Dimensões        | Duração/Peso máx. | Quantidade |
|------------------|------------------|-------------------|------------|
| Feed estático    | 1080x1080px      | <2MB              |            |
| Stories/Reels    | 1080x1920px      | <30s / <50MB      |            |
| YouTube bumper   | 1280x720px       | 6s                |            |
| YouTube in-stream| 1280x720px       | 15-30s            |            |
| TikTok vídeo     | 1080x1920px      | 15-60s / <500MB   |            |
| RSA (Google)     | Texto            | 15 títulos, 4 desc|            |
| Banner display   | 300x250 / 728x90 | <150KB            |            |

Observações de plataforma específicas:
_______________________________________________

--- REFERÊNCIAS ---
Link de criativo de referência (concorrente ou interna):
_______________________________________________
Criativos a NÃO replicar (já testados/saturados):
_______________________________________________

--- PRAZOS E RESPONSÁVEIS ---
Data de entrega do rascunho: ____/____/______
Data de aprovação: ____/____/______
Data de upload/ativação: ____/____/______

Responsável pela produção: _______________________________________________
Aprovador (obrigatório): _______________________________________________
Revisor médico necessário? [ ] Sim [ ] Não
  Se sim, responsável: _______________________________________________

--- OBSERVAÇÕES ADICIONAIS ---
_______________________________________________
```

---

## 4. Regras de Fadiga de Criativo

### Meta Ads

**Pausar o criativo (não o ad set) quando:**

| Métrica | Cold Audience | Remarketing |
|---|---|---|
| Frequência | > 2.5 | > 4.0 |
| CTR vs. semana anterior | queda > 30% | queda > 30% |
| CPM crescendo > 25% sem melhora de CTR | pausar | pausar |
| Thumbstop rate (vídeos) | < 20% | < 20% |
| Hook rate (3s view / impressões) | < 15% | — |

**Procedimento ao pausar:**

1. **Nunca deletar** um criativo — ele carrega histórico de aprendizado e dados de referência.
2. Mover para a pasta "Arquivados" na biblioteca (ver seção 5).
3. Registrar no log de performance: CPA médio, frequência no momento da pausa, CTR final, período ativo, gasto total.
4. Abrir briefing novo imediatamente usando o template da seção 3.
5. Testar mínimo 3 ângulos criativos distintos antes de reaplicar o mesmo ângulo.

### Google Ads

**RSA (Responsive Search Ads):**

- Pausar quando CTR < 0.5% por 30 dias corridos.
- Pausar quando Ad Strength = "Poor" por mais de 14 dias (após tentativa de otimização).
- Verificar relatório de termos de busca semanalmente — adicionar negativos agressivamente.

**Display e YouTube:**

- Pausar placements com CTR < 0.05% (display) após 10.000 impressões.
- Pausar vídeos com View Rate < 20% após 5.000 impressões.

### TikTok Ads

- Pausar criativo quando CPM aumenta > 40% em 3 dias sem melhora de CTR.
- Vídeos com < 15% de taxa de conclusão aos 3 segundos devem ser pausados imediatamente (problema de hook).
- Ciclo de vida médio de um criativo TikTok: 2-3 semanas. Planejar reposição contínua.

### WhatsApp / Campanhas de mensagem

- Monitorar taxa de resposta ao primeiro gatilho. Abaixo de 10%: revisar copy do template.
- Taxa de opt-out acima de 3%: pausar campanha e revisar segmentação e frequência de envio.

---

## 5. Estrutura da Biblioteca de Criativos

### Convenção de nomenclatura de arquivos

```
[canal]-[temperatura]-[formato]-[versão]-[AAAA-MM].ext
```

**Campos:**

| Campo | Valores aceitos |
|---|---|
| canal | `meta` / `google` / `tiktok` / `whatsapp` |
| temperatura | `cold` / `warm` / `hot` |
| formato | `feed` / `stories` / `reels` / `display` / `rsa` / `yt-bumper` / `yt-instream` / `tiktok-video` |
| versão | `v01` / `v02` ... (incrementar a cada variação) |
| AAAA-MM | Mês de criação (ex: `2026-06`) |

**Exemplos:**
```
meta-cold-reels-v01-2026-06.mp4
meta-warm-feed-v03-2026-06.jpg
google-cold-rsa-v01-2026-05.txt
tiktok-cold-tiktok-video-v02-2026-06.mp4
google-cold-display-300x250-v01-2026-05.jpg
```

### Estrutura de pastas

```
/biblioteca-criativos
├── /winning
│   ├── /meta
│   ├── /google
│   ├── /tiktok
│   └── /whatsapp
├── /testing
│   ├── /meta
│   ├── /google
│   ├── /tiktok
│   └── /whatsapp
├── /archived
│   ├── /meta
│   ├── /google
│   ├── /tiktok
│   └── /whatsapp
└── /briefings
    └── /[ANO]-[MES]
```

### Sistema de classificacao por tier

| Tier | Critério de entrada | Critério de saída |
|---|---|---|
| **Winning** | CPA menor ou igual a meta por 14+ dias E volume mínimo 20 conversões | CPA sobe > 25% acima da meta por 7 dias: move para Testing; frequência acima do limite: move para Archived |
| **Testing** | Criativo recém-lançado (< 14 dias OU < 20 conversões) | Após 14 dias: se CPA menor ou igual a meta: Winning; se CPA > meta +40%: Archived |
| **Archived** | Pausado por fadiga ou performance ruim | Nunca deletar. Pode ser reativado após 60+ dias de descanso com revisão prévia. |

**Log obrigatório ao mover para Archived (adicionar no nome do arquivo ou planilha de controle):**

```
arquivo: meta-cold-reels-v01-2026-06_ARCHIVED.mp4
CPA médio: R$___
Gasto total: R$___
Conversões: ___
Frequência na pausa: ___
Período ativo: ____/____/____ a ____/____/____
Motivo de pausa: [fadiga de frequência / CTR / CPA / outro]
```

---

## 6. Playbook de Escalabilidade

### Escalabilidade Horizontal (expandir alcance antes de aumentar budget)

Seguir esta ordem antes de subir orçamento verticalmente:

**1. Novos públicos (mesmo canal)**
- Testar novos segmentos de interesse ou lookalikes de diferentes sementes (ex: lookalike de compradores vs. lookalike de visitantes de página).
- Nunca colocar mais de 2 públicos no mesmo ad set — manter separados para leitura de dados.

**2. Novas geografias**
- Expansão recomendada por fase:
  - Fase 1: São Paulo capital + Grande SP
  - Fase 2: Rio de Janeiro + Curitiba + Belo Horizonte
  - Fase 3: Porto Alegre + Salvador + Recife + Fortaleza
  - Fase 4: demais capitais e cidades > 500k habitantes
- Criar ad sets separados por região para controle de CPA geográfico.

**3. Novos canais**
- Validar CPA no canal atual antes de abrir novo canal.
- Sequência recomendada: Meta → Google Search → TikTok → Google Display → YouTube.
- Orçamento de teste por novo canal: R$1.500-R$3.000 por 14 dias antes de decisão de escala.

**4. Novos ângulos criativos**
- Ângulos a testar sistematicamente:
  - Educacional ("O que é PrEP e por que tomar?")
  - Prova social ("Depoimento de paciente — com consentimento explícito por escrito")
  - Autoridade médica ("Dr. X, CRM XXXXX, explica...")
  - Urgência/risco ("Você pode estar se expondo sem saber")
  - Conveniência ("Consulta 100% online, resultado em 24h")
  - Custo-benefício ("Menos de R$5/dia para proteção total")

### Escalabilidade Vertical (aumentar budget no que já funciona)

**Regra de ouro:** +20% de orçamento por semana, máximo.

**Protocolo passo a passo:**

1. Identificar ad set com CPA menor ou igual a meta por 7+ dias consecutivos e mínimo 10 conversões no período.
2. Registrar CPA atual antes do aumento (referência pré-escala).
3. Aumentar orçamento em exatamente 20%.
4. Aguardar 7 dias corridos sem novo aumento.
5. Registrar CPA pós-aumento.
6. Se CPA aumentou menor ou igual a 15%: aprovado para novo ciclo de aumento.
7. Se CPA aumentou > 15%: manter orçamento estável por mais 7 dias e reavaliar.
8. Se CPA aumentou > 40%: reverter para orçamento anterior imediatamente.

**Documentar cada aumento em planilha de controle:**

```
Data | Ad Set | Budget anterior | Budget novo | CPA pré | CPA pós (D+7) | Decisão
```

**Nunca escalar dois ad sets simultaneamente** — impossibilita isolar a causa de variações de CPA.

---

## 7. Limites Operacionais de Infraestrutura Antes de Escalar

Antes de aprovar qualquer aumento significativo de budget (> +50% em relação ao patamar atual), verificar os seguintes itens com a equipe técnica:

### LLM — Análise de Exames

- O sistema usa LLM externo para análise de exames de HIV (`server/examAnalysis.ts`).
- Verificar a variável de ambiente `BUILT_IN_FORGE_API_KEY` e o limite de rate da API (Anthropic: tokens/minuto e requests/minuto por tier de conta).
- **Antes de escalar:** aumentar `LLM_DAILY_LIMIT` (ou o equivalente configurado no ambiente Railway) para suportar o volume esperado de uploads de exames.
- Regra prática: 1 consulta = 1-3 chamadas LLM em média. Calcular projeção: (leads esperados/dia) x 2 = mínimo de créditos LLM necessários/dia.
- Monitorar erros 429 (rate limit) nos logs do Railway antes e após escala.

### Banco de Dados — TiDB/MySQL

- Verificar `connectionLimit` na string de conexão do `DATABASE_URL`.
- Cada request tRPC pode abrir conexão com o banco. Com aumento de tráfego, pool de conexões pode saturar.
- **Checklist antes de escalar:**
  - [ ] `connectionLimit` configurado (recomendado: 20-50 para início, ajustar conforme carga)
  - [ ] Query de `SHOW PROCESSLIST` não retorna conexões em estado `Sleep` acumuladas
  - [ ] Índices presentes em `cpfHash`, `tokenValue`, `createdAt` (colunas de busca frequente)
  - [ ] Monitorar tempo médio de query no Railway logs — alertar se > 500ms
- Solicitar ao time TiDB Cloud aumento de capacidade de conexões **antes** de campanhas de alto volume (ex: Dia Mundial da AIDS).

### BullMQ — Fila de Geração de PDF

- PDFs de prescrição são gerados de forma assíncrona via BullMQ (`server/pdfQueue.ts`).
- Com aumento de volume de consultas concluídas, a fila pode acumular.
- **Antes de escalar:**
  - [ ] Verificar tamanho da fila atual (bull-board ou via Redis CLI: `LLEN bull:pdf-generation:wait`)
  - [ ] Confirmar que o worker de PDF está rodando (Railway service status)
  - [ ] Tempo médio de processamento de um PDF deve ser < 30 segundos
  - [ ] Configurar alerta se fila > 50 jobs pendentes (indica worker lento ou travado)
- Se fila acumular: aumentar concorrência do worker (`concurrency` no `pdfQueue.ts`) ou adicionar instância de worker.

### Capacidade de Atendimento Médico

- Gargalo mais comum: médico disponível para revisar e aprovar exames.
- Antes de escalar budget, confirmar com equipe clínica:
  - [ ] Capacidade de revisões/dia disponível
  - [ ] SLA de retorno ao paciente (ideal: < 24h úteis)
  - [ ] Quantidade de médicos cadastrados no sistema (`medicoProcedure`)
- Escalar tráfego sem capacidade clínica = cancelamentos, chargeback e reputação negativa.

### S3 — Upload de Exames

- Verificar cotas de armazenamento e limites de transfer no bucket S3.
- Campanhas de alto volume (ex: Carnaval) geram pico de uploads de exames.
- Garantir que `AWS_S3_BUCKET` está em região de baixa latência para o Brasil (`sa-east-1` se possível).

---

## 8. Processo de Onboarding de Nova Agência / Gestor

### Checklist de acesso (a ser concluído em D+1 da contratação)

**Acesso a plataformas de anúncio:**
- [ ] Adicionar como "Anunciante" no Meta Business Manager (nunca Admin pessoal)
- [ ] Criar conta Google Ads vinculada ao MCC próprio da agência; conceder acesso Standard
- [ ] Adicionar no TikTok Ads Manager como Operador
- [ ] NÃO compartilhar senhas de contas pessoais — usar acesso por usuário sempre

**Acesso a dados e analytics:**
- [ ] Compartilhar acesso de leitura ao Google Analytics (se configurado)
- [ ] Criar usuário "read-only" no Railway para ver logs de erro (não deploy)
- [ ] Compartilhar planilha de controle de CPA e criativos no Google Drive (permissão de edição)
- [ ] Acesso ao repositório de criativos (Google Drive ou similar) — pasta /testing e /winning

**O que NÃO conceder:**
- [ ] Acesso ao painel admin do sistema (Railway deploy, variáveis de ambiente)
- [ ] Acesso ao banco de dados
- [ ] Acesso a dados de pacientes (LGPD — dado de saúde sensível)
- [ ] Chaves de API (Stripe, AWS, etc.)

### O que entregar no onboarding (D+3)

1. **Este playbook completo** (MARKETING.md) — leitura obrigatória antes de qualquer ação.
2. **Planilha de histórico de performance** — últimos 90 dias: CPA por canal, CTR, CPM, conversões, gasto total.
3. **Biblioteca de criativos** — acesso às pastas /winning, /testing, /archived com metadados de performance.
4. **Briefings anteriores** — últimos 10 briefings preenchidos, para referência de ângulos já testados.
5. **Calendário de sazonalidade** (seção 2 deste documento) com as campanhas planejadas para os próximos 3 meses.
6. **Conta de anúncios com histórico de pixels** — não criar conta nova; usar conta com histórico de pixel/conversão acumulado.

### Documentação mínima que a agência deve produzir mensalmente

- Relatório mensal de performance (CPA, ROAS, volume de conversões, gasto por canal).
- Log de criativos pausados e motivo.
- Registro de testes A/B realizados e resultado.
- Projeção de budget para mês seguinte com justificativa.

Entregar até o 5º dia útil do mês seguinte ao período reportado.

### Procedimento de offboarding (troca de agência)

1. Exportar todos os criativos da biblioteca com metadados de performance **antes** de remover acesso.
2. Documentar públicos salvos e audiências customizadas criadas nas plataformas.
3. Transferir ownership de ativos (pixel Meta, conversões Google) para conta própria da Facilita PrEP — nunca deixar ativo de rastreamento em conta de agência.
4. Revogar todos os acessos listados no checklist acima em D+0 da rescisão.
5. Solicitar relatório final de entrega com status de todas as campanhas ativas.

---

*Última atualização: 2026-05-20*
*Responsável pelo documento: equipe de marketing / gestão Facilita PrEP*
