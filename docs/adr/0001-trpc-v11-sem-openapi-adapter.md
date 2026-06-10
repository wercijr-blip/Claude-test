# ADR 0001 — tRPC v11 com spec OpenAPI manual

**Status:** Aceito  
**Data:** 2025-Q4

## Contexto

Precisávamos documentar a API REST e os procedures tRPC para facilitar integração e auditoria.
A biblioteca `trpc-openapi` seria a solução natural, mas suporta apenas tRPC v10.

## Decisão

Manter spec OpenAPI 3.0.3 manual em `server/_core/openapi.ts` e servir via `swagger-ui-express`
em `/api/docs`. Os procedures tRPC são documentados como referência JSON-RPC na seção
`x-trpc-reference` da spec.

## Consequências

**Positivas:**

- Spec pode documentar endpoints REST que tRPC não expõe nativamente (health, metrics, upload)
- Controle total sobre o formato e nível de detalhe da documentação

**Negativas:**

- Spec pode divergir da implementação sem contract testing automatizado
- Manutenção manual da spec a cada mudança de API

**Mitigação:** Adicionar contract tests que verificam que endpoints documentados respondem
com os schemas declarados (trabalho futuro).
