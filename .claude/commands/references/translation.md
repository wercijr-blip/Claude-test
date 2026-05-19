# Tradução de Texto em Imagens — GPT Image Models

> Fonte: OpenAI GPT Image Generation Models Prompting Guide — Seção 4.2

## Quando usar este guia
Localizar designs existentes (ads, prints, infográficos, embalagens, screenshots de UI) para outro idioma sem reconstruir o layout do zero.

---

## Princípios-chave (da documentação oficial)

> "The key is to preserve everything except the text—keep typography style, placement, spacing, and hierarchy consistent—while translating verbatim and accurately, with no extra words, no reflow unless necessary, and no unintended edits to logos, icons, or imagery."

- Preservar **tudo** exceto o texto: tipografia, posicionamento, espaçamento, hierarquia
- Traduzir de forma **verbatim e precisa**, sem palavras extras
- Sem reflow de layout a menos que estritamente necessário
- Não editar logos, ícones ou elementos visuais
- **Tipo: Edição** — requer a imagem original como input

---

## Elicitação — perguntas a fazer

1. **Para qual idioma?** (ex: espanhol, português, japonês, francês)
2. **Tem termos específicos que não devem ser traduzidos?** (nomes de marca, termos técnicos)
3. **Algum ajuste de layout permitido se o texto for muito mais longo?** (sim/não)

---

## Template de prompt

```
Translate the text in the [TIPO DE IMAGEM — ex: infographic / ad / packaging] to [IDIOMA].
Do not change any other aspect of the image.
```

> Para ser mais explícito sobre o que preservar:

```
Translate all text in this image to [IDIOMA]. Preserve the exact typography style, font weight, placement, spacing, and visual hierarchy of every text element. Do not alter logos, icons, illustrations, colors, or layout. Translate verbatim and accurately, with no added words or omissions. Do not reflow or redesign the layout.
```

### Exemplo real da documentação (infográfico → espanhol)

```
Translate the text in the infographic to Spanish. Do not change any other aspect of the image.
```

---

## Parâmetros recomendados

- **Model:** `gpt-image-2`
- **Size:** manter o mesmo tamanho da imagem original
- **Quality:** `medium` (use `high` se o original tiver texto pequeno ou denso)

---

## Dicas adicionais

- Para idiomas com textos mais longos (alemão, português vs. inglês): avise no prompt se pode haver reflow mínimo — "minor reflow is acceptable only if text overflows"
- Para idiomas com scripts diferentes (árabe, japonês, hebraico): especifique a direção do texto se necessário — "right-to-left layout for Arabic"
- Se apenas **parte** da imagem deve ser traduzida: especifique exatamente o que — "translate only the title and body text, keep all labels and button text in English"
