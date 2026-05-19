---
name: meta-andromeda
description: |
  Cria kits completos de anúncios para Meta (Facebook/Instagram) baseados no motor de IA Andrômeda,
  que usa o criativo como principal vetor de segmentação. Use quando precisar gerar copy de anúncios
  para Meta Ads com diversidade criativa genuína por ângulo, nível de consciência e posição no funil
  (topo ou fundo), para qualquer formato: feed estático, Reels/Stories ou carrossel.
---

# Skill: Criação de Anúncios para Meta (Motor Andrômeda)

> Este skill orienta a criação de anúncios para Meta (Facebook/Instagram) baseados no motor de IA **Meta Andrômeda**. O Andrômeda usa o **criativo como principal vetor de segmentação** — ele lê o conteúdo do anúncio e decide para quem entregá-lo. Por isso, diversidade criativa genuína (não variação superficial de texto) é o principal fator de performance. Cada kit deve ativar uma combinação única de ângulo, nível de consciência e posição no funil.

> **Idioma obrigatório:** Todo output deve ser escrito em **português do Brasil (PT-BR)**, independentemente do idioma da URL fornecida.

---

## Fluxo de Trabalho Obrigatório

O processo deve seguir rigorosamente estes passos sequenciais. **Nunca pule etapas nem agrupe passos.**

---

### Passo 1: Coleta de Configuração Inicial

Antes de qualquer análise, pergunte ao usuário:

- ✅ **URL do negócio:** Site principal ou landing page do produto/serviço.
- ✅ **URL do produto** (se diferente da home): Página específica do que será anunciado.
- ✅ **Quantidade de kits:** Quantos kits de anúncios serão gerados.
- ✅ **Posição no funil:** Os anúncios são de **TOPO** (criação de demanda, público frio) ou **FUNDO** (captura/conversão, público que já conhece a marca)?
- ✅ **Formato do criativo:** Arte estática no feed, Reels/Stories (vídeo) ou carrossel?
- ✅ **Objetivo da CTA:** Compra direta, captura de lead, acesso a link na bio, mensagem no WhatsApp?
- ✅ **Categoria sensível:** O negócio atua em saúde, finanças, educação com promessa de resultado, política ou qualquer categoria com restrição Meta? (Sim/Não)

---

### Passo 2: Análise da URL via Web Fetch

Use a ferramenta `web_fetch` para acessar as URLs fornecidas. **Não assuma informações — extraia diretamente da página.** Colete obrigatoriamente:

- ✅ **Headline principal da página** (H1 ou frase de destaque acima da dobra)
- ✅ **Proposta de valor central** (o que o negócio promete entregar)
- ✅ **Benefícios listados** (bullets, seções de vantagens, itens de checklist na página)
- ✅ **Provas sociais** (depoimentos, números, cases, selos, certificações)
- ✅ **Objeções tratadas** (FAQs, seções "por que escolher", garantias)
- ✅ **CTA da página** (qual ação o site pede ao visitante)
- ✅ **Preço ou oferta visível** (se houver)

Se a URL não puder ser acessada, informe o usuário e solicite que cole o conteúdo manualmente.

---

### Passo 3: Kit Zero — Planejamento e Validação

**Antes de escrever qualquer copy**, apresente ao usuário o planejamento dos kits usando a Matriz de Diversidade Criativa abaixo. Para cada kit proposto, exiba:

```
Kit [N]
├── Persona-alvo: [quem será impactado]
├── Ângulo criativo: [qual ângulo da matriz]
├── Nível de consciência: [1 a 5]
├── Posição no funil: [TOPO / FUNDO]
├── Formato de hook: [tipo de abertura]
└── Promessa central: [em uma frase]
```

**Aguarde aprovação explícita do usuário antes de avançar para a geração das copys.** Isso evita que todos os kits sejam refeitos por erro de alinhamento na persona ou no ângulo.

---

### Passo 4: Geração dos Kits com Matriz de Diversidade

Após aprovação do Kit Zero, gere os kits completos respeitando rigorosamente as combinações definidas. Use o template de output fixo descrito na seção **Estrutura de Entrega**.

---

## Matriz de Diversidade Criativa

Cada kit deve usar uma combinação **única e explícita** dos três eixos abaixo. Nunca repita o mesmo ângulo em kits diferentes dentro do mesmo lote.

### Eixo 1 — Nível de Consciência da Persona

