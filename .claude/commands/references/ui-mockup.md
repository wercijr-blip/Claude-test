# Mockups de UI e Interface — GPT Image Models

> Fonte: OpenAI GPT Image Generation Models Prompting Guide — Seção 4.8

## Quando usar este guia
Mockups de aplicativos mobile, telas de web app, interfaces de produto, wireframes com visual, previews de UI para apresentação.

---

## Princípios-chave (da documentação oficial)

> "UI mockups work best when you describe the product as if it already exists. Focus on layout, hierarchy, spacing, and real interface elements, and avoid concept art language so the result looks like a usable, shipped interface rather than a design sketch."

- Descreva o produto como se **já existisse** e estivesse no ar
- Foque em: layout, hierarquia, espaçamento, elementos de interface reais
- Evite linguagem de concept art — o resultado deve parecer uma interface entregue, não um sketch
- Especifique fundo, tipografia, cores e decoração
- Coloque o mockup **em um frame de dispositivo** (iPhone, browser) para mais realismo
- Seja prático: descreva seções concretas (header, lista de itens, seção de destaque, footer com info)

---

## Elicitação — perguntas a fazer

1. **Que tipo de app/produto?** (app mobile, web dashboard, landing page, tela específica)
2. **O que o app faz?** (funcionalidade principal)
3. **Quais seções/elementos devem aparecer?** (ex: header, lista, cards, navegação, formulário)
4. **Estilo visual** (ex: minimalista, colorido, dark mode, material design, iOS nativo)
5. **Frame de dispositivo?** (iPhone, Android, MacBook, browser — ou sem frame)

---

## Template de prompt

```
Create a realistic mobile app UI mockup for [TIPO DE APP].
Show [TELA PRINCIPAL] with [COMPONENTES].
Design it to be [PRINCÍPIOS].
[ESTILO VISUAL].
It should look like a real, well-designed, beautiful app for [CONTEXTO].
Place the UI mockup in an [FRAME].
```

### Exemplo real da documentação (farmers market app)

```
Create a realistic mobile app UI mockup for a local farmers market.
Show today's market with a simple header, a short list of vendors with small photos and categories, a small "Today's specials" section, and basic information for location and hours.
Design it to be practical, and easy to use. White background, subtle natural accent colors, clear typography, and minimal decoration.
It should look like a real, well-designed, beautiful app for a small local market.
Place the UI mockup in an iPhone frame.
```

---

## Parâmetros recomendados

- **Model:** `gpt-image-2`
- **Size:** `1024x1536` (mobile/app) ou `1536x1024` (web/dashboard)
- **Quality:** `medium`

---

## Dicas adicionais

- **Descreva conteúdo real**, não placeholder — nomes de vendedores, categorias, horários fictícios mas plausíveis tornam o mockup muito mais convincente
- Para **dashboard web**: use `1536x1024` e descreva colunas, métricas, gráficos e navegação lateral
- Para **dark mode**: especifique explicitamente "dark background, light text, high contrast"
- Para **telas específicas** (login, onboarding, checkout): descreva o estado da tela — "user just added item to cart", "first-time user setup screen"
- Evite pedir "app bonito" sem especificar elementos — o modelo precisa de hierarquia e componentes concretos para gerar algo usável
