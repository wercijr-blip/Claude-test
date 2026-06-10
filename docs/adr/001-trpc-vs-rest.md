# ADR 001 — tRPC v11 em vez de REST/OpenAPI

**Status:** Aceito  
**Data:** 2025-01-15  
**Decisores:** Werciley (tech lead)

## Contexto

Precisávamos de uma camada de API entre o backend Express e o frontend React que garantisse type-safety end-to-end e eliminasse o risco de dessincronia de tipos entre cliente e servidor.

## Decisão

Adotar **tRPC v11** com Zod para validação de input e inferência automática de tipos no cliente.

## Consequências

**Positivas:**

- Type-safety completo em tempo de compilação — cliente não pode chamar endpoint com parâmetros errados
- Sem necessidade de OpenAPI/Swagger para o cliente interno
- Zod schemas reutilizáveis no servidor e no cliente
- Suporte nativo a React Query (cache, refetch, optimistic updates)

**Negativas:**

- Clientes não-TypeScript (mobile nativo, terceiros) não podem usar o contrato
- Curva de aprendizado para devs habituados a REST
- Debug de rede mais complexo (batch requests)

## Alternativas consideradas

| Alternativa     | Motivo de descarte                                                                           |
| --------------- | -------------------------------------------------------------------------------------------- |
| REST + OpenAPI  | Código de tipagem gerado é verboso; dessincronia frequente entre spec e implementação        |
| GraphQL         | Overhead de schema + resolver; complexidade desnecessária para um sistema com frontend único |
| JSON-RPC manual | Sem type inference automática; reinventar o que tRPC já resolve                              |
