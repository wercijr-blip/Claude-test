# ADR 002 — Arquitetura Single-Doctor

**Data:** 2026-05-19
**Status:** Aceito

---

## Contexto

Facilita PrEP é inicialmente desenvolvida para um único médico: **Dr. Werciley Saraiva Vieira Junior (CRM-DF 16381)**. O sistema gerencia prontuários, SOAP notes, Clinical Digest e assinatura digital de PDFs exclusivamente para esse profissional.

Escalar para uma arquitetura multi-médico (multi-tenant) exigiria mudanças significativas:

- Adicionar coluna `medico_id` (ou `tenant_id`) em praticamente todas as tabelas do schema Drizzle.
- Isolar filas BullMQ por médico.
- Separar budgets de tokens Opus por médico.
- Gerenciar múltiplos certificados ICP-Brasil.
- Introduzir autenticação multi-tenant no módulo CIS.

Essas mudanças aumentariam substancialmente a complexidade do código, o risco de vazamento de dados cross-tenant e o custo de manutenção — sem nenhum benefício imediato para o caso de uso atual.

Alternativas consideradas:

1. **Multi-tenant desde o início:** Projetar o schema e a API para múltiplos médicos. Rejeitado — over-engineering prematuro; adiciona complexidade sem demanda real.
2. **Single-doctor via banco de dados:** Identificar o médico por um registro fixo no banco (ex: primeiro usuário com role `medico`). Rejeitado — frágil; depende do estado do banco; dificulta testes.
3. **Single-doctor via variável de ambiente:** Identificar o médico através de `CIS_MEDICO_USER_ID` injetada no ambiente de execução. **Escolhido.**

---

## Decisão

O sistema adota uma **arquitetura single-doctor** onde o médico responsável pelo CIS é identificado exclusivamente pela variável de ambiente `CIS_MEDICO_USER_ID`.

**Funcionamento:**

- `CIS_MEDICO_USER_ID` contém o ID numérico do usuário do médico no banco de dados.
- A REST API do CIS (`server/cisRest.ts`) utiliza esse valor para carregar o perfil do médico, buscar seus pacientes e gerar contexto clínico sem nenhum parâmetro de seleção de tenant.
- O módulo `server/clinicalIntelligence.ts` recebe o ID do médico via `env.CIS_MEDICO_USER_ID` e não aceita sobrescrita por parâmetro de chamada.
- Dados do médico (nome, CRM, RQE) são configurados via variáveis de ambiente `MEDICO_NOME`, `MEDICO_CRM`, `MEDICO_CRM_UF`, `MEDICO_CRM_TIPO` e `MEDICO_RQE`, com defaults para Dr. Werciley.
- O budget diário de tokens Opus (`cis:opus_tokens:{data}`) é global — não particionado por médico — o que é correto para a arquitetura single-tenant.

**Garantias de segurança mantidas:**

- A autenticação da REST API CIS é feita via `CIS_API_KEY` (secret de 32+ chars), não via sessão do usuário.
- Endpoints CIS verificam a chave antes de qualquer acesso a dados — sem risco de acesso não autorizado.
- Não há superfície de ataque cross-tenant por definição.

---

## Consequências

### Positivas

- **Simplicidade radical:** nenhuma coluna `tenant_id`, nenhuma lógica de isolamento cross-tenant, nenhum risco de vazamento de dados entre médicos.
- **Zero overhead de multi-tenancy:** consultas ao banco não precisam filtrar por tenant; índices são menores e mais eficientes.
- **Configuração trivial:** trocar de médico (ex: em uma instância separada do sistema) é questão de alterar variáveis de ambiente — sem migração de banco.
- **Testes simples:** mocks de `env.CIS_MEDICO_USER_ID` cobrem todos os cenários sem fixtures multi-tenant.

### Negativas

- **`budgetCache` de módulo não compartilhado entre réplicas:** se o sistema escalar horizontalmente (múltiplas instâncias), o cache em memória do budget Opus não é sincronizado. Mitigação já implementada: o estado autoritativo está no Redis; o cache em memória é apenas otimização de leitura.
- **Expansão para multi-médico requer refactor:** adicionar suporte a múltiplos médicos exigirá:
  - Refactor em `server/cisRest.ts` para aceitar `medico_id` como parâmetro autenticado.
  - Refactor em `server/clinicalIntelligence.ts` para receber contexto do médico por chamada.
  - Schema migration para adicionar `medico_id` nas tabelas relevantes.
  - Particionamento de budgets Redis por médico.
  - Este refactor é estimado em 2–3 sprints de desenvolvimento.
- **Acoplamento entre instâncias e médicos:** cada deploy Railway está acoplado a um único médico. Para múltiplos médicos, seria necessário múltiplas instâncias ou refactor multi-tenant — ambos têm custo de operação.

**Decisão de revisão:** Reavaliar esta ADR quando houver demanda concreta de um segundo médico usuário do sistema.