| Nível | Estado da Persona | Abordagem de Copy |
|-------|-------------------|-------------------|
| 1 | Não sabe que tem o problema | Ative a dor com um cenário real antes de mencionar qualquer solução |
| 2 | Sabe que tem o problema, não conhece soluções | Apresente a categoria de solução, não o produto |
| 3 | Conhece soluções, não conhece o produto | Compare o produto com alternativas, destaque diferencial |
| 4 | Conhece o produto, ainda não se convenceu | Quebre objeções específicas, use prova social e garantia |
| 5 | Pronto para comprar, precisa de gatilho | Foco total na oferta, urgência, CTA direta |

### Eixo 2 — Ângulo Criativo

| Ângulo | Foco | Quando usar |
|--------|------|-------------|
| **Dor Imediata** | Problema que o público vive agora | Níveis 1 e 2 — TOPO |
| **Desejo/Aspiração** | Vida ou resultado desejado | Níveis 2 e 3 — TOPO e MEIO |
| **Prova Social** | Resultado real de terceiros | Níveis 3 e 4 — MEIO |
| **Quebra de Objeção** | Barreira que impede a compra | Níveis 4 e 5 — MEIO e FUNDO |
| **Transformação/Identidade** | Mudança de quem a persona é ou quer ser | Qualquer nível — tom aspiracional |
| **Curiosidade/Revelação** | Informação que a persona não esperava | Níveis 1 e 2 — TOPO |
| **Urgência/Escassez** | Janela de tempo ou disponibilidade limitada | Nível 5 — FUNDO |

### Eixo 3 — Formato de Hook

| Formato | Exemplo estrutural |
|---------|-------------------|
| **Pergunta direta** | "Você ainda [problema]?" |
| **Afirmação polêmica** | "A maioria dos [público] está [erro comum]." |
| **Dado ou estatística** | "[X%] dos [público] nunca conseguiu [resultado] por causa de [motivo]." |
| **Comando direto** | "Pare de [comportamento negativo] agora." |
| **Narrativa/história** | "Em [situação], [persona] descobriu que [insight]." |

---

## Estrutura de Entrega por Posição no Funil

### Anúncios de TOPO (Criação de Demanda — Público Frio)

Objetivo: gerar consciência e ativar o interesse. A pessoa não está procurando o produto.

- **Hook:** deve conectar com a dor ou aspiração **sem mencionar o produto nos primeiros dois parágrafos**
- **Desenvolvimento:** contextualize o problema, valide a dor, apresente a possibilidade de solução
- **CTA:** suave — "Saiba mais", "Descubra como", "Veja o que mudou para quem decidiu agir"
- **Tom:** educativo, provocador ou inspiracional — nunca vendedor direto
- **Checklist:** foque em benefícios de vida/resultado, não em atributos do produto

### Anúncios de FUNDO (Captura/Conversão — Público Quente)

Objetivo: converter quem já conhece a marca ou solução. A pessoa está próxima da decisão.

- **Hook:** pode mencionar o produto diretamente — o público já sabe do que se trata
- **Desenvolvimento:** quebre a última objeção, reforce a prova social, detalhe a oferta
- **CTA:** direta e com fricção baixa — "Toque em 'Comprar agora'", "Garanta sua vaga", "Acesse com desconto hoje"
- **Tom:** assertivo, com urgência e foco em oferta
- **Checklist:** foque em quebras de objeção, garantias e diferenciais do produto vs. alternativas

---

## Estrutura de Entrega por Formato de Placement

### Feed Estático (Arte + Legenda)

- A **headline da arte gráfica** é o elemento de maior impacto — deve funcionar sozinha sem a legenda
- A legenda aprofunda e converte
- Títulos curtos (campo "Título" da Meta): máximo 40 caracteres, complementam a arte

### Reels e Stories (Vídeo Vertical)

- O **hook deve estar nos primeiros 3 segundos** do roteiro em voz — não apenas no texto sobreposto
- A legenda do vídeo funciona como reforço, não como principal argumento
- CTA falada no roteiro E CTA visual no último frame
- Evite texto longo sobreposto — priorize narração e legenda do vídeo

### Advantage+ Placement (Padrão Andrômeda)

- O criativo será redistribuído automaticamente entre feed, Stories, Reels e Audience Network
- O **headline da arte e o primeiro parágrafo da legenda** são os únicos elementos garantidos em todos os placements
- Gere a copy priorizando que esses dois elementos funcionem independentemente do resto

### Carrossel

- **Primeiro card:** hook visual que force o deslize — pergunta, dado surpreendente ou afirmação polêmica
- **Cards intermediários:** um benefício ou prova por card — nunca sobrecarregue
- **Último card:** CTA exclusiva, sem novo conteúdo informativo

---

