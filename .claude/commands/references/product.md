# Foto de Produto e E-commerce — GPT Image Models

> Fonte: OpenAI GPT Image Generation Models Prompting Guide — Seções 5.4 e 5.5

## Quando usar este guia
Extração de produto com fundo limpo, packshots para e-commerce, mockups de produto em cenário, billboards com produto, criativos de marketing usando foto de produto real (via edição).

---

## Princípios-chave (da documentação oficial)

> "Product extraction and mockup prep is commonly used for catalogs, marketplaces, and design systems. Success depends on edge quality (clean silhouette, no fringing/halos) and label integrity (text stays sharp and unchanged)."

- **Qualidade de silhueta**: contorno limpo, sem franjas ou halos
- **Integridade do label**: texto do produto deve permanecer nítido e inalterado
- Para fundo transparente final: remova o fundo em uma etapa separada após a geração
- Para realismo sem re-estilização: peça apenas polish leve e uma sombra de contato sutil
- Para criativos com produto em cena: use a **função de edição** passando a foto real como input

---

## Elicitação — perguntas a fazer

1. **Você tem uma foto do produto para usar como input?** (fundamental para edição)
2. **Objetivo** (fundo branco para catálogo, produto em cenário, billboard, mockup de embalagem)
3. **Cenário desejado** (se não for fundo branco — ex: mesa de madeira, ambiente externo, prateleira)
4. **Tem texto/copy para aparecer na imagem?** (tagline, headline do ad)
5. **Sombra** (sim/não, e qual tipo — sutil, dramática)

---

## Template de prompt — Extração de produto (fundo branco)

> **Tipo: Edição** (usa foto do produto como input)

```
Extract the product from the input image and place it on a plain white opaque background.
Output: centered product, crisp silhouette, no halos/fringing.
Preserve product geometry and label legibility exactly.
Add only light polishing and a subtle realistic contact shadow.
Do not restyle the product; only remove background and lightly polish.
```

### Exemplo real da documentação (shampoo — extração)

```
Extract the product from the input image and place it on a plain white opaque background.
Output: centered product, crisp silhouette, no halos/fringing.
Preserve product geometry and label legibility exactly.
Add only light polishing and a subtle realistic contact shadow.
Do not restyle the product; only remove background and lightly polish.
```

---

## Template de prompt — Produto em cenário / criativo de marketing

> **Tipo: Edição** (usa foto do produto como input)

```
Create a realistic [TIPO] of [PRODUTO] on [AMBIENTE/CENÁRIO].
[TEXTO NA IMAGEM, se houver]:
"[TEXTO EXATO]"
Typography: [ESTILO], high contrast, centered, clean kerning.
Ensure text appears once and is perfectly legible.
No watermarks, no logos.
```

### Exemplo real da documentação (billboard de shampoo)

```
Create a realistic billboard mockup of the shampoo on a highway scene during sunset.
Billboard text (EXACT, verbatim, no extra characters):
"Fresh and clean"
Typography: bold sans-serif, high contrast, centered, clean kerning.
Ensure text appears once and is perfectly legible.
No watermarks, no logos.
```

---

## Template de prompt — Mockup de embalagem colecionável

> **Tipo: Geração** (sem input)

```
Create a collectible [TIPO] of [DESCRIÇÃO DO PERSONAGEM/PRODUTO], in blister packaging.

Concept:
[CONTEXTO E PROPOSTA DE VALOR DO PRODUTO]

Style:
Premium toy photography, realistic [MATERIAIS] textures,
studio lighting, shallow depth of field,
sharp label printing, high-end retail presentation.

Constraints:
- Original design only
- No trademarks
- No watermarks
- No logos

Include ONLY this packaging text (verbatim):
"[TEXTO DA EMBALAGEM]"
```

---

## Parâmetros recomendados

- **Model:** `gpt-image-2`
- **Size:** `1024x1536`
- **Quality:** `medium`

---

## Dicas adicionais

- Para **fundo transparente**: o gpt-image-2 produz fundo opaco — use uma ferramenta de remoção de fundo (ex: Remove.bg, Canva) após gerar a imagem
- Para **preservar o label do produto**: enfatize "Preserve product geometry and label legibility exactly" — sem isso o modelo pode alterar texto e design da embalagem
- Para **múltiplos cenários com o mesmo produto**: use a função de edição em série, sempre com a mesma foto do produto como input
