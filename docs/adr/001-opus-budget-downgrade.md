# ADR 001 — Downgrade Automático Opus → Sonnet por Budget Diário

**Data:** 2026-05-19
**Status:** Aceito

---

## Contexto

O sistema CIS (Clinical Intelligence System) utiliza Claude Opus (claude-opus-4-5) para geração de SOAP notes completas, síntese de literatura PubMed e Clinical Digest. Opus é o modelo de maior qualidade disponível, porém custa aproximadamente **15× mais por token** do que Claude Sonnet.

Em cenário de uso clínico intenso — por exemplo, uma série de 20 atendimentos seguida de busca PubMed aprofundada — o custo diário pode ultrapassar dezenas de reais sem qualquer mecanismo de controle. Isso é inaceitável para um sistema SaaS de pequeno porte onde o custo de infraestrutura deve ser previsível.

Alternativas consideradas:

1. **Sem limite:** Aceitar o custo variável. Rejeitado — imprevisibilidade financeira.
2. **Limite fixo por chamada:** Truncar prompts acima de N tokens. Rejeitado — prejudica qualidade das notas longas.
3. **Desabilitar Opus completamente:** Usar apenas Sonnet. Rejeitado — perde qualidade quando há budget disponível.
4. **Counter Redis com downgrade automático:** Contabilizar tokens Opus consumidos no dia; fazer downgrade para Sonnet quando o budget for atingido. **Escolhido.**

---

## Decisão

Implementar um **contador Redis com TTL de 48 horas** para rastrear o consumo diário de tokens Claude Opus no módulo CIS.

**Funcionamento:**

- A cada chamada bem-sucedida à API Anthropic com modelo Opus, o número de tokens consumidos (`usage.input_tokens + usage.output_tokens`) é incrementado no contador Redis sob a chave `cis:opus_tokens:{YYYYMMDD}` com TTL de 48 horas.
- Antes de cada chamada, o valor atual do contador é consultado. Se `counter >= OPUS_DAILY_TOKEN_BUDGET`, o modelo é automaticamente substituído por Claude Sonnet para aquela chamada.
- O limite é configurável via variável de ambiente `OPUS_DAILY_TOKEN_BUDGET` (padrão: `100_000` tokens, equivalente a aproximadamente 10 chamadas completas de SOAP note).
- Definir `OPUS_DAILY_TOKEN_BUDGET=0` desabilita o limite por completo.
- O estado atual do budget é exposto via `GET /api/cis/budget` para monitoramento no painel admin.

**Implementação:**

- Módulo: `server/clinicalIntelligence.ts` (função `selectModel`) e `server/cisRest.ts` (endpoint `/budget`).
- O contador é incrementado **após** a chamada bem-sucedida para não penalizar chamadas que falham por outros motivos.
- Em caso de Redis indisponível, o sistema assume budget **não atingido** (fail-open) para não bloquear o atendimento clínico.

---

## Consequências

### Positivas

- **Controle de custo previsível:** o custo máximo diário com Opus é limitado a `OPUS_DAILY_TOKEN_BUDGET × preço_por_token_opus`, sem intervenção manual.
- **Transparência operacional:** endpoint `/api/cis/budget` permite monitoramento em tempo real do consumo e do modelo ativo.
- **Configurabilidade sem redeploy:** o limite pode ser ajustado via Railway Variables sem necessidade de novo deploy.
- **Fail-open seguro:** Redis indisponível não bloqueia o fluxo clínico — apenas perde o controle de budget temporariamente.

### Negativas

- **Queda de qualidade em dias de uso intenso:** após atingir o budget, todas as chamadas do dia usam Sonnet. A diferença de qualidade é perceptível em casos clínicos complexos.
- **Perda do counter se Redis reiniciar sem persistence:** se o Redis for reiniciado sem RDB/AOF habilitado, o contador zera e o budget efetivo do dia é subestimado. Mitigação: habilitar RDB persistence no Railway Redis (ver RUNBOOK.md Seção 4).
- **Granularidade diária:** o TTL de 48 horas cobre o dia atual e parte do anterior para evitar "reset à meia-noite" em sessões longas, mas pode causar acumulação em períodos de alta atividade ao final do dia.
- **Counter não compartilhado entre réplicas sem Redis centralizado:** em cenário hipotético de múltiplas instâncias sem Redis compartilhado, o limite seria aplicado por instância. Não é um problema hoje, pois o sistema não escala horizontalmente.
