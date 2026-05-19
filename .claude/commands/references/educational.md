# Visuais Educacionais e Científicos — GPT Image Models

> Fonte: OpenAI GPT Image Generation Models Prompting Guide — Seções 4.9 e 4.10

## Quando usar este guia
Diagramas científicos, visuais educacionais, posters de sala de aula, slides com dados, pitch decks, timelines históricas, mapas conceituais, assets para cursos e materiais didáticos.

---

## Princípios-chave (da documentação oficial)

> "Prompt them like an instructional design brief: define the audience, lesson objective, visual format, required labels, and scientific constraints."

- Defina **audiência** (estudantes do ensino médio, executivos, especialistas)
- Defina **objetivo de aprendizado** (o que o viewer deve entender)
- Especifique **formato visual** (diagrama de fluxo, poster, mapa conceitual, slide)
- Liste **componentes obrigatórios** e o que **não deve aparecer**
- Peça sistema visual consistente: ícones no mesmo estilo, setas claras, labels legíveis
- Use `quality: high` para labels densas, diagramas, assets para slides ou materiais impressos
- Fundo branco limpo como padrão; espaço em branco suficiente para escanear o conceito

---

## Elicitação — perguntas a fazer

1. **Disciplina/tema** (biologia, história, produto, negócio, tecnologia)
2. **Audiência** (estudantes, executivos, clientes, público geral)
3. **Formato** (diagrama de processo, timeline, mapa conceitual, slide de dados, poster explicativo)
4. **Título** (se houver — exato)
5. **Componentes obrigatórios** (quais etapas, moléculas, datas, métricas, labels)
6. **Uso final** (sala de aula, apresentação, post em redes sociais, material impresso)

---

## Template de prompt — Diagrama científico/educacional

```
Create a simple [DISCIPLINA] diagram titled "[TÍTULO EXATO]" for [AUDIÊNCIA].

Show [CONCEITO PRINCIPAL]. Include [COMPONENTES].
Use arrows to connect the steps, and label the main [ELEMENTOS]: [LISTA DE LABELS].
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

**Parâmetros:** `size: 1536x1024` | `quality: high`

---

## Template de prompt — Slide de Pitch / Dados / Apresentação

```
Create one [TIPO DE SLIDE] titled "[TÍTULO]" that feels like a real [CONTEXTO].

Use a clean white background, modern sans-serif typography, and a crisp, minimal layout. The slide should include:
* [ELEMENTO VISUAL 1]
* [DADOS]
* [ELEMENTO VISUAL 2]
* [RODAPÉ]
* [ELEMENTO OPCIONAL]

The design should look like [PADRÃO DE QUALIDADE]: highly readable text, clear data hierarchy, polished spacing, and professional visual language.

Avoid clip art, stock photography, gradients, shadows, decorative elements, or anything that feels generic or overdesigned.
```

### Exemplo real da documentação (slide Market Opportunity)

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

**Parâmetros:** `size: 1536x864` | `quality: high`

---

## Parâmetros recomendados por formato

| Formato | Size | Quality |
|---|---|---|
| Diagrama científico | `1536x1024` | `high` |
| Poster educacional | `1024x1536` | `high` |
| Slide de apresentação | `1536x864` | `high` |
| Infográfico explicativo | `1024x1536` | `medium` ou `high` |

- **Model:** sempre `gpt-image-2`

---

## Dicas adicionais

- Para **dados reais em gráficos**: inclua os números diretamente no prompt — o modelo usa os valores exatos quando fornecidos
- Para **labels técnicas**: liste cada label explicitamente; não assuma que o modelo vai incluir o que não está pedido
- Para **consistência de ícones**: diga "use a consistent flat icon style throughout" — isso evita mistura de estilos visuais no mesmo diagrama
- Para **assets que serão impressos ou projetados em tela grande**: sempre use `quality: high` e tamanho máximo compatível com o uso
