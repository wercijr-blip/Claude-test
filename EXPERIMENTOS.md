# EXPERIMENTOS — Framework de A/B Testing · Facilita PrEP

> Documento vivo. Toda hipótese é registrada aqui antes de ir ao ar.
> Produto: Facilita PrEP · Ticket: R$ 150 · Canais: Meta Ads, Google Ads

---

## 1. Regras do Framework

### Princípios inegociáveis

1. **Um elemento por teste.** Nunca alterar headline E imagem ao mesmo tempo. Se o resultado for positivo, não se sabe o que causou a melhora. Se for negativo, não se sabe o que corrigir.

2. **Mínimo de 100 conversões por variante antes de declarar vencedor.** Não encerrar teste antes disso, independentemente de como o painel estiver mostrando. Dados prematuros geram decisões erradas.

3. **Usar o split test nativo da plataforma — nunca alterações manuais.** Meta: A/B Test de campanha (nível campanha ou conjunto). Google: Experiments (Drafts & Experiments). Alterações manuais de criativos em campanha ativa contaminam o histórico de otimização.

4. **Documentar a hipótese ANTES de criar o teste.** A hipótese vai para a "Fila de Testes" com data de abertura registrada. Teste sem hipótese prévia não entra na fila.

5. **Arquivar perdedores com aprendizado.** Variante perdedora não é deletada imediatamente — o aprendizado é registrado no Histórico antes. "Não funcionou" não é aprendizado; "Audiência fria não converte com prova social sem antes estabelecer problema" é aprendizado.

6. **Uma decisão por vez por canal principal.** Enquanto um teste está ativo no Meta, não abrir outro teste no mesmo canal principal. Múltiplos testes simultâneos no mesmo pool de audiência competem entre si e corrompem os dados.

7. **Nenhuma decisão baseada em "sensação".** Se o dado não está significativo, o teste continua ou é encerrado sem declarar vencedor. Empate é empate — nenhum empate justifica mudar o controle.

---

## 2. Template de Hipótese

Copiar e preencher este bloco para cada novo experimento antes de criar o teste na plataforma.

```
---
### EXP-[número sequencial] · [título curto]

**Hipótese:**
"Se [mudança no elemento X], então [métrica Y] vai [aumentar/diminuir] porque [raciocínio baseado em evidência ou observação]."

**Elemento testado:** (ex: headline do anúncio, CTA do botão, frame da oferta)
**Canal:** (Meta Ads / Google Ads / Landing Page / E-mail)
**Campanha / Conjunto:** (nome exato da campanha na plataforma)
**Variante Controle (A):** [descrever]
**Variante Teste (B):** [descrever]

**Métrica principal:** (ex: CPL, taxa de cadastro, ROAS)
**Métrica secundária:** (ex: CTR, taxa de visualização do vídeo até 50%)

**Data início:** ____/____/______
**Data fim (prevista):** ____/____/______  ← nunca antes de atingir amostra mínima
**Amostra necessária:** [ver Seção 5] conversões por variante

**Resultado (preencher ao encerrar):**
- Variante A: ___ conversões, ___ % [métrica]
- Variante B: ___ conversões, ___ % [métrica]
- Variância relativa: ____%

**Significância estatística:** ___% (mínimo aceitável: 95%)
**Decisão:** [ ] Adotar B  [ ] Manter A  [ ] Inconclusivo — estender  [ ] Encerrar sem vencedor

**Aprendizado:**
(obrigatório — ao menos 2 frases sobre o que este resultado ensina sobre a audiência, o produto ou o canal)
---
```

---

## 3. Fila de Testes Prioritários

Os testes abaixo são recomendados com base no que já se conhece do produto: ticket de R$ 150, produto de saúde com componente de estigma (HIV/PrEP), audiência predominantemente LGBTQIA+, funil via anúncio → LP → formulário multi-etapas → pagamento.

| # | Elemento | Hipótese resumida | Canal | Métrica principal | Prioridade |
|---|----------|-------------------|-------|-------------------|------------|
| 1 | **Headline da LP** | "Consulta PrEP online em 48h" vs "Comece a PrEP hoje, sem sair de casa" — linguagem de urgência vs. conveniência | Meta → LP | Taxa de cadastro (início do formulário) | Alta |
| 2 | **Frame da oferta** | Apresentar R$ 150 como "por consulta" vs "menos que uma consulta presencial" (âncora de preço) | Meta → LP | CPL (lead cadastrado) | Alta |
| 3 | **CTA do anúncio** | "Saiba mais" vs "Começar agora" vs "Falar com especialista" — temperatura da audiência impacta CTA ideal | Meta | CTR + CPL | Alta |
| 4 | **WhatsApp vs. formulário nativo** | Botão "Falar no WhatsApp" vs formulário direto na LP — audiência fria prefere baixo comprometimento inicial | Meta | Volume de leads + taxa de qualificação | Alta |
| 5 | **Ângulo: urgência vs. prova social** | Copy com escassez ("vagas limitadas esta semana") vs. depoimentos de pacientes — qual converte mais em audiência fria | Meta | CPL | Média |
| 6 | **Temperatura da audiência — segmentação** | Interesse em saúde LGBTQIA+ (fria) vs retargeting de visitantes da LP (quente) com mesmo criativo | Meta | ROAS, CPL segmentado | Média |
| 7 | **Headline de anúncio — problema vs. solução** | "Tem medo de contrair HIV?" (problema) vs "PrEP: 99% de proteção, online, R$ 150" (solução) | Meta | CTR, CPL | Média |
| 8 | **Posição da prova social na LP** | Depoimentos acima do formulário vs abaixo do headline — impacto na taxa de avanço pelo formulário | LP (teste direto na página) | Taxa de conclusão do Step 1 do formulário | Baixa |
| 9 | **Google — correspondência de palavra-chave** | Exata ("consulta prep online") vs frase ("prep online") — qualidade vs. volume | Google Ads | CPL + taxa de qualificação | Baixa |
| 10 | **E-mail de ativação** | Assunto "Seu acesso ao Facilita PrEP está pronto" vs "Próximo passo: comece sua consulta PrEP" — impacto na conclusão do formulário | E-mail (pós-cadastro) | Taxa de conclusão do formulário | Baixa |

