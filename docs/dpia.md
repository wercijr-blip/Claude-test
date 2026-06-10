# DPIA — Relatório de Impacto à Proteção de Dados Pessoais

**Plataforma:** Facilita PrEP  
**Controlador:** [Nome da Clínica]  
**DPO:** [Nome do DPO]  
**Data:** 2025-05-19  
**Versão:** 1.0  
**Base legal:** LGPD Art. 38 (ANPD pode exigir DPIA para tratamento de dados sensíveis de saúde)

---

## 1. Identificação do Tratamento

| Item                   | Descrição                                                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Finalidade**         | Gestão do ciclo completo de profilaxia PrEP: cadastro, consulta, prescrição digital, emissão NFS-e                                               |
| **Categoria de dados** | Dados de saúde (LGPD Art. 5, II — dado sensível): HIV status, exames laboratoriais, prescrições; CPF, nome, data de nascimento, e-mail, telefone |
| **Titulares**          | Pacientes adultos em programa PrEP                                                                                                               |
| **Operadores**         | Railway (hospedagem), TiDB Cloud (banco), AWS (S3), Sentry (logs), Google/Gmail (e-mail), Z-API (WhatsApp)                                       |
| **Base legal**         | LGPD Art. 11, II, f — tutela da saúde por profissional de saúde ou entidade sanitária                                                            |
| **Retenção**           | 20 anos após último atendimento (CFM 2.299/2021 + Lei 13.787/2018)                                                                               |

---

## 2. Necessidade e Proporcionalidade

### 2.1 Dados Coletados e Justificativa

| Dado                 | Finalidade                                | Alternativa menos invasiva?                       |
| -------------------- | ----------------------------------------- | ------------------------------------------------- |
| CPF                  | Identificação unívoca, emissão NFS-e      | Não — CPF é obrigatório por regulação fiscal      |
| Nome completo        | Prescrição digital com validade legal     | Não                                               |
| Data de nascimento   | Cálculo de elegibilidade PrEP, prescrição | Não                                               |
| Nome da mãe          | Validação identitária adicional           | Sim — poderia ser removido após validação inicial |
| Exames laboratoriais | Análise clínica por IA + revisão médica   | Não — exame é o objeto do serviço                 |
| E-mail / telefone    | Entrega de prescrições e lembretes        | Parcialmente — ao menos um canal é obrigatório    |
| Assinatura digital   | TCLE com validade legal                   | Não — assinatura é requisito regulatório          |

### 2.2 Minimização

- CPF e Nome são **criptografados em repouso** (AES-256 via `server/_core/encryption.ts`)
- `cpfHash` (HMAC-SHA256) permite busca sem expor o CPF plaintext
- Exames são armazenados no S3 com acesso por URL pré-assinada (TTL 5 minutos)
- Logs não contêm dados de saúde (Sentry configurado com `sendDefaultPii: false`)

---

## 3. Mapeamento de Riscos

| Risco                                          | Probabilidade | Impacto | Score | Mitigação                                                                                              |
| ---------------------------------------------- | ------------- | ------- | ----- | ------------------------------------------------------------------------------------------------------ |
| Vazamento de banco por credencial comprometida | Baixa         | Alto    | **6** | TLS obrigatório, acesso só via DATABASE_URL com senha forte; dados sensíveis criptografados em repouso |
| Acesso não autorizado a exames no S3           | Baixa         | Alto    | **6** | URLs pré-assinadas com TTL 5min; bucket privado; IAM com least-privilege                               |
| Enumeração de pacientes via API                | Média         | Médio   | **6** | Rate limiting por IP; paymentId removido de respostas públicas; autenticação JWT em todas as rotas     |
| Timing oracle no CPF                           | Baixa         | Médio   | **4** | `timingSafeEqual` na comparação de tokens                                                              |
| Acesso indevido por role elevation             | Baixa         | Alto    | **6** | tRPC procedures segregadas por role; validação server-side em cada mutation                            |
| Falha de backup / perda de prontuário          | Baixa         | Alto    | **6** | TiDB Cloud backup diário automático; drill mensal (ADR 004)                                            |
| CSRF / session hijacking                       | Baixa         | Alto    | **6** | Validação de origem CSRF; JWT httpOnly (não implementado via cookie — JWT em header Authorization)     |
| Retenção além do prazo (data hoarding)         | Média         | Médio   | **6** | Campo `retentionUntil`; processo de anonimização via `audit_log` para DPO                              |
| Análise de exame por IA sem consentimento      | Baixa         | Alto    | **6** | TCLE inclui cláusula de uso de IA; análise requer aprovação médica antes de qualquer efeito clínico    |

