# Anúncios e Marketing Criativo — GPT Image Models

> Fonte: OpenAI GPT Image Generation Models Prompting Guide — Seções 4.6 e 5.5

## Quando usar este guia
Geração de ads, campanhas, criativos de redes sociais, fashion shots, imagens com texto de marketing, billboards, conceitos de campanha.

---

## Princípios-chave (da documentação oficial)

> "Ad generation works best when the prompt is written like a creative brief rather than a purely technical image spec. Describe the brand, audience, culture, concept, composition, and exact copy, then let the model make taste-driven creative decisions inside those boundaries."

- Escreva o prompt como um **creative brief**, não uma spec técnica
- Inclua: posicionamento da marca, público-alvo, vibe desejada, cena, tagline
- O modelo interpreta cues de audiência, infere art direction e propõe detalhes visuais
- Se o texto deve aparecer na imagem: coloque **entre aspas** e peça rendering verbatim
- Peça tipografia limpa e legível
- Sem marcas d'água, sem logos extras, sem texto não solicitado

---

## Elicitação — perguntas a fazer

1. **Nome da marca e o que ela faz** (breve)
2. **Público-alvo** (ex: jovens urbanos, executivos, mães, gamers)
3. **Vibe/mood** (ex: energético, premium, nostálgico, minimalista, street)
4. **Cena ou conceito visual** (o que deve aparecer na imagem)
5. **Texto/tagline** que deve aparecer na imagem (exato, se houver)
6. **Formato/uso** (post Instagram, banner, outdoor, story)

---

## Template de prompt — Ad / Fashion Shot

```
Give me a [TIPO — ex: cool in-culture ad / fashion shot] for a brand called [NOME DA MARCA].
It's a [DESCRIÇÃO DA MARCA]. The ad shows [CENA/CONCEITO] with the tagline "[TAGLINE EXATA]."
Make it feel like a polished campaign image for [PÚBLICO]: [ADJETIVOS].
Use clean composition, strong color direction, natural poses, and premium fashion photography cues.
Render the tagline exactly once, clearly and legibly, integrated into the ad layout.
No extra text, no watermarks, no unrelated logos.
```

### Exemplo real da documentação (Thread streetwear)

```
Give me a cool in culture ad / fashion shot for a brand called Thread.
It's a hip young street brand. The ad shows a group of friends hanging out together with the tagline "Yours to Create."
Make it feel like a polished campaign image for a youth streetwear audience: stylish, contemporary, energetic, and tasteful.
Use clean composition, strong color direction, natural poses, and premium fashion photography cues.
Render the tagline exactly once, clearly and legibly, integrated into the ad layout.
No extra text, no watermarks, no unrelated logos.
```

---

## Template de prompt — Marketing criativo com produto + texto em imagem

> Use quando o criativo inclui um produto existente (via imagem de input) e texto de copy na cena.

```
Create a realistic [TIPO DE CENÁRIO — ex: billboard mockup / social media ad] of [PRODUTO] on [AMBIENTE].
Billboard/Ad text (EXACT, verbatim, no extra characters):
"[TEXTO EXATO]"
Typography: [ESTILO — ex: bold sans-serif], high contrast, centered, clean kerning.
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

> **Nota:** Este exemplo usa a função de **edição** (não geração), com uma imagem do produto como input.

---

## Parâmetros recomendados

- **Model:** `gpt-image-2`
- **Size:** `1024x1536` (vertical/stories/posts) ou `1536x1024` (horizontal/banners)
- **Quality:** `medium` para conceitos; `high` quando o texto na imagem precisa ser preciso

---

## Dicas adicionais

- Para **texto na imagem**: se a fidelidade do texto estiver imperfeita, mantenha o prompt estrito e itere — pequenos ajustes de wording ou layout costumam melhorar a legibilidade
- Para **múltiplas variações de campanha**: gere com `n=4` descrevendo variações de cor ou cena
- Para **ads com produto real**: use a função de edição passando a foto do produto como input
- Inclua sempre a palavra **"polished"** ou **"premium"** quando quiser um look de campanha de marca, não de foto casual
