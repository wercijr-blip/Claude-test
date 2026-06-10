# Migrations

Ver [ADR 006](../docs/adr/006-migration-strategy.md) para a estratégia completa.

## Comandos rápidos

```bash
# Gerar migration a partir de mudanças em schema.ts
pnpm db:generate

# Aplicar em dev local
pnpm db:push

# Verificar drift (schema.ts vs migrations)
pnpm db:check

# Reset completo do banco local (DEV ONLY)
pnpm db:reset
```

## Migrations neste diretório

| Arquivo | Descrição |
|---------|-----------|
| `0000_illegal_blackheart.sql` | Schema inicial — todas as tabelas |
| `0001_drop_focusnfe_ref.sql` | Remove coluna focusnfe_ref (FocusNFe descontinuado) |
| `0002_exames_resultado_ia_status_index.sql` | Coluna virtual + índice em exames.resultado_ia.status |

## Aplicar migration manual em produção

```bash
# Antes do deploy (substitua pela URL de produção)
mysql $DATABASE_URL < drizzle/0002_exames_resultado_ia_status_index.sql
```

> Após adicionar uma migration, **sempre** atualizar `server/_core/ensureSchema.ts`
> para que novos deploys e ambientes de staging criem a estrutura correta.
