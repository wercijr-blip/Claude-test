# Changelog

## [Unreleased]

### Segurança
- Remover `paymentId` da resposta pública de `consultarStatusPorPrecadastro` (fecha cadeia de enumeração JWT)
- Substituir comparação de string por `timingSafeEqual` na validação do webhook Asaas (timing oracle)
- Adicionar circuit breaker para chamadas à API Asaas

### Adicionado
- Integração Z-API WhatsApp com 4 triggers (cadastro, link de acesso, lembrete, pesquisa)
- Endpoint admin `regenerarFichaAtendimento` para reprocessar PDFs corrompidos
- Tabela `dlq_jobs` para persistência de jobs que esgotam retries
- Endpoint `/api/metrics` com queue depth e uso de memória
- CI/CD via GitHub Actions (TypeScript check, testes, build, audit)
- Dependabot para atualizações automáticas de segurança
- Sistema de toast para notificações de UX
- Utilitário `fmt` para formatação BRL e datas
- Hook `useFormDraft` para preservação de rascunho do formulário
- Banner de consentimento de cookies (LGPD)
- Runbook de incidentes e template de notificação ANPD
- Logging de custo estimado por análise de exame (LLM)

### Corrigido
- Header `asaas-access-token` no webhook (era `access_token`)
- Substituição de referências a Stripe por Asaas nas páginas legais

### Infraestrutura
- `.dockerignore` para excluir arquivos desnecessários da imagem Docker
- `.nvmrc` para pinar versão Node.js 22
- README.md com quick-start e documentação centralizada
