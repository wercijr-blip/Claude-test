# Edição de Imagens — GPT Image Models

> Fonte: OpenAI GPT Image Generation Models Prompting Guide — Seções 5.1 a 5.9

## Quando usar este guia
Style transfer, virtual try-on (troca de roupa), sketch para foto, compositing, remoção de objetos, inserção de pessoa em cena, transformação de iluminação/clima, múltiplos inputs.

> **Importante:** Todos os casos aqui usam a **função de edição** (edit), não geração — você precisa de uma ou mais imagens de input.

---

## Índice rápido

| O que você quer fazer | Seção |
|---|---|
| Aplicar o estilo de uma imagem em outra | Style Transfer |
| Trocar a roupa de uma pessoa | Virtual Try-On |
| Transformar um desenho em foto realista | Sketch → Foto |
| Remover um objeto de uma foto | Remoção de Objeto |
| Inserir uma pessoa em uma cena diferente | Pessoa em Cena |
| Combinar elementos de duas imagens | Compositing |
| Mudar iluminação, clima ou hora do dia | Transformação de Ambiente |

---

## Style Transfer

> "Describe what must stay consistent (style cues) and what must change (new content), and add hard constraints like background, framing, and 'no extra elements' to prevent drift."

```
Use the same style from the input image and generate [DESCRIÇÃO DO NOVO SUJEITO/CENA] on a [FUNDO — ex: white background].
```

### Exemplo real da documentação

```
Use the same style from the input image and generate a man riding a motorcycle on a white background.
```

**Parâmetros:** `size: 1024x1536` | `quality: medium`

---

## Virtual Try-On (Troca de Roupa)

> "Explicitly lock the person (face, body shape, pose, hair, expression) and allow changes only to garments, then require realistic fit (draping, folds, occlusion) plus consistent lighting/shadows."

```
Edit the image to dress the [person] using the provided clothing images. Do not change [his/her] face, facial features, skin tone, body shape, pose, or identity in any way. Preserve [his/her] exact likeness, expression, hairstyle, and proportions. Replace only the clothing, fitting the garments naturally to [his/her] existing pose and body geometry with realistic fabric behavior. Match lighting, shadows, and color temperature to the original photo so the outfit integrates photorealistically, without looking pasted on. Do not change the background, camera angle, framing, or image quality, and do not add accessories, text, logos, or watermarks.
```

> Use múltiplas imagens de input: 1 foto da pessoa + fotos de cada peça de roupa.

**Parâmetros:** `size: 1024x1536` | `quality: medium`

---

## Sketch → Foto Realista (Rendering)

> "Treat the prompt like a spec: preserve layout and perspective, then add realism by specifying plausible materials, lighting, and environment. Include 'do not add new elements/text' to avoid creative reinterpretations."

```
Turn this drawing into a photorealistic image.
Preserve the exact layout, proportions, and perspective.
Choose realistic materials and lighting consistent with the sketch intent.
Do not add new elements or text.
```

**Parâmetros:** `size: 1024x1536` | `quality: medium`

---

## Remoção de Objeto

```
Remove the [OBJETO — ex: flower from man's hand]. Do not change anything else.
```

### Exemplo real da documentação

```
Remove the flower from man's hand. Do not change anything else.
```

> Para remoções com maior fidelidade ao original, use `input_fidelity: high` (disponível no gpt-image-1.5).

**Parâmetros:** `size: 1024x1536` | `quality: medium`

---

## Inserção de Pessoa em Cena

> "Anchor realism by specifying a grounded photographic look (natural lighting, believable detail, no cinematic grading), and lock what must not change about the subject."

```
Generate a highly realistic [TIPO DE CENA] where this person is [AÇÃO]. The image should look like a real photograph someone could have taken, not an overly enhanced or cinematic movie-poster image.
[DESCRIÇÃO DA PESSOA].
The [AMBIENTE]. The time of day is [HORA], with natural lighting and realistic colors. Everything should feel grounded, authentic, and unstyled, as if captured in a real moment. Avoid cinematic lighting, dramatic color grading, or stylized composition.
```

**Parâmetros:** `size: 1024x1536` | `quality: medium`

---

## Compositing — Combinar Elementos de Múltiplas Imagens

> "Clearly specify what to transplant, where it should go, and what must remain unchanged, while matching lighting, perspective, scale, and shadows."

```
Place the [ELEMENTO] from the [NÚMERO] image into the setting of image [NÚMERO], [POSICIONAMENTO], use the same style of lighting, composition and background. Do not change anything else.
```

### Exemplo real da documentação

```
Place the dog from the second image into the setting of image 1, right next to the woman, use the same style of lighting, composition and background. Do not change anything else.
```

> Referencie os inputs por número e descrição: "Image 1: ...", "Image 2: ..."

**Parâmetros:** `size: 1024x1536` | `quality: medium`

---

## Transformação de Ambiente (Iluminação, Clima, Hora do Dia)

> "Change only environmental conditions—lighting direction/quality, shadows, atmosphere, precipitation, and ground wetness—while preserving identity, geometry, camera angle, and object placement."

```
Make it look like [NOVA CONDIÇÃO — ex: a winter evening with snowfall / golden hour at sunset / a rainy night].
```

### Exemplo real da documentação

```
Make it look like a winter evening with snowfall.
```

> Use `input_fidelity: high` para manter maior fidelidade ao original durante edições grandes de ambiente (disponível no gpt-image-1.5).

**Parâmetros:** `size: manter o mesmo do original` | `quality: medium`

---

## Edição de Interiores — Troca de Elemento (Precision Edit)

> "Swap a single object while preserving camera angle, lighting, shadows, and surrounding context so the edit looks like a real photograph, not a redesign."

```
In this room photo, replace ONLY [ELEMENTO ORIGINAL] with [NOVO ELEMENTO].
Preserve camera angle, room lighting, floor shadows, and surrounding objects.
Keep all other aspects of the image unchanged.
Photorealistic contact shadows and [MATERIAL] texture.
```

### Exemplo real da documentação (troca de cadeiras)

```
In this room photo, replace ONLY white with chairs made of wood.
Preserve camera angle, room lighting, floor shadows, and surrounding objects.
Keep all other aspects of the image unchanged.
Photorealistic contact shadows and fabric texture.
```

**Parâmetros:** `size: 1536x1024` | `quality: medium`

---

## Regra de ouro para edições

Para toda edição, use sempre esta estrutura:
- **"Change only X"** — o que deve mudar
- **"Keep everything else the same"** — o que deve ser preservado
- Repita a lista de preservação em cada iteração para evitar drift
