## Descrição

<!-- O que muda e por quê? -->

## Tipo de mudança

- [ ] Bug fix
- [ ] Nova funcionalidade
- [ ] Refatoração (sem mudança de comportamento)
- [ ] Infra / CI / DX
- [ ] Documentação

## Checklist

### Segurança & LGPD

- [ ] Nenhum dado de paciente (CPF, nome, exames) é logado sem criptografia
- [ ] Novos campos PII passam por `encrypt()` antes de persistir
- [ ] Novos endpoints usam a procedure correta (`protectedProcedure`, `medicoProcedure`, etc.)
- [ ] Nenhuma secret/chave/token commitada

### Banco de dados

- [ ] Se `drizzle/schema.ts` foi alterado, migration gerada (`pnpm db:generate`) e incluída no PR
- [ ] Índices adicionados em colunas novas usadas em filtros de busca

### Testes

- [ ] Lógica nova ou alterada coberta por testes em `server/**/*.test.ts`
- [ ] `pnpm test` passa localmente

### Revisão clínica (marque se aplicável)

- [ ] Mudança em `pdfSigner.ts`, templates de prescrição ou assinatura ICP-Brasil revisada pelo médico responsável

## Como testar

<!-- Passos para o revisor reproduzir a mudança -->

## Screenshots (se UI)

<!-- Antes / depois -->