---

## 4. Histórico de Resultados

| ID | Hipótese (resumo) | Canal | Variante vencedora | Variação relativa | Significância | Decisão | Data encerramento |
|----|-------------------|-------|--------------------|-------------------|---------------|---------|-------------------|
| — | *(nenhum teste encerrado ainda)* | — | — | — | — | — | — |

> Instruções de preenchimento: preencher uma linha por experimento encerrado. Mesmo testes inconclusivos ou encerrados sem vencedor devem ser registrados com "Inconclusivo" na coluna Decisão.

---

## 5. Calculadora de Amostra

Referência rápida para definir duração mínima de testes. Assume taxa de conversão base de ~5% na LP (estimativa conservadora para produto de saúde com estigma associado), confiança de 95%, teste bicaudal.

| Efeito mínimo detectável | Conversões necessárias por variante | Total (A + B) | Observação |
|--------------------------|-------------------------------------|---------------|------------|
| 5% de melhora relativa | ~1.600 | ~3.200 | Inviável com orçamento atual |
| 10% de melhora relativa | ~400 | ~800 | Viável em ~12 semanas |
| 20% de melhora relativa | ~100 | ~200 | Viável em ~3 semanas |
| 30% de melhora relativa | ~50 | ~100 | Viável em ~10 dias — mas efeito muito grande, suspeito de problema de mensuração |

### Contexto orçamentário atual

- **Ticket médio:** R$ 150
- **Orçamento mensal estimado:** R$ 10.000/mês
- **CPA alvo:** R$ 150 (1:1 de ROAS no primeiro atendimento, LTV positivo nas consultas seguintes)
- **Volume de conversões/mês estimado:** ~66 conversões/mês (R$ 10.000 ÷ R$ 150)
- **Por variante (split 50/50):** ~33 conversões/mês por variante

### Conclusão prática

Com o orçamento atual de R$ 10k/mês:

- Testes com **efeito esperado de 20%** levam **~3 meses** para atingir 100 conversões por variante (mínimo desta metodologia).
- Testes com **efeito esperado de 30%+** levam cerca de **6 semanas**.
- Testes que buscam detectar efeitos menores que 20% são **inviáveis** com o orçamento atual — não abrir.
- **Recomendação imediata:** concentrar testes em hipóteses de alto impacto (mudanças de frame, CTA radicalmente diferente, canal de contato). Refinamentos finos (cor do botão, ordem de campos) ficam para quando o volume mensal superar 200 conversões/mês.

> Ferramenta para cálculo preciso: [Evan Miller Sample Size Calculator](https://www.evanmiller.org/ab-testing/sample-size.html) — usar "Relative Minimum Detectable Effect", baseline conversion rate real extraído da plataforma.

---

## 6. Cadência de Testes

### Ritmo mínimo

| Canal | Frequência mínima de novos testes |
|-------|-----------------------------------|
| Meta Ads | 1 teste ativo por vez; novo teste ao encerrar o anterior |
| Google Ads | 1 teste ativo por vez; ciclo mínimo de 6 semanas |
| Landing Page | 1 teste por bimestre (volume menor justifica ciclo mais longo) |
| E-mail | 1 teste por trimestre |

### Ritual semanal

- **Toda segunda-feira:** revisar painel de resultados dos testes ativos.
  - Verificar se a amostra mínima foi atingida.
  - Verificar se há anomalias (ex: uma variante com CTR 3x maior mas CPL igual — investigar antes de concluir).
  - Nunca encerrar teste prematuramente por "parece que B está ganhando".

### Ritual mensal

- **Última segunda de cada mês:** reunião de revisão de aprendizados.
  - Testes encerrados no mês: registrar no Histórico com aprendizado obrigatório.
  - Definir próximo teste da fila para cada canal.
  - Verificar se o orçamento atual justifica ajuste nas amostras mínimas.

### Decisões

- Toda decisão de adotar uma variante ou manter controle deve ter o ID do experimento registrado.
- Nenhuma mudança em campanha ativa ("achei que ficaria melhor assim") sem passar pelo framework.
- Em caso de dúvida entre dois resultados próximos: **manter controle** até nova rodada com amostra maior.

---

*Última atualização: 2026-05-20*
