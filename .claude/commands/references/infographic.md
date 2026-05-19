# Infográficos e Diagramas — GPT Image Models

> Fonte: OpenAI GPT Image Generation Models Prompting Guide — Seções 4.1 e 4.9

## Quando usar este guia
Infográficos explicativos, posters, diagramas com labels, timelines, "visual wiki", diagramas científicos/técnicos, slides com dados, assets educacionais.

---

## Princípios-chave (da documentação oficial)

> "Use infographics to explain structured information for a specific audience: students, executives, customers, or the general public."

- Defina **audiência** e **objetivo de aprendizado**
- Especifique o **formato visual** (explainer, poster, diagrama com labels, timeline)
- Liste os **componentes obrigatórios** e o que **não deve** aparecer
- Para layouts densos ou muito texto na imagem: use `quality: high`
- Peça fundo branco limpo, ícones consistentes, setas claras, labels legíveis, espaço em branco suficiente

---

## Elicitação — perguntas a fazer

1. **O que deve ser explicado?** (tema/conceito principal)
2. **Para quem?** (audiência: estudantes, executivos, clientes gerais, especialistas)
3. **Formato?** (explainer geral, timeline, diagrama de fluxo, comparativo, poster)
4. **Elementos obrigatórios?** (componentes específicos, labels, dados, ícones)
5. **Tem texto específico que precisa aparecer?** (títulos, labels exatos)

---

## Template de prompt — Infográfico geral

```
Create a detailed infographic about [TEMA].
[DESCREVA O FLUXO OU ESTRUTURA — ex: from X to Y, showing steps A, B, C]
Target audience: [AUDIÊNCIA].
Include: [ELEMENTOS OBRIGATÓRIOS — ex: arrows connecting steps, labels for main components, a title].
Style: clean classroom/explainer layout, white background, simple icons, clear labels, easy-to-read text.
Avoid tiny text, extra decoration, or anything that makes the diagram hard to understand.
```

### Exemplo real da documentação (máquina de café)

```
Create a detailed Infographic of the functioning and flow of an automatic coffee machine like a Jura.
From bean basket, to grinding, to scale, water tank, boiler, etc.
I'd like to understand technically and visually the flow.
```

---

## Template de prompt — Visual científico/educacional

```
Create a simple [DISCIPLINA] diagram titled "[TÍTULO]" for [AUDIÊNCIA].

Show [CONCEITO PRINCIPAL]. Include [COMPONENTES].
Use arrows to connect the steps, and label the main molecules/elements: [LISTA DE LABELS].
Make it look like a clean classroom handout or slide, with a white background, simple icons, clear labels, and easy-to-read text.

Avoid tiny text, extra decoration, or anything that makes the diagram hard to understand.
```

### Exemplo real da documentação (respiração celular)

```
Create a simple biology diagram titled "Cellular Respiration at a Glance" for high school students.

Show how glucose turns into energy inside a cell. Include glycolysis, the Krebs cycle, and the electron transport chain.
Use arrows to connect the steps, and label the main molecules: glucose, pyruvate, ATP, NADH, FADH2, CO2, O2, and H2O.
Make it look like a clean classroom handout or slide, with a white background, simple icons, clear labels, and easy-to-read text.

Avoid tiny text, extra decoration, or anything that makes the diagram hard to understand.
```

---

## Template de prompt — Slide / Pitch Deck

```
Create one [TIPO DE SLIDE] titled "[TÍTULO]" that feels like a real [CONTEXTO].

Use a clean white background, modern sans-serif typography, and a crisp, minimal layout. The slide should include:
* [ELEMENTO 1]
* [ELEMENTO 2]
* [ELEMENTO 3]
* [ELEMENTO 4]

The design should look like [PADRÃO DE QUALIDADE]: highly readable text, clear data hierarchy, polished spacing, and professional visual language.

Avoid clip art, stock photography, gradients, shadows, decorative elements, or anything that feels generic or overdesigned.
```

### Exemplo real da documentação (slide de mercado)

```
Create one pitch-deck slide titled "Market Opportunity" that feels like a real Series A fundraising slide from a YC-backed startup.

Use a clean white background, modern sans-serif typography like Inter, and a crisp, minimal layout. The slide should include:

* A TAM/SAM/SOM concentric-circle diagram in muted blues and grays
* Specific, believable market sizing numbers:
  * TAM: $42B
  * SAM: $8.7B
  * SOM: $340M
* A clean bar chart below showing market growth from 2021 to 2026, with a subtle upward trend
* Small footnotes: "AGI Research, 2024" and "Internal analysis"
* A company logo placeholder in the bottom-right corner

The design should look like it belongs in a deck that actually raised money: highly readable text, clear data hierarchy, polished spacing, and professional startup-style visual language.

Avoid clip art, stock photography, gradients, shadows, decorative elements, or anything that feels generic or overdesigned.
```

---

## Parâmetros recomendados

| Tipo | Size | Quality |
|---|---|---|
| Infográfico vertical | `1024x1536` | `medium` (denso: `high`) |
| Diagrama científico | `1536x1024` | `high` |
| Slide / pitch deck | `1536x864` | `high` |

- **Model:** sempre `gpt-image-2`

---

## Dica sobre tradução de infográficos

Para localizar um infográfico existente para outro idioma, use a função de **edição** (não geração):

```
Translate the text in the infographic to [IDIOMA]. Do not change any other aspect of the image.
```

Isso preserva tipografia, posicionamento, espaçamento e hierarquia — apenas traduz o texto.
