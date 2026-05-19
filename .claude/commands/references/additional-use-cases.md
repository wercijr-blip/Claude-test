# Use Cases Adicionais de Alto Valor — GPT Image Models

> Fonte: OpenAI GPT Image Generation Models Prompting Guide — Seção 6

## Quando usar este guia
Interior design swap, cartão comemorativo 3D, conceito de merch/colecionável, livro infantil com personagem consistente.

---

## Índice desta seção

| Use Case | Seção |
|---|---|
| 6.1 Interior design "swap" (precision edits) | [ver abaixo](#61-interior-design-swap) |
| 6.2 3D pop-up holiday card | [ver abaixo](#62-3d-pop-up-holiday-card) |
| 6.3 Collectible Action Figure / Merch | [ver abaixo](#63-collectible-action-figure--merch) |
| 6.4 Children's Book com personagem consistente | [ver abaixo](#64-childrens-book-com-personagem-consistente) |

---

## 6.1 Interior Design "Swap" (precision edits)

> "Used for visualizing furniture or decor changes in real spaces without re-rendering the entire scene. The goal is surgical realism: swap a single object while preserving camera angle, lighting, shadows, and surrounding context so the edit looks like a real photograph, not a redesign."

**Tipo: Edição** (usa foto do ambiente como input)

### Elicitação
1. Foto do ambiente (obrigatório como input)
2. Qual elemento trocar? (ex: cadeiras, sofá, tapete, iluminação)
3. Por quê? (material, cor, estilo desejado)

### Template de prompt

```
In this room photo, replace ONLY [ELEMENTO ORIGINAL — ex: the white chairs] with [NOVO ELEMENTO — ex: chairs made of wood].
Preserve camera angle, room lighting, floor shadows, and surrounding objects.
Keep all other aspects of the image unchanged.
Photorealistic contact shadows and [MATERIAL — ex: fabric / wood] texture.
```

### Exemplo real da documentação

```
In this room photo, replace ONLY white with chairs made of wood.
Preserve camera angle, room lighting, floor shadows, and surrounding objects.
Keep all other aspects of the image unchanged.
Photorealistic contact shadows and fabric texture.
```

**Parâmetros:** `size: 1536x1024` | `quality: medium`

---

## 6.2 3D Pop-up Holiday Card (product-style mock)

> "Emphasizes tactile realism—paper layers, fibers, folds, and soft studio lighting—so the result reads as a photographed physical product rather than a flat illustration."

**Tipo: Geração**

### Elicitação
1. Tema/ocasião (natal, aniversário, formatura, ano novo)
2. Cena principal (o que aparece no card)
3. Mood/emoção desejada (nostálgico, alegre, sentimental, divertido)
4. Texto exato do cartão (verbatim)

### Template de prompt

```
Create a [TIPO — ex: Christmas / birthday / graduation] holiday card illustration.

Scene:
[DESCRIÇÃO DA CENA]

Mood:
[MOOD — ex: Warm, nostalgic, gentle, emotional.]

Style:
Premium holiday card photography, soft cinematic lighting,
realistic textures, shallow depth of field,
tasteful bokeh lights, high print-quality composition.

Constraints:
- Original artwork only
- No trademarks
- No watermarks
- No logos

Include ONLY this card text (verbatim):
"[TEXTO EXATO DO CARTÃO]"
```

### Exemplo real da documentação (cartão de natal com ursinho)

```
Create a Christmas holiday card illustration.

Scene:
a cozy Christmas scene with an old teddy bear sitting inside a keepsake box,
slightly worn fur, soft stitching repairs, placed near a window with falling snow outside.
The scene suggests the child has grown up, but the memories remain.

Mood:
Warm, nostalgic, gentle, emotional.

Style:
Premium holiday card photography, soft cinematic lighting,
realistic textures, shallow depth of field,
tasteful bokeh lights, high print-quality composition.

Constraints:
- Original artwork only
- No trademarks
- No watermarks
- No logos

Include ONLY this card text (verbatim):
"Merry Christmas — some memories never fade."
```

**Parâmetros:** `size: 1024x1536` | `quality: medium`

---

## 6.3 Collectible Action Figure / Merch Concept

> "Used for early merch ideation and pitch visuals. Focuses on premium product photography cues (materials, packaging, print clarity) while keeping designs original and non-infringing."

**Tipo: Geração**

### Elicitação
1. Tipo de produto (action figure, pelúcia, keychain, colecionável em blister)
2. Descrição do personagem/objeto
3. Conceito/narrativa do produto (o que ele evoca ou representa)
4. Texto da embalagem (verbatim)

### Template de prompt

```
Create a collectible [TIPO] of [DESCRIÇÃO DO PERSONAGEM/OBJETO], in blister packaging.

Concept:
[PROPOSTA DE VALOR]

Style:
Premium toy photography, realistic [MATERIAL] textures,
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

### Exemplo real da documentação (aviãozinho colecionável)

```
Create a collectible action figure of a vintage-style toy propeller airplane with rounded wings,
a front-mounted spinning propeller, slightly worn paint edges,
classic childhood proportions, designed as a nostalgic holiday collectible, in blister packaging.

Concept:
A nostalgic holiday collectible inspired by the simple toy airplanes
children used to play with during winter holidays.
Evokes warmth, imagination, and childhood wonder.

Style:
Premium toy photography, realistic plastic and painted metal textures,
studio lighting, shallow depth of field,
sharp label printing, high-end retail presentation.

Constraints:
- Original design only
- No trademarks
- No watermarks
- No logos

Include ONLY this packaging text (verbatim):
"Christmas Memories Edition"
```

**Parâmetros:** `size: 1024x1536` | `quality: medium`

---

## 6.4 Children's Book com Personagem Consistente (multi-image workflow)

> "Designed for multi-page illustration pipelines where character drift is unacceptable. A reusable 'character anchor' ensures visual continuity across scenes, poses, and pages while allowing environmental and narrative variation."

**Workflow em 2 etapas:**
- **Etapa 1:** Geração — criar o personagem âncora
- **Etapa 2:** Edição — usar o personagem como input para continuar a história

### Elicitação
1. Descrição do personagem (aparência, roupa, personalidade)
2. Tema/universo da história (floresta, espaço, cidade, fantasia)
3. Estilo visual (aquarela, cartoon, flat illustration, hand-painted)
4. Cena da página a gerar

---

### Etapa 1 — Criar o Personagem Âncora (Geração)

```
Create a children's book illustration introducing a main character.

Character:
[DESCRIÇÃO DETALHADA DO PERSONAGEM]

Theme:
[TEMA]

Style:
Children's book illustration, [TÉCNICA],
soft outlines, warm earthy colors, whimsical and friendly.
Proportions suitable for picture books (slightly oversized head, expressive face).

Constraints:
- Original character (no copyrighted characters)
- No text
- No watermarks
- Plain [AMBIENTE] background to clearly showcase the character
```

#### Exemplo real da documentação (herói da floresta)

```
Create a children's book illustration introducing a main character.

Character:
A young, storybook-style hero inspired by a little forest outlaw,
wearing a simple green hooded tunic, soft brown boots, and a small belt pouch.
The character has a kind expression, gentle eyes, and a brave but warm demeanor.
Carries a small wooden bow used only for helping, never harming.

Theme:
The character protects and rescues small forest animals like squirrels, birds, and rabbits.

Style:
Children's book illustration, hand-painted watercolor look,
soft outlines, warm earthy colors, whimsical and friendly.
Proportions suitable for picture books (slightly oversized head, expressive face).

Constraints:
- Original character (no copyrighted characters)
- No text
- No watermarks
- Plain forest background to clearly showcase the character
```

**Parâmetros:** `size: 1024x1536` | `quality: medium`

---

### Etapa 2 — Continuar a História (Edição com personagem âncora como input)

> Use a imagem gerada na Etapa 1 como input.

```
Continue the children's book story using the same character.

Scene:
[NOVA CENA]

Character Consistency:
- Same [ELEMENTO 1]
- Same facial features, proportions, and color palette
- Same [PERSONALIDADE] personality

Style:
Children's book [TÉCNICA] illustration,
[LUZ], [AMBIENTE],
[MOOD] mood.

Constraints:
- Do not redesign the character
- No text
- No watermarks
```

#### Exemplo real da documentação (cena na neve)

```
Continue the children's book story using the same character.

Scene:
The same young forest hero is gently helping a frightened squirrel
out of a fallen tree after a winter storm.
The character kneels beside the squirrel, offering reassurance.

Character Consistency:
- Same green hooded tunic
- Same facial features, proportions, and color palette
- Same gentle, heroic personality

Style:
Children's book watercolor illustration,
soft lighting, snowy forest environment,
warm and comforting mood.

Constraints:
- Do not redesign the character
- No text
- No watermarks
```

**Parâmetros:** `size: 1024x1536` | `quality: medium`

---

## Dica geral — Seção 6

Todos esses use cases se beneficiam de prompts escritos como **briefs criativos detalhados**, não specs técnicas. Quanto mais contexto narrativo e emocional você der, mais o modelo produz resultados com coerência visual e intenção estética.
