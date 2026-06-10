# ADR 006 — Estratégia de Migrations de Banco de Dados

**Status:** Aceito  
**Data:** 2026-05-22

## Contexto

O projeto usa TiDB Cloud Serverless (MySQL 8-compatível) como banco principal. As mudanças de schema precisam ser aplicadas com segurança em produção sem downtime, e rastreadas em versionamento.

Três ferramentas coexistem:

1. **Drizzle Kit** — gera arquivos SQL a partir de mudanças em `drizzle/schema.ts`
2. **`server/_core/ensureSchema.ts`** — cria tabelas e patches de colunas via `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE` idempotentes na inicialização do servidor
3. **`drizzle/0NNN_*.sql`** — arquivos SQL raw para mudanças que o Drizzle Kit não suporta (ex: colunas geradas, índices funcionais)

## Decisão

### Fluxo para mudanças de schema

```
1. Editar drizzle/schema.ts
   ↓
2. pnpm db:generate          → gera drizzle/0NNN_nome.sql
   ↓
3. Revisar o SQL gerado      → ajustar se necessário
   ↓
4. pnpm db:push              → aplica em dev local (ou Railway produção via CI)
   ↓
5. Atualizar ensureSchema.ts → garantir idempotência em novos deploys
```

### Quando usar cada abordagem

| Situação                       | Abordagem                                                 |
| ------------------------------ | --------------------------------------------------------- |
| Nova tabela ou coluna simples  | `drizzle/schema.ts` → `pnpm db:generate` → `pnpm db:push` |
| DROP COLUMN (schema.ts remove) | Idem — gerar migration e aplicar                          |
| Coluna GENERATED/VIRTUAL       | SQL manual em `drizzle/0NNN_*.sql` + `ensureSchema.ts`    |
| Índice funcional ou parcial    | SQL manual em `drizzle/0NNN_*.sql`                        |
| Backfill de dados              | Script em `server/scripts/` executado manualmente         |

### Numeração de migrations manuais

Seguir o padrão `0NNN_descricao_snake_case.sql` onde `NNN` é o próximo número disponível após os gerados pelo Drizzle Kit.

Exemplo: `0002_exames_resultado_ia_status_index.sql`

### `ensureSchema.ts` — propósito e limites

`ensureSchema.ts` garante que novos deploys (Railway cold start) criam as tabelas necessárias via `CREATE TABLE IF NOT EXISTS`. Ele NÃO substitui migrations — não faz `ALTER TABLE` arbitrários.

Para **patches de colunas** adicionais (ex: adicionar coluna esquecida), `ensureSchema.ts` tem um array `COLUMN_PATCHES` que executa `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.

> **Regra:** `ensureSchema.ts` deve sempre refletir o estado final das tabelas após todas as migrations. Ao adicionar uma migration, atualizar o `CREATE TABLE` correspondente em `ensureSchema.ts`.

### Migrations em produção (Railway)

As migrations são aplicadas automaticamente pelo `ensureSchema.ts` na inicialização do servidor. Para migrations manuais (`drizzle/0NNN_*.sql`), aplicar via:

```bash
# Aplicar manualmente antes do deploy (Railway)
mysql $DATABASE_URL < drizzle/0002_exames_resultado_ia_status_index.sql

# Ou usar drizzle-kit migrate (se migration foi gerada via db:generate)
pnpm db:migrate
```

### Checklist antes de aplicar migration em produção

- [ ] Migration testada em ambiente local com `pnpm db:push`
- [ ] `ensureSchema.ts` atualizado para refletir nova estrutura
- [ ] Migration é idempotente (pode rodar duas vezes sem erro)?
  - Se não: adicionar guard `IF NOT EXISTS` / `IF EXISTS`
- [ ] Para `ALTER TABLE` em tabelas grandes (>1M rows): verificar lock duration
  - TiDB Cloud suporta DDL online não-bloqueante para a maioria das operações

## Consequências

**Positivo:**

- Histórico completo de mudanças de schema em Git
- `ensureSchema.ts` garante que novos ambientes (dev, staging) arrancam sem setup manual
- CI valida drift com `pnpm db:check`

**Negativo:**

- Dupla manutenção: `schema.ts` + `ensureSchema.ts` devem ser mantidos sincronizados
- Migrations manuais (SQL raw) não são rastreadas pelo Drizzle Kit journal

## Mitigações

- CI executa `pnpm db:check` para detectar drift entre `schema.ts` e migrations geradas
- PR checklist deve incluir verificação de `ensureSchema.ts` quando `schema.ts` muda
