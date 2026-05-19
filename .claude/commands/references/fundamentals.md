# Fundamentos de Prompting — GPT Image Models

> Fonte: OpenAI GPT Image Generation Models Prompting Guide

## Estrutura de um bom prompt

Escreva os prompts sempre nesta ordem:
**fundo/cena → sujeito → detalhes-chave → restrições**

Inclua o uso pretendido (ad, UI mock, infográfico) para definir o "modo" e nível de polish.

Para pedidos complexos, use segmentos curtos com labels ou quebras de linha em vez de um parágrafo longo.

---

## Formato do prompt

Funciona bem: prompts mínimos, parágrafos descritivos, estilo instrução, estrutura com tags. O que importa é que a intenção e as restrições estejam claras. Em produção, priorize um template legível sobre sintaxe elaborada.

---

## Especificidade e qualidade

- Seja concreto sobre materiais, formas, texturas e o meio visual (foto, aquarela, render 3D)
- Adicione "quality levers" só quando necessário: *film grain*, *textured brushstrokes*, *macro detail*
- Para fotorrealismo: inclua a palavra **"photorealistic"** diretamente no prompt
- Frases como *"real photograph"*, *"taken on a real camera"*, *"professional photography"*, *"iPhone photo"* também ajudam
- Specs técnicas de câmera podem ser interpretadas de forma ampla — use principalmente para look geral e composição

---

## Composição

- Especifique enquadramento e ponto de vista: close-up, wide, top-down
- Perspectiva/ângulo: eye-level, low-angle
- Iluminação/mood: soft diffuse, golden hour, high-contrast
- Se o layout importa, declare o posicionamento: "logo top-right", "subject centered with negative space on left"
- Para cenas wide, cinemáticas, com pouca luz, chuva ou neon: adicione detalhes extras sobre escala, atmosfera e cor

---

## Pessoas, pose e ação

Para pessoas em cenas, descreva:
- Escala e enquadramento do corpo: "full body visible, feet included"
- Dimensão relativa: "child-sized relative to the table"
- Direção do olhar: "looking down at the open book, not at the camera"
- Interação com objetos: "hands naturally gripping the handlebars"

Esses detalhes ajudam com proporção corporal, geometria de ação e alinhamento do olhar.

---

## Restrições — o que mudar vs. preservar

- Declare exclusões e invariantes explicitamente: "no watermark", "no extra text", "no logos/trademarks", "preserve identity/geometry/layout/brand elements"
- Para edições: use "change only X" + "keep everything else the same"
- Repita a lista de preservação em cada iteração para reduzir drift
- Para edições cirúrgicas: diga também para não alterar saturação, contraste, layout, setas, labels, ângulo de câmera ou objetos ao redor

---

## Texto em imagens

- Coloque o texto literal **entre aspas** ou em **CAIXA ALTA**
- Especifique tipografia: estilo de fonte, tamanho, cor, posicionamento
- Para palavras difíceis (nomes de marca, grafias incomuns): soletre letra por letra
- Use `quality: medium` ou `high` para texto pequeno, painéis de informação densa, layouts multi-fonte

---

## Múltiplas imagens de input (edição)

- Referencie cada input por **índice e descrição**: "Image 1: product photo… Image 2: style reference…"
- Descreva como elas interagem: "apply Image 2's style to Image 1"
- Para compositing: seja explícito sobre o que vai para onde: "put the bird from Image 1 on the elephant in Image 2"

---

## Iterar em vez de sobrecarregar

- Prompts longos podem funcionar, mas é mais fácil debugar começando com um prompt base limpo e refinando com pequenas mudanças: "make lighting warmer", "remove the extra tree", "restore the original background"
- Use referências como "same style as before" ou "the subject" para aproveitar o contexto
- Mas re-especifique detalhes críticos se eles começarem a driftar

---

## Latência vs. fidelidade

| Situação | Quality recomendado |
|---|---|
| Volume alto, experimentação, rascunhos | `low` |
| Uso geral, maioria dos casos | `medium` |
| Texto pequeno ou denso, infográficos detalhados, retratos close-up, edições com identidade, alta resolução | `high` |
