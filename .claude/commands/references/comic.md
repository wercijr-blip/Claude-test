# Story-to-Comic Strip — GPT Image Models

> Fonte: OpenAI GPT Image Generation Models Prompting Guide — Seção 4.7

## Quando usar este guia
Criar tiras em quadrinhos, comic strips, Reels em formato visual sequencial, histórias em painéis, narrativas visuais com múltiplas cenas.

---

## Princípios-chave (da documentação oficial)

> "For story-to-comic generation, define the narrative as a sequence of clear visual beats, one per panel. Keep descriptions concrete and action-focused so the model can translate the story into readable, well-paced panels."

- Defina a narrativa como uma **sequência de beats visuais claros**, um por painel
- Mantenha as descrições **concretas e focadas em ação**
- Especifique o número de painéis e a orientação (vertical, horizontal)
- Descreva cada painel separadamente com ação e composição específica
- Evite descrições abstratas — o modelo precisa de ações visíveis, não sentimentos

---

## Elicitação — perguntas a fazer

1. **Qual é a história/ideia?** (resumo em 1-2 frases)
2. **Quantos painéis?** (padrão: 4)
3. **Personagem(s)** (descrição visual do protagonista)
4. **Estilo visual** (ex: cartoon, manga, aquarela, minimalista, livro infantil)
5. **Orientação** (vertical para Reel/Stories, horizontal para tira clássica)

---

## Template de prompt

```
Create a short vertical comic-style [FORMATO — ex: reel / strip] with [NÚMERO] equal-sized panels.
Panel 1: [BEAT 1 — ação concreta, composição, o que o personagem está fazendo, expressão]
Panel 2: [BEAT 2 — ação concreta, o que muda, reação]
Panel 3: [BEAT 3 — clímax ou desenvolvimento]
Panel 4: [BEAT 4 — resolução ou punch line]
```

### Exemplo real da documentação (pet sozinho em casa)

```
Create a short vertical comic-style reel with 4 equal-sized panels.
Panel 1: The owner leaves through the front door. The pet is framed in the window behind them, small against the glass, eyes wide, paws pressed high, the house suddenly quiet.
Panel 2: The door clicks shut. Silence breaks. The pet slowly turns toward the empty house, posture shifting, eyes sharp with possibility.
Panel 3: The house transformed. The pet sprawls across the couch like it owns the place, crumbs nearby, sunlight cutting across the room like a spotlight.
Panel 4: The door opens. The pet is seated perfectly by the entrance, alert and composed, as if nothing happened.
```

---

## Parâmetros recomendados

- **Model:** `gpt-image-2`
- **Size:** `1024x1536` (vertical — ideal para Reels e Stories)
- **Quality:** `medium`

---

## Dicas adicionais

- **Para personagens consistentes entre painéis**: descreva o personagem da mesma forma em cada painel — "the same orange tabby cat", não apenas "the cat"
- **Para punch line visual forte**: o painel 4 deve ter uma ação que subverta ou complete a expectativa criada nos painéis anteriores
- **Para estilo específico**: adicione no início do prompt — "in a clean cartoon style", "in a Japanese manga style", "in a warm watercolor children's book style"
- **Para histórias mais longas**: gere em blocos de 4 painéis usando a função de edição para manter consistência de personagem
