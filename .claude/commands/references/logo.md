# Geração de Logo — GPT Image Models

> Fonte: OpenAI GPT Image Generation Models Prompting Guide — Seção 4.5

## Quando usar este guia
Criação de logos, marcas, ícones, marcas visuais, identidade de marca.

---

## Princípios-chave (da documentação oficial)

> "Strong logo generation comes from clear brand constraints and simplicity. Describe the brand's personality and use case, then ask for a clean, original mark with strong shape, balanced negative space, and scalability across sizes."

- Descreva a **personalidade da marca** e o contexto de uso
- Peça um mark **limpo e original** com forma forte
- Espaço negativo equilibrado e **legibilidade em todos os tamanhos**
- Design flat, minimal, sem gradientes (a menos que essencial)
- Fundo simples, logo centralizado com padding generoso
- Sem marca d'água

Você pode especificar o parâmetro `n` para gerar múltiplas variações (ex: 4 versões).

---

## Elicitação — perguntas a fazer

Antes de gerar, pergunte:

1. **Nome da marca/empresa** (exato, como deve aparecer se houver texto)
2. **O que a marca faz?** (segmento, produto, serviço)
3. **Personalidade/vibe** (ex: moderno e tech, artesanal e quente, institucional, divertido)
4. **Preferências visuais** (ícone + texto? Só símbolo? Monograma? Cores específicas?)
5. **Quantas variações?** (padrão: 1; máximo recomendado: 4)

---

## Template de prompt (baseado no exemplo oficial)

```
Create an original, non-infringing logo for a company called [NOME DA EMPRESA], [DESCRIÇÃO CURTA DO NEGÓCIO].
The logo should feel [PERSONALIDADE/VIBE].
Use clean, vector-like shapes, a strong silhouette, and balanced negative space.
Favor simplicity over detail so it reads clearly at small and large sizes.
Flat design, minimal strokes, no gradients unless essential.
Plain background. Deliver a single centered logo with generous padding. No watermark.
```

### Exemplo real da documentação

```
Create an original, non-infringing logo for a company called Field & Flour, a local bakery.
The logo should feel warm, simple, and timeless. Use clean, vector-like shapes, a strong silhouette, and balanced negative space.
Favor simplicity over detail so it reads clearly at small and large sizes. Flat design, minimal strokes, no gradients unless essential.
Plain background. Deliver a single centered logo with generous padding. No watermark.
```

---

## Parâmetros recomendados

- **Model:** `gpt-image-2`
- **Size:** `1024x1536`
- **Quality:** `medium`
- **n:** `4` (se quiser variações para escolher)

---

## Dicas adicionais

- Se precisar de variações com cores diferentes, gere com `n=4` e descreva a paleta desejada no prompt
- Para logos com texto específico: coloque o nome **entre aspas** no prompt e reforce que deve aparecer exatamente como escrito
- Para logos só com símbolo (sem texto): diga explicitamente "no text, symbol only"
- Para monograma: diga "lettermark using the initials [XY]"
