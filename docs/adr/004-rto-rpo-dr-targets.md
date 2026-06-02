# ADR 004 — Alvos de RTO/RPO e Plano de Recuperação de Desastres

**Status:** Aceito  
**Data:** 2025-05-19

## Contexto

O Facilita PrEP processa dados sensíveis de saúde sob LGPD e CFM 2.299/2021. Precisamos definir alvos formais de recuperação para guiar decisões de infra e resposta a incidentes.

## Decisão

| Métrica | Alvo | Justificativa |
|---------|------|---------------|
| **RTO** (Recovery Time Objective) | ≤ 2 horas | Clínica tolera pausa curta; acima disso impacta atendimento |
| **RPO** (Recovery Point Objective) | ≤ 24 horas | TiDB Cloud Serverless faz backup automático diário |

## Componentes de Infra e Estratégia de DR

| Componente | Provedor | Estratégia | RTO local |
|---|---|---|---|
| Banco de dados | TiDB Cloud Serverless | Backup automático diário + restore via console | < 1h |
| Redis | Railway (ephemeral) | Dados são efêmeros (filas, rate-limit) — reiniciar zerando é aceitável | < 5 min |
| Arquivos S3 | AWS S3 | S3 Versioning habilitado; Cross-Region Replication recomendada | < 30 min |
| App (Railway) | Railway | Redeployar última imagem via painel; autoscaling | < 15 min |
| Certificado ICP | PFX armazenado como var `ICP_PFX_BASE64` | Rekeying requer ICP-Brasil (1–5 dias úteis) | N/A (não é DR |

## Checklist de Drill Mensal

Execute mensalmente para validar o plano:

- [ ] **Verificar backup automático TiDB:** Console TiDB Cloud → Cluster → Backups → confirmar snapshot do dia anterior existe e tem status "Success"
- [ ] **Testar restore em ambiente staging:** Restaurar snapshot mais recente em banco de staging e verificar `SELECT COUNT(*) FROM pacientes` retorna valor plausível
- [ ] **Verificar S3 Versioning:** `aws s3api get-bucket-versioning --bucket $AWS_S3_BUCKET` → `"Status": "Enabled"`
- [ ] **Verificar Railway deploy:** Confirmar que último deploy bem-sucedido está documentado; testar redeploy manual no ambiente de staging
- [ ] **Testar Redis restart:** Reiniciar serviço Redis no Railway e confirmar que a aplicação reconecta automaticamente em < 30 segundos (circuit breaker Redis entra em modo fallback local)
- [ ] **Verificar alertas Sentry:** Confirmar que alertas de erro crítico estão configurados e têm destinatário ativo
- [ ] **Revisar runbook:** Revisar `docs/runbook-incidentes.md` para garantir que contatos e passos estão atualizados
- [ ] **Simular notificação ANPD:** Preencher template `docs/templates/notificacao-anpd.md` com dados fictícios para treinar o fluxo

## Consequências

- Drill mensal aumenta confiança no plano e detecta degradação de infra antes de incidentes reais
- RTO de 2h é compatível com SLA informal com a clínica; documentar formalmente no contrato se necessário
- RPO de 24h significa que em caso de falha catastrófica, até 24h de dados podem ser perdidas — aceitável dado que o fluxo clínico tem backups humanos (papéis/planilhas)

## Referências

- `docs/backups.md` — procedimentos detalhados de backup/restore
- `docs/runbook-incidentes.md` — respostas passo a passo
- LGPD Art. 46 — medidas técnicas de segurança
- CFM 2.299/2021 — requisitos de integridade de prontuário digital
