# Checklist de Implementação — Dr. Piolho Redesign
> Ordenado por prioridade e impacto. Marcar cada item ao concluir.

---

## 🔴 FASE 1 — Imediato (esta semana, alto impacto)

### Correções técnicas críticas

- [ ] **Meta Pixel duplicado**
  - Identificar qual dos 2 IDs tem mais dados históricos (verificar no Meta Events Manager)
  - Remover o pixel duplicado do WordPress (via Customizer ou functions.php)
  - Manter apenas 1 ID e configurar eventos conforme `5-fixes/meta-pixel-fix.html`
  - Testar via [Meta Pixel Helper](https://chrome.google.com/webstore/detail/meta-pixel-helper/) — deve aparecer apenas 1 disparo de PageView
  - **Arquivo:** `drpiolho-redesign/5-fixes/meta-pixel-fix.html`

- [ ] **Contadores zerados**
  - Substituir o JavaScript atual de contadores pelo código corrigido
  - O novo código usa `IntersectionObserver` + `requestAnimationFrame` + easing
  - **Arquivo:** `drpiolho-redesign/4-html/homepage-faq-counters.html` (seção `<script>`)

- [ ] **Erro de newsletter no carregamento**
  - Aplicar o CSS + JS de supressão da mensagem de erro
  - Verificar em qual plugin de newsletter está o bug (Mailchimp, MC4WP, etc.)
  - **Arquivo:** `drpiolho-redesign/5-fixes/meta-pixel-fix.html` (seção newsletter)

- [ ] **Remover menções a terceiros no frontend**
  - Inspecionar código-fonte da homepage (Ctrl+U) e buscar por: agência, powered by, plugin, desenvolvido por
  - Remover comentários HTML expostos com referência a fornecedores
  - Verificar rodapé: remover links/logos de agências
  - Verificar plugin de chat (Joinchat): verificar se exibe "by Joinchat" — se sim, atualizar para versão Pro ou customizar CSS

### SEO — title tags e metas

- [ ] **Homepage:** atualizar title tag e meta description conforme `2-seo/meta-tags.md`
  - Title: `Tratamento de Piolhos em Brasília | Instituto Dr. Piolho | Resultado em 1 Sessão`
  - Meta: max 155 chars com "Brasília", "natural", "1 sessão"
  - Via Yoast SEO ou Rank Math no painel WordPress

- [ ] **H1 único na homepage:** verificar e corrigir — deve conter "piolhos" + "Brasília"
  - Inspecionar com F12 → buscar `<h1>` — deve existir apenas 1

- [ ] **Adicionar atributo alt em todas as imagens**
  - Usar plugin "SEO Image Optimizer" ou corrigir manualmente nas páginas
  - Formato: `"[descrição] — [localização] Dr. Piolho"`

### Conversão — produtos

- [ ] **Adicionar preço + botão "Comprar" nos produtos da homepage**
  - Usar código de `drpiolho-redesign/4-html/homepage-products.html`
  - Substituir `[ID_PRODUTO_WOOCOMMERCE]` pelos IDs reais dos produtos
  - Substituir `[URL_*]` pelas URLs reais das imagens de produto

---

## 🟠 FASE 2 — Esta semana (impacto médio-alto)

### Seção Dr. Werciley Junior

- [ ] **Criar/atualizar seção na homepage**
  - Inserir código de `drpiolho-redesign/4-html/` — seção autoridade
  - Usar HTML completo de `drpiolho-redesign/3-copy/dr-werciley-section.md`
  - Substituir `[URL_FOTO_DR_WERCILEY]` por foto profissional real
  - Posicionar após a seção de produtos

- [ ] **Byline do blog:** configurar autor "Dr. Werciley Junior" com foto, CRM e title em todos os posts
  - No WordPress: Users → editar perfil do autor → preencher bio, foto, título

- [ ] **Rodapé:** adicionar linha discreta de consultoria médica
  - `Consultoria Médica: Dr. Werciley Junior | Infectologista | CRM-DF 16381 | RQE 14486`

### Schema Markup JSON-LD

- [ ] **LocalBusiness** — inserir no `<head>` da homepage
  - **Arquivo:** `drpiolho-redesign/1-schema-markup/local-business.jsonld`
  - Método: plugin "Schema Pro" ou bloco HTML no Yoast SEO → Schema tab

- [ ] **FAQPage** — inserir na página `/perguntas-frequentes/`
  - **Arquivo:** `drpiolho-redesign/1-schema-markup/faq-page.jsonld`
  - Testar: [Google Rich Results Test](https://search.google.com/test/rich-results)

- [ ] **Product schemas** — inserir nas páginas de produto do WooCommerce
  - **Arquivo:** `drpiolho-redesign/1-schema-markup/products.jsonld`
  - Atualizar `aggregateRating.reviewCount` com número real de avaliações

### Kit Completo com desconto real

- [ ] **Criar produto "Kit Completo de Prevenção"** no WooCommerce
  - Componentes: Shampoo + Condicionador + Leave-in Proteção em Dobro + Pente de Aço
  - Preço regular calculado: soma dos itens separados
  - Preço com desconto: R$ 206,70 (já cadastrado) — confirmar que o desconto é ≥ 25%
  - Adicionar badge "Economize R$ XX" na imagem do produto

- [ ] **Reformular comunicação de desconto**
  - Remover: `R$ 108,00 → R$ 102,70` (5% — invisível)
  - Usar: `"Compre 2 e economize 15%"` ou `"Kit — R$ 50 a menos que separado"`

### Meta tags restantes

- [ ] Atualizar title + meta de todas as páginas conforme `2-seo/meta-tags.md`
  - Como Funciona, Loja, Agendar, Blog, Contato, FAQ

---

## 🟡 FASE 3 — Próximas 2 semanas

### Prova social e depoimentos

- [ ] **Adicionar seção de depoimentos na homepage**
  - Mínimo 3 depoimentos com nome + foto (ou inicial) + nota ⭐⭐⭐⭐⭐
  - Layout: carrossel mobile / grid 3 colunas desktop
  - Habilitar plugin de reviews no WooCommerce (Settings → Products → Reviews)

- [ ] **Barra de prova social**
  - Confirmar números reais com o cliente: famílias atendidas, seguidores, etc.
  - Usar código de `drpiolho-redesign/4-html/homepage-hero.html` (seção `drp-social-proof`)

### Landing page de campanhas

- [ ] **Criar página `/agende-agora/`** no WordPress
  - Usar template de página em branco (sem header/footer padrão)
  - Inserir código de `drpiolho-redesign/4-html/landing-page-agende-agora.html`
  - Configurar como `noindex` (Yoast → Advanced → noindex)
  - Substituir todos os `[PLACEHOLDERS]` com URLs e IDs reais
  - Conectar formulário ao plugin de formulários existente (CF7, WPForms, etc.)

### Melhorias na loja

- [ ] **Remover aviso de CPF** do topo da loja — mover para campo inline no checkout
- [ ] **Adicionar selos de confiança** na loja e página de checkout
  - 🔒 Pagamento seguro SSL · 📦 Frete para todo o Brasil · ↩️ Devolução em 7 dias
- [ ] **Cross-sell:** configurar "Comprado junto com" em cada produto no WooCommerce

### FAQ

- [ ] **Criar página `/perguntas-frequentes/`** com acordeão e schema FAQPage
  - Usar código de `drpiolho-redesign/4-html/homepage-faq-counters.html` (seção FAQ)
  - Inserir JSON-LD de `drpiolho-redesign/1-schema-markup/faq-page.jsonld`

### LGPD / Cookies

- [ ] **Banner de cookies:** verificar se permite aceitar/recusar (não apenas "OK")
  - Plugin recomendado: "CookieYes" ou "Complianz"
  - Deve registrar consentimento com data/hora (LGPD art. 7º)
- [ ] **Revisar Política de Privacidade** para adequação à Lei 13.709/2018
- [ ] **Verificar e atualizar Termos de Devolução** (CDC: 7 dias para compras online)

---

## 🟢 FASE 4 — Mensal / Recorrente

### SEO de conteúdo

- [ ] **2 posts de blog por mês** assinados pelo Dr. Werciley Junior
  - Exemplos de pauta:
    - "Shampoo antipiolho realmente funciona? O que a ciência diz"
    - "Como usar o pente fino corretamente — passo a passo"
    - "Piolho resiste ao shampoo? Entenda a resistência química"
    - "Como evitar piolho na volta às aulas"
  - Cada post: min. 800 palavras + H2s com palavras-chave + foto com alt

- [ ] **Atualizar Google My Business** (perfil do Instituto Dr. Piolho)
  - Fotos atualizadas da fachada e atendimento
  - Responder avaliações (Google valoriza isso para SEO local)

### Performance

- [ ] **PageSpeed target:** mobile > 70 | desktop > 85
  - Converter todas as imagens para WebP
  - Implementar lazy loading (`loading="lazy"` — já incluído nos HTMLs)
  - Minificar CSS/JS (plugin: Autoptimize ou WP Rocket)
  - Ativar cache (WP Rocket, LiteSpeed, ou W3 Total Cache)

### Sitemap e Search Console

- [ ] Gerar/atualizar `sitemap.xml` (Yoast SEO faz automaticamente)
- [ ] Enviar sitemap ao Google Search Console
- [ ] Verificar cobertura de indexação mensalmente

---

## Referência dos arquivos gerados

| Arquivo | Descrição |
|---------|-----------|
| `1-schema-markup/local-business.jsonld` | Schema LocalBusiness completo |
| `1-schema-markup/faq-page.jsonld` | Schema FAQPage com 8 perguntas |
| `1-schema-markup/products.jsonld` | Schemas de todos os produtos |
| `2-seo/meta-tags.md` | Title tags e meta descriptions de todas as páginas |
| `3-copy/dr-werciley-section.md` | Copy completo da seção de autoridade |
| `3-copy/ctas-e-hero.md` | Todos os CTAs, hero copy, microcopy |
| `4-html/homepage-hero.html` | Hero + barra de prova social (HTML/CSS) |
| `4-html/homepage-products.html` | Vitrine de 4 produtos (HTML/CSS) |
| `4-html/homepage-faq-counters.html` | Contadores corrigidos + FAQ accordion (HTML/CSS/JS) |
| `4-html/landing-page-agende-agora.html` | Landing page completa para campanhas pagas |
| `5-fixes/meta-pixel-fix.html` | Pixel unificado + eventos + correção newsletter |
| `6-checklist/implementacao.md` | Este arquivo |