## Template de Output Fixo por Kit

Use obrigatoriamente este formato para cada kit gerado. A padronização permite comparação entre sessões e uso em equipe.

---

```
## Kit [N] | Ângulo: [Nome do Ângulo] | Funil: [TOPO / FUNDO] | Nível de Consciência: [1–5]
**Persona-alvo:** [descrição em uma linha]

---

### PARTE 1 — Copy para Arte Gráfica

**Headline Principal:** [texto curto, impacto imediato]
**Headline Complementar:** [apoio à principal]
**CTA da Arte:** [chamada para ação curta]

---

### PARTE 2 — Copy para Legenda (Meta Ads)

#### Títulos (campo Título da Meta)
> T1 [Título pareado com D1 e D2]: [texto]
> T2 [Título pareado com D3]: [texto]
> T3 [Título pareado com D4 e D5]: [texto]

#### Descrições

**D1 — Hook: [formato de hook usado]**
[Texto completo da descrição com gancho, desenvolvimento, checklist e CTA]

✓ [Benefício ou quebra de objeção 1]
✓ [Benefício ou quebra de objeção 2]
✓ [Benefício ou quebra de objeção 3]
✓ [Benefício ou quebra de objeção 4]

👉🏻 [CTA final com "Toque"]

---

**D2 — Hook: [formato de hook usado]**
[Texto completo]

---

**D3 — Hook: [formato de hook usado]**
[Texto completo]

---

**D4 — Hook: [formato de hook usado]**
[Texto completo]

---

**D5 — Hook: [formato de hook usado]**
[Texto completo]

---

#### Lógica de Pareamento Recomendada
- T1 + D1: [por que combinam — tom e ângulo alinhados]
- T1 + D2: [por que combinam]
- T2 + D3: [por que combinam]
- T3 + D4: [por que combinam]
- T3 + D5: [por que combinam]
```

---

## Lógica de Pareamento — Títulos e Descrições

O campo "Título" da Meta aparece abaixo da imagem no feed e é combinado automaticamente com as descrições pelo Andrômeda. Para maximizar a performance:

- Cada título deve ser testável com no mínimo 1 e no máximo 2 descrições — não crie combinações genéricas que "funcionam com tudo"
- O título deve **complementar**, não repetir, o hook da descrição
- Se a descrição abre com dor, o título deve reforçar a promessa de solução
- Se a descrição abre com aspiração, o título deve ancorar em resultado concreto
- Documente a lógica de cada par no campo "Lógica de Pareamento Recomendada" do template

---

## Compliance e Restrições

### Idioma
Todo output deve ser escrito em **português do Brasil**. Expressões em inglês são permitidas apenas se forem jargão do mercado amplamente reconhecido (ex: "ROI", "lead", "funil").

### Categorias Sensíveis da Meta
Se o negócio atuar em qualquer uma das categorias abaixo, aplique as restrições correspondentes em **todos os kits**:

| Categoria | Restrição |
|-----------|-----------|
| Saúde e bem-estar | Proibido garantir resultados ("você vai emagrecer X kg"). Use "pode ajudar", "contribui para" |
| Finanças e investimentos | Proibido prometer retorno financeiro. Evite "ganhe dinheiro", "lucro garantido" |
| Educação com promessa de resultado | Evite "você vai ganhar X por mês". Prefira "alunos relatam" + depoimento real |
| Política e causas sociais | Não use linguagem que implique endosso político |
| Clínicas e reabilitação | Evite palavras gatilho: "vício", "dependência", "cura". Use "tratamento", "apoio", "recuperação" |

Se a categoria sensível for identificada no Passo 1, alerte o usuário antes de gerar qualquer copy.

---

## Diretrizes de Copywriting

**CTAs — Regra obrigatória:** sempre use **"Toque"** no lugar de "Clique" (ex: *"Toque em 'Saiba mais'"*). A CTA deve ser sempre o último elemento da descrição ou do card.

**Estruturas recomendadas por funil:**
- TOPO: PAS (Problema → Agitação → Solução) ou Story (Narrativa → Identificação → Convite)
- FUNDO: AIDA (Atenção → Interesse → Desejo → Ação) ou Oferta Direta (Proposta → Prova → CTA)

**Ícones estratégicos permitidos:** `✓`, `🚀`, `👉🏻`, `💎`, `⚡`, `📌` — use com critério, máximo 1 por parágrafo.

---

## Referências

Para contexto estratégico sobre o motor Andrômeda (tecnologia, mindset do anunciante, estrutura de campanha), consulte:

📄 `meta_andromeda.md`
