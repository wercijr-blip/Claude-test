---
name: image-prompt-generator
description: Gera prompts otimizados para geração e edição de imagens com os modelos GPT Image da OpenAI (gpt-image-2). Use esta skill SEMPRE que a Deborah quiser criar imagens com IA, gerar prompts para o ChatGPT ou DALL-E, precisar de ajuda com geração de logo, infográfico, foto de produto, mockup de UI, anúncio, foto realista, imagem educacional, edição de imagem, style transfer, compositing, tradução de imagem, comic strip, livro infantil, merch, cartão, ou qualquer outro tipo de visual. Acione também quando ela disser "quero gerar uma imagem de", "me ajuda a criar um prompt pra imagem", "quero fazer um logo no ChatGPT", "como peço pra IA gerar X", ou qualquer variação sobre criação de imagens com IA.
---

# Image Prompt Generator

Skill para gerar prompts estruturados e otimizados para os modelos GPT Image da OpenAI, com base no guia oficial de prompting do gpt-image-2.

## Fluxo de uso

1. **Identifica o modo** (geração ou edição — ver abaixo)
2. **Identifica o tipo de imagem** pelo índice
3. **Lê o arquivo de referência** correspondente
4. **Faz perguntas de elicitação** específicas para aquele tipo
5. **Gera o prompt final** + parâmetros recomendados

---

## Modo: Geração vs. Edição

**Antes de tudo, identifique o modo:**

| Modo | Quando usar | O que o usuário precisa ter |
|---|---|---|
| **Geração** (text → image) | Criar algo do zero, sem imagem de referência | Nada — só o prompt |
| **Edição** (text + image → image) | Modificar, combinar ou transformar uma imagem existente | Uma ou mais imagens de input |

> Se o usuário não tem imagem de input → **Geração**
> Se o usuário quer mudar/combinar imagens que já tem → **Edição**

---

## Índice completo — qual arquivo ler

### 🟢 Geração (text → image)

| Use Case | Tipo de imagem | Arquivo |
|---|---|---|
| 4.1 | Infográfico, diagrama, timeline, poster explicativo | `references/infographic.md` |
| 4.3 | Foto realista, retrato, cena fotográfica | `references/photorealism.md` |
| 4.4 | Cenas históricas ou com world knowledge | `references/photorealism.md` |
| 4.5 | Logo, marca, identidade visual | `references/logo.md` |
| 4.6 | Anúncio, ad, campanha, marketing criativo | `references/ads.md` |
| 4.7 | Comic strip, tira em quadrinhos, narrativa em painéis | `references/comic.md` |
| 4.8 | Mockup de UI, tela de app, interface | `references/ui-mockup.md` |
| 4.9 / 4.10 | Visual educacional, científico, slide, pitch deck | `references/educational.md` |
| 6.2 | Cartão comemorativo 3D, holiday card | `references/additional-use-cases.md` |
| 6.3 | Colecionável, action figure, merch concept | `references/additional-use-cases.md` |

### 🔵 Edição (text + image → image)

| Use Case | O que fazer | Arquivo |
|---|---|---|
| 4.2 | Traduzir texto de uma imagem para outro idioma | `references/translation.md` |
| 5.1 | Aplicar o estilo de uma imagem em outra | `references/editing.md` |
| 5.2 | Trocar a roupa de uma pessoa (virtual try-on) | `references/editing.md` |
| 5.3 | Transformar um desenho/sketch em foto realista | `references/editing.md` |
| 5.4 | Extrair produto com fundo limpo (packshot) | `references/product.md` |
| 5.5 | Colocar produto em cenário com texto de marketing | `references/ads.md` |
| 5.6 | Mudar iluminação, clima ou hora do dia | `references/editing.md` |
| 5.7 | Remover um objeto de uma foto | `references/editing.md` |
| 5.8 | Inserir pessoa em uma cena diferente | `references/editing.md` |
| 5.9 | Combinar elementos de múltiplas imagens | `references/editing.md` |
| 6.1 | Trocar móvel/decoração em foto de ambiente | `references/additional-use-cases.md` |
| 6.4 | Livro infantil com personagem consistente | `references/additional-use-cases.md` |

### ⚙️ Parâmetros e modelos

| Dúvida | Arquivo |
|---|---|
| Qual modelo usar, tamanhos, quality settings | `references/models.md` |
| Princípios gerais de prompting | `references/fundamentals.md` |

---

## Perguntas de elicitação universal

Se o tipo ainda não estiver claro, faça **no máximo 2 perguntas**:

1. **O que você quer criar/modificar?** (objeto, cena ou conceito principal)
2. **Você tem uma imagem de referência para usar como base?** (define se é geração ou edição)

Depois de identificar o tipo → leia o arquivo correto e faça as perguntas específicas de lá.

---

## Output padrão

Sempre entregue o resultado neste formato:

```
📋 PROMPT
[prompt completo aqui]

⚙️ PARÂMETROS RECOMENDADOS
- Model: gpt-image-2
- Modo: Geração / Edição
- Size: [ex: 1024x1536]
- Quality: [low / medium / high]

💡 DICA
[observação curta e relevante sobre este tipo de imagem, se houver]
```

---

## Princípios gerais (sempre aplicar)

Leia `references/fundamentals.md` se precisar de orientação sobre estrutura de prompt, especificidade, composição, texto em imagens, ou iteração. Para a maioria dos casos, os arquivos específicos já têm tudo que é necessário.