**Escala:** Probabilidade 1–3 × Impacto 1–3 = Score 1–9

---

## 4. Medidas Técnicas e Organizacionais

### 4.1 Técnicas

- **Criptografia em repouso:** AES-256 para CPF, nome, nome da mãe
- **Criptografia em trânsito:** TLS 1.2+ obrigatório em todas as conexões (banco, S3, APIs externas)
- **Autenticação:** OAuth 2.0 + JWT com segredo de 32+ caracteres; expiração configurável
- **Autorização:** Segregação de roles (patient/staff/medico/admin) com validação em cada endpoint
- **Rate limiting:** Por IP em endpoints sensíveis (login, webhook, análise de exames)
- **Circuit breaker:** Redis com fallback local para chamadas à API Asaas
- **Throttle LLM:** Limite diário configurável (`LLM_DAILY_LIMIT`) via Redis
- **Audit log:** Todos os eventos críticos registrados em `audit_log` com IP, user agent e contexto
- **LGPD retention:** Campo `retentionUntil` em prontuários; processo de anonimização via DPO
- **Sem PII em logs:** Sentry configurado com `sendDefaultPii: false`

### 4.2 Organizacionais

- Acesso ao banco de produção restrito ao DBA e DevOps
- Certificados ICP-Brasil armazenados como secrets no Railway (nunca em código)
- `.gitignore` bloqueia `.env` e `server/certs/`
- Dependabot ativo para atualizações automáticas de segurança
- CI/CD com auditoria de dependências (`pnpm audit --audit-level=high`)

---

## 5. Direitos dos Titulares (LGPD Art. 18)

| Direito                        | Mecanismo                                                                                     |
| ------------------------------ | --------------------------------------------------------------------------------------------- |
| **Confirmação de existência**  | Endpoint autenticado de consulta de dados                                                     |
| **Acesso**                     | PDF de prontuário disponível para download autenticado                                        |
| **Correção**                   | Campos editáveis via formulário autenticado                                                   |
| **Anonimização / bloqueio**    | Solicitação via DPO; registrada em `audit_log`; efetivada após vencimento de `retentionUntil` |
| **Portabilidade**              | Export de dados em formato JSON disponível via DPO                                            |
| **Eliminação**                 | Após `retentionUntil` (20 anos CFM); solicitações antecipadas tratadas caso a caso            |
| **Revogação de consentimento** | Paciente pode revogar via canal de atendimento; efeito prospectivo                            |

---

## 6. Transferência Internacional de Dados

| Operador     | País                 | Base legal de transferência        |
| ------------ | -------------------- | ---------------------------------- |
| TiDB Cloud   | EU (Frankfurt) / AWS | Cláusulas contratuais padrão; SCCs |
| AWS S3       | us-east-1 (EUA)      | SCCs + adequação                   |
| Sentry       | EUA                  | SCCs                               |
| Google Gmail | EUA                  | SCCs                               |

---

## 7. Conclusão

O tratamento de dados no Facilita PrEP é necessário, proporcional e adequado às finalidades declaradas. Os riscos identificados estão mitigados por controles técnicos e organizacionais. Recomenda-se:

1. Revisão anual deste DPIA ou após mudanças significativas no tratamento
2. Formalizar contrato de DPO com profissional habilitado
3. Registrar este DPIA no RIPD (Registro das Atividades de Tratamento) da organização
4. Notificar a ANPD em caso de incidente com dados sensíveis em até 72h (LGPD Art. 48)

---

_Documento elaborado com base na LGPD (Lei 13.709/2018), guidelines da ANPD e GDPR Art. 35 como referência de melhores práticas._
