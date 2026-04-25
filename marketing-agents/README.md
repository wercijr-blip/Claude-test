# Marketing Agents — Facilita PrEP + Clínica IASO

Sistema de agentes de marketing IA que automatiza geração de conteúdo, postagem e gestão de anúncios em Instagram/Meta, Google Ads e LinkedIn.

---

## Pré-requisitos

- Node.js 18+
- pnpm, npm ou yarn
- Conta Meta Business com acesso de administrador
- Conta Google Ads com developer token aprovado
- Conta LinkedIn com acesso à API de Marketing
- API Key da Anthropic (Claude)

---

## Como obter cada credencial

### Anthropic (Claude API)
1. Acesse [console.anthropic.com](https://console.anthropic.com)
2. Vá em **API Keys** → **Create Key**
3. Cole em `ANTHROPIC_API_KEY`

### Meta Access Token
1. Acesse [developers.facebook.com](https://developers.facebook.com)
2. **My Apps** → crie um app do tipo **Business**
3. **Graph API Explorer** → selecione seu app → gere token com permissões:
   - `pages_manage_posts`, `ads_management`, `instagram_basic`, `instagram_content_publish`
4. Cole em `META_ACCESS_TOKEN`
5. `META_PAGE_ID` e `INSTAGRAM_BUSINESS_ACCOUNT_ID`: encontre em **Configurações da Página** → **Instagram**

### Google Ads
1. Acesse [console.cloud.google.com](https://console.cloud.google.com)
2. **APIs & Services** → **Credentials** → **Create OAuth 2.0 Client ID**
3. Cole `client_id` em `GOOGLE_ADS_CLIENT_ID` e `client_secret` em `GOOGLE_ADS_CLIENT_SECRET`
4. Gere o `refresh_token` via OAuth Playground: [oauth.dev](https://developers.google.com/oauthplayground)
5. `GOOGLE_ADS_DEVELOPER_TOKEN`: solicite em [ads.google.com/aw/apicenter](https://ads.google.com/aw/apicenter)
6. `GOOGLE_ADS_CUSTOMER_ID`: número de 10 dígitos no canto superior direito do Google Ads

### LinkedIn
1. Acesse [linkedin.com/developers](https://www.linkedin.com/developers)
2. **Create App** → preencha informações da empresa
3. Em **Auth** → **OAuth 2.0 settings** → gere token com escopos:
   - `w_member_social`, `rw_ads`, `r_ads_reporting`
4. Cole em `LINKEDIN_ACCESS_TOKEN`
5. `LINKEDIN_ORGANIZATION_ID`: número após `/company/` na URL da sua página
6. `LINKEDIN_AD_ACCOUNT_ID`: encontre em **Campaign Manager**

---

## Instalação

```bash
git clone <repo>
cd marketing-agents

npm install           # ou pnpm install

cp .env.example .env
# Edite .env com suas credenciais reais
```

---

## Executando

```bash
# Modo simulação (não chama APIs reais — ideal para testar)
SIMULATION_MODE=true npm start

# Executar ciclo completo agora + manter agendador ativo
npm run run-now

# Apenas gerar relatório mensal
npm run report

# Dashboard de métricas (abre em http://localhost:3001)
npm run dashboard
```

---

## Como funciona

### Rotina Diária — Seg / Qua / Sex às 09:00
1. **Agente de Conteúdo** chama a Claude API com system prompt especializado em saúde sexual
2. Gera legenda para Instagram (Facilita PrEP) e post para LinkedIn (Clínica IASO)
3. **Agente Instagram** publica no feed orgânico
4. **Agente LinkedIn** publica na página da organização
5. Se ainda não existir, cria campanhas pagas em Meta Ads, Google Ads e LinkedIn Ads

### Otimização Semanal — Segunda às 08:00
1. Coleta métricas de todas as campanhas ativas
2. Aplica regras automáticas:
   - CTR Meta < 0,8%: pausa campanha + gera novo creative
   - CPC Google > R$3,00: reduz lances 20%
   - CPM Meta > R$25: sugere mudança de público
3. Loga todas as ações tomadas

### Relatório Mensal — Dia 1 às 07:00
1. Consolida métricas de todos os canais
2. Salva JSON em `logs/report_YYYY-MM.json`
3. Exibe sumário no console: gasto, alcance, leads, CPL por plataforma

---

## Modo Simulação

Com `SIMULATION_MODE=true` no `.env`, todos os agentes retornam dados mock realistas sem chamar nenhuma API externa. Ideal para:
- Testar o fluxo completo sem credenciais
- Desenvolver e validar a lógica de otimização
- Demonstrações

---

## Custos estimados (APIs)

| Serviço | Custo estimado |
|---|---|
| Claude API (conteúdo) | ~R$0,50/dia |
| Meta Graph API | Gratuita |
| Google Ads API | Gratuita para uso próprio |
| LinkedIn API | Gratuita |

---

## Troubleshooting

### Token expirado (Meta / LinkedIn)
- Meta token expira em 60 dias → renove em Graph API Explorer
- LinkedIn token expira em 60 dias → renove em [linkedin.com/developers](https://www.linkedin.com/developers)
- O orchestrator loga um aviso 7 dias antes da expiração (implementar no futuro)

### Anúncio reprovado pelo Meta
1. Acesse [business.facebook.com/adsmanager](https://business.facebook.com/adsmanager)
2. Clique no anúncio → **Ver detalhes da reprovação**
3. Solicite revisão manual em **Solicitar revisão**
4. Evite termos como "HIV positivo" — use "prevenção", "saúde sexual", "PrEP"

### Rate limit
Os agentes têm backoff exponencial automático (1s → 2s → 4s → falha). Se persistir:
- Meta: máximo 200 chamadas/hora por token
- LinkedIn: máximo 500 chamadas/hora
- Google: sem limite para uso próprio

### Verificação de saúde — Google Ads
- Acesse: **Ferramentas** → **Política e segurança** → **Verificação de identidade**
- Envie o CRM-DF como comprovante de profissional de saúde
- Isso desbloqueia anúncios de saúde sem restrições de palavras-chave

---

## Estrutura de arquivos

```
marketing-agents/
  src/
    agents/
      content-agent.ts     ← Claude API — gera conteúdo
      instagram-agent.ts   ← Meta Graph API — posta + gerencia Meta Ads
      google-agent.ts      ← Google Ads API — campanhas de busca
      linkedin-agent.ts    ← LinkedIn API — posts + LinkedIn Ads
      report-agent.ts      ← consolida métricas, salva relatórios
    orchestrator.ts        ← agenda e coordena todos os agentes
    config/
      prompts.ts           ← system/user prompts do content-agent
      targets.ts           ← públicos-alvo e keywords
    types/
      index.ts             ← interfaces TypeScript
    utils/
      logger.ts            ← logs com Winston
      scheduler.ts         ← cron jobs + retry
    dashboard/
      index.html           ← dashboard de métricas (HTML vanilla)
  logs/
    agent.log              ← todos os logs
    report_YYYY-MM.json    ← relatórios mensais
  .env.example
  package.json
  tsconfig.json
```
