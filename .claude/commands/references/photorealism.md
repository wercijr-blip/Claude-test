# Fotorrealismo — GPT Image Models

> Fonte: OpenAI GPT Image Generation Models Prompting Guide — Seção 4.3 e 4.4

## Quando usar este guia
Fotos realistas, retratos, cenas fotográficas, pessoas em ambientes, fotos de estilo "capturado no momento", world knowledge scenes.

---

## Princípios-chave (da documentação oficial)

> "To get believable photorealism, prompt the model as if a real photo is being captured in the moment. Use photography language (lens, lighting, framing) and explicitly ask for real texture (pores, wrinkles, fabric wear, imperfections). Avoid words that imply studio polish or staging."

- Escreva o prompt como se uma foto real estivesse sendo tirada
- Use linguagem fotográfica: lente, iluminação, enquadramento
- Peça **texturas reais**: poros, rugas, desgaste de tecido, imperfeições
- Evite palavras que sugiram polish de estúdio ou staging artificial
- Use `quality: high` quando o detalhe importa
- Inclua a palavra **"photorealistic"** diretamente no prompt para ativar o modo fotorrealista do modelo
- Frases como *"real photograph"*, *"taken on a real camera"*, *"professional photography"*, *"iPhone photo"* também ajudam

---

## Elicitação — perguntas a fazer

1. **Sujeito principal** (quem ou o quê está na foto?)
2. **Ambiente/cena** (onde está? tipo de lugar, hora do dia)
3. **Enquadramento** (close-up, medium shot, full body, wide?)
4. **Estilo fotográfico** (candid/espontâneo, editorial, documental, iPhone, filme 35mm?)
5. **Ação ou pose** (o que a pessoa/objeto está fazendo?)
6. **Mood/iluminação** (luz natural, golden hour, luz difusa, noturno?)

---

## Template de prompt

```
Create a photorealistic [TIPO — ex: candid photograph / portrait / scene] of [SUJEITO PRINCIPAL].
[DETALHES FÍSICOS].
[AÇÃO/POSE].
Shot like a [ESTILO], [ENQUADRAMENTO], using a [LENTE].
[ILUMINAÇÃO], [PROFUNDIDADE], [TEXTURA], [COR].
The image should feel [MOOD], with real skin texture, worn materials, and everyday detail.
No glamorization, no heavy retouching.
```

### Exemplo real da documentação (marinheiro)

```
Create a photorealistic candid photograph of an elderly sailor standing on a small fishing boat.
He has weathered skin with visible wrinkles, pores, and sun texture, and a few faded traditional sailor tattoos on his arms.
He is calmly adjusting a net while his dog sits nearby on the deck. Shot like a 35mm film photograph, medium close-up at eye level, using a 50mm lens.
Soft coastal daylight, shallow depth of field, subtle film grain, natural color balance.
The image should feel honest and unposed, with real skin texture, worn materials, and everyday detail. No glamorization, no heavy retouching.
```

---

## World Knowledge — cenas históricas e contextuais

O gpt-image-2 tem conhecimento de mundo e pode inferir contexto. Por exemplo: ao pedir uma cena em Bethel, Nova York, em agosto de 1969, ele infere Woodstock sem precisar ser dito explicitamente.

### Template de prompt — World Knowledge

```
Create a realistic [TIPO DE CENA] in [LOCAL], on [DATA].
Photorealistic, period-accurate [ELEMENTOS — ex: clothing, staging, and environment].
```

### Exemplo real da documentação (Woodstock)

```
Create a realistic outdoor crowd scene in Bethel, New York on August 16, 1969.
Photorealistic, period-accurate clothing, staging, and environment.
```

---

## Parâmetros recomendados

- **Model:** `gpt-image-2`
- **Size:** `1024x1536` (retrato/vertical) ou `1536x1024` (paisagem/horizontal)
- **Quality:** `medium` para uso geral; `high` para close-ups de rosto ou quando textura de pele é crítica

---

## Dicas adicionais

- Para **pessoas em ação**: descreva escala, enquadramento do corpo, direção do olhar e interação com objetos — "full body visible, feet included", "looking down at the open book, not at the camera"
- Para **cenas cinemáticas, com pouca luz, chuva ou neon**: adicione detalhes extras sobre escala, atmosfera e cor — o modelo tende a trocar mood por realismo superficial se não houver orientação
- Para **retratos**: especifique se a pessoa olha para a câmera ou não — o default costuma ser olhando para a câmera
