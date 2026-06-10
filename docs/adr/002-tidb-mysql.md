# ADR 002 — TiDB (MySQL-compatível) como banco de dados

**Status:** Aceito  
**Data:** 2025-01-15  
**Decisores:** Werciley (tech lead)

## Contexto

O sistema precisa de um banco relacional com ACID garantido, capaz de escalar horizontalmente sem migração futura, com suporte a MySQL 8 para compatibilidade com Drizzle ORM.

## Decisão

Usar **TiDB** (dialeto MySQL 8) hospedado via serviço gerenciado, com Drizzle ORM usando o driver `mysql2`.

## Consequências

**Positivas:**

- Compatibilidade total com MySQL 8 — sem lock-in de ORM
- Escala horizontal nativa (sharding automático) sem refatoração futura
- ACID com transações distribuídas
- Suporte a `CURRENT_TIMESTAMP`, JSON columns, índices compostos

**Negativas:**

- Não suporta todas as features MySQL avançadas (ex: stored procedures complexas)
- Latência ligeiramente maior que MySQL local em operações single-row
- Requer SSL obrigatório na connection string

## Alternativas consideradas

| Alternativa            | Motivo de descarte                                                                 |
| ---------------------- | ---------------------------------------------------------------------------------- |
| PostgreSQL             | Drizzle ORM tem suporte, mas migraria para dialeto diferente sem benefício claro   |
| PlanetScale            | Sem suporte a foreign keys; limitações de branching incompatíveis com Drizzle push |
| MySQL gerenciado (RDS) | Sem escala horizontal nativa; custo maior para o mesmo workload                    |
