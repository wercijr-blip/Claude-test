# Modelos e Parâmetros — GPT Image Models

> Fonte: OpenAI GPT Image Generation Models Prompting Guide (abril 2026)

## Resumo dos modelos disponíveis

| Modelo | Quality disponível | Uso recomendado |
|---|---|---|
| `gpt-image-2` | `low`, `medium`, `high` | **Padrão recomendado** para novos projetos. Melhor qualidade geral, edição, texto em imagem, fotorrealismo, compositing, edições com identidade. |
| `gpt-image-1.5` | `low`, `medium`, `high` | Manter apenas para workflows já validados enquanto migra. |
| `gpt-image-1` | `low`, `medium`, `high` | Compatibilidade legada apenas. |
| `gpt-image-1-mini` | `low`, `medium`, `high` | Quando custo e volume são prioridade: geração em lote, ideação rápida, rascunhos. |

**Regra geral: use sempre `gpt-image-2`.**

---

## Tamanhos disponíveis no gpt-image-2

O gpt-image-2 aceita qualquer resolução desde que:
- Lado máximo: menor que `3840px`
- Ambos os lados múltiplos de `16`
- Proporção entre lado longo e curto: máximo `3:1`
- Total de pixels: entre `655.360` e `8.294.400`
- Acima de `2560x1440` (2K): resultados podem ser mais variáveis

### Tamanhos populares

| Label | Resolução | Quando usar |
|---|---|---|
| Square | `1024x1024` | Default geral |
| HD Portrait | `1024x1536` | Vertical — posts, stories, mobile |
| HD Landscape | `1536x1024` | Horizontal — banners, ads, thumbnails |
| Widescreen slide | `1536x864` | Apresentações, pitch decks |
| 2K / QHD | `2560x1440` | Limite recomendado de confiabilidade |

---

## Quando usar qual quality

| Quality | Quando usar |
|---|---|
| `low` | Alta velocidade, alto volume, experimentação, rascunhos. Boa qualidade para muitos casos. |
| `medium` | Uso geral — melhor equilíbrio entre velocidade e qualidade. |
| `high` | Texto pequeno ou denso, infográficos detalhados, diagramas, retratos close-up, edições sensíveis a identidade, assets para impressão ou slides. |

---

## Regra de ouro por tipo de imagem

| Tipo | Size recomendado | Quality |
|---|---|---|
| Logo | `1024x1536` | `medium` |
| Infográfico | `1024x1536` | `medium` ou `high` |
| Foto realista | `1024x1536` | `medium` |
| Anúncio (vertical) | `1024x1536` | `medium` |
| Mockup UI | `1024x1536` | `medium` |
| Foto de produto | `1024x1536` | `medium` |
| Slide / pitch deck | `1536x864` | `high` |
| Diagrama científico | `1536x1024` | `high` |
| Edição com texto denso | qualquer | `high` |
