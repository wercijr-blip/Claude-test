# Facilita PrEP — Runbook de Recuperação de Desastres

> Documento vivo. Atualizar sempre que a infraestrutura mudar.
> Última revisão: 2026-05-19

---

## Seção 1 — Definições de SLA

| Métrica                                 | Objetivo     |
| --------------------------------------- | ------------ |
| **RTO — Banco de Dados / Redis**        | < 1 hora     |
| **RTO — Reinício de container Railway** | < 30 minutos |
| **RPO — Dados de pacientes**            | < 24 horas   |

---

## Seção 2 — Cenários de Falha e Passos de Recuperação

### Cenário A: Railway container não inicia

**Sintomas:** Deploy aparece como "Failed" ou "Crashed" no Railway dashboard; aplicação inacessível.

**Diagnóstico:**

1. Acesse o Railway dashboard → projeto `facilita-prep` → Deployments.
2. Clique no deploy com falha → aba **Logs** → procure linhas com `❌`.
3. Verifique se o healthcheck falhou: `GET /api/health` retorna 503?
4. Analise a causa raiz nas causas comuns abaixo.

**Causas comuns e correção:**

| Causa                        | Sintoma no log                                                            | Correção                                                                            |
| ---------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Variável de ambiente ausente | `❌ Variáveis de ambiente inválidas:` seguido de JSON com campos faltando | Adicionar variável faltante em Railway → Variables → redeploy                       |
| Bundle Vite ausente          | `Cannot find module './dist/index.js'` ou similar                         | Verificar se `pnpm build` rodou no Dockerfile/nixpacks                              |
| Certificado PFX inválido     | `Error: mac verify failure` ou `Error loading ICP certificate`            | Regenerar `ICP_PFX_BASE64` (ver Seção 3)                                            |
| Porta errada                 | Container sobe mas healthcheck não alcança                                | Confirmar que `PORT` está definida ou que Railway injeta a variável automaticamente |

**Fix geral:** Corrigir a variável/configuração → Railway dashboard → **Deploy** (botão de redeploy manual).

---

### Cenário B: Redis indisponível

**Sintomas:**

- `GET /api/health` retorna `{ redis: "error" }` ou status 503.
- Jobs de PDF, PubMed e Digest não são processados.
- Logs do servidor mostram `connect ECONNREFUSED` ou `Redis connection failed`.

**Impacto:**

- **Filas paradas:** geração de PDFs, busca PubMed e Clinical Digest não funcionam.
- **Rate limiting:** cai para armazenamento em memória local — aceita mais requisições do que o normal (risco de abuso temporário).
- **Budget Opus:** contador de tokens perde o estado — limite diário não é aplicado até Redis voltar.

**Passos de recuperação:**

1. Railway dashboard → serviço **Redis** → botão **Restart**.
2. Aguardar ~30 segundos e verificar `GET /api/health`.
3. Se Redis persistente (AOF/RDB) estava configurado, jobs em fila voltam automaticamente após reconexão do BullMQ.
4. Se Redis **sem** persistence: jobs perdidos precisam ser reenfileirados manualmente ou aguardar próximo trigger.

> **OBSERVACAO CRITICA:** Redis no Railway sem persistence perde **todos os jobs em fila** em caso de reinício. Configurar RDB persistence (snapshot a cada 60 segundos) é obrigatório para ambiente de produção. Ver Seção 4.

---

### Cenário C: TiDB indisponível

**Sintomas:**

- `GET /api/health` retorna `{ db: "error" }`.
- Todos os endpoints retornam 503 ou `Internal Server Error`.
- Logs mostram `ERROR 9002 (HY000): TiKV server timeout` ou similar.

**Impacto:** Total — sistema inoperante para leitura e escrita de dados.

**Passos de recuperação:**

1. Verificar status em [https://status.tidbcloud.com](https://status.tidbcloud.com).
2. TiDB Cloud possui HA multi-réplica — incidentes geralmente se resolvem automaticamente em **30–60 segundos**.
3. Se a interrupção persistir por mais de 5 minutos, abrir ticket de suporte em [https://tidbcloud.com/support](https://tidbcloud.com/support).
4. Para restaurar a partir de backup, ver Seção 4.

---

### Cenário D: Certificado ICP-Brasil expirado

**Sintomas:**

- Geração de PDFs falha com erro de assinatura (logs: `Error: mac verify failure` ou `certificate has expired`).
- Aba "Certificado ICP" no painel admin exibe indicador vermelho.

**Passos de recuperação:**

1. Obter novo certificado A3 ICP-Brasil junto a uma AC credenciada pelo CFM (ex: Serasa, Certisign, Valid).
2. Exportar o arquivo `.pfx` a partir do token A3 (software do fabricante do token).
3. Gerar a representação base64:
   ```bash
   base64 -w 0 novo_certificado.pfx > novo_certificado.b64
   ```
4. Atualizar as variáveis no Railway:
   - `ICP_PFX_BASE64` ← conteúdo do arquivo `.b64`
   - `ICP_PFX_PASSWORD` ← senha do certificado
5. Redeploy manual no Railway dashboard.
6. Verificar aba "Certificado ICP" no painel admin — deve exibir indicador verde com nova data de validade.

**Prevenção:** O painel admin exibe alerta **60 dias antes** da expiração. Configurar automação via n8n para notificar por e-mail/WhatsApp nessa janela.

---

### Cenário E: Anthropic API indisponível

**Sintomas:**

- Jobs PubMed e Clinical Digest falham com erro 529 ou 503.
- SOAP notes são geradas sem síntese clínica.
- Logs mostram `overloaded_error` ou `Connection timeout` para `api.anthropic.com`.

**Impacto parcial:** O sistema de SOAP notes e formulários clínicos funciona normalmente. Apenas síntese por IA, análise de exames e Clinical Digest são afetados.

**Passos de recuperação:**

1. Verificar status em [https://status.anthropic.com](https://status.anthropic.com).
2. BullMQ executa **retry automático com exponential backoff** — aguardar resolução do incidente da Anthropic.
3. Jobs falhos ficam na fila `failed` e podem ser reprocessados manualmente via BullMQ dashboard (Bull Board) após o incidente.
4. Não é necessário intervenção manual, a menos que o incidente dure mais de 24 horas.

---

### Cenário F: S3 indisponível

**Sintomas:**

- Upload de exames falha com erro de rede ou S3.
- Logs mostram `NetworkingError` ou `TimeoutError` para `s3.amazonaws.com`.

**Impacto:** Uploads novos bloqueados; exames já armazenados continuam acessíveis (URLs pré-assinadas com cache).

**Passos de recuperação:**

1. Verificar status em [https://status.aws.amazon.com](https://status.aws.amazon.com).
2. AWS S3 possui SLA de 99,99% — incidentes geralmente se resolvem automaticamente.
3. Se a região `sa-east-1` estiver afetada, avaliar failover temporário para `us-east-1` alterando `AWS_REGION` e `AWS_S3_BUCKET` no Railway.

---

## Seção 3 — Renovação de Certificado ICP-Brasil

O certificado A3 ICP-Brasil utilizado para assinatura digital de PDFs possui validade de 1 a 3 anos. O painel admin exibe alerta **60 dias antes** da expiração.

**Procedimento de renovação anual:**

1. **Iniciar processo com antecedência de 30 dias** (alerta aparece em 60 dias, mas processos de renovação com AC podem levar dias).
2. Acessar a Autoridade Certificadora (AC) que emitiu o certificado anterior (ex: Serasa Experian, Certisign, Valid).
3. Solicitar renovação do certificado A3 com os mesmos dados do médico (CPF, CRM).
4. Após emissão, conectar o token A3 ao computador e exportar o arquivo `.pfx` via software do fabricante.
5. Gerar base64 e atualizar Railway (passos 3–5 do Cenário D acima).
6. Testar em ambiente de homologação antes de aplicar em produção:
   ```bash
   pnpm test server/pdfSigner.test.ts
   ```
7. Confirmar no painel admin que a nova data de validade está correta.
8. Guardar cópia do `.pfx` em cofre de senhas corporativo (ver Seção 4).

---

## Seção 4 — Backup e Restore

### TiDB Cloud (Banco de Dados)

- **Backup:** automático diário pela plataforma TiDB Cloud (retenção: 7 dias por padrão).
- **Verificar backups:** TiDB Cloud console → cluster → aba **Backups**.
- **Restore:**
  1. TiDB Cloud console → cluster → Backups → selecionar ponto de restore.
  2. Clicar em **Restore** → confirmar.
  3. O restore cria um novo cluster; redirecionar `DATABASE_URL` para o cluster restaurado.
  4. Após validação, atualizar `DATABASE_URL` no Railway e redeploy.

### AWS S3 (Exames e Documentos)

- **Habilitar versioning:** AWS Console → S3 → bucket `facilita-prep-exames-*` → Properties → **Bucket Versioning** → Enable.
- **Restore de arquivo deletado:**
  1. AWS Console → S3 → bucket → Objects → mostrar versões.
  2. Selecionar a versão anterior desejada → **Restore**.

### Redis (Filas BullMQ)

- **Habilitar RDB persistence no Railway Redis:**
  1. Railway dashboard → serviço Redis → Variables.
  2. Adicionar: `REDIS_SAVE=60 1` (snapshot a cada 60 segundos se houver pelo menos 1 mudança).
- **Impacto sem persistence:** todos os jobs em fila são perdidos em reinício.
- **Restore:** Com persistence habilitada, jobs voltam automaticamente após reinício.

### Segredos e Variáveis de Ambiente

- Manter cópia offline encriptada de **todas as variáveis Railway** em gerenciador de senhas corporativo (ex: 1Password, Bitwarden).
- Incluir na cópia: arquivo `.pfx` do certificado ICP-Brasil e senha correspondente.
- Atualizar a cópia sempre que uma variável for alterada no Railway.
- Nunca armazenar segredos em repositório git ou documentos não encriptados.

---

## Seção 5 — Contatos de Emergência

| Papel               | Contato                               |
| ------------------- | ------------------------------------- |
| Responsável técnico | [PREENCHER — nome, e-mail e telefone] |
| Suporte Railway     | https://railway.app/help              |
| Suporte TiDB Cloud  | https://tidbcloud.com/support         |
| Suporte AWS         | https://aws.amazon.com/support        |
| Suporte Anthropic   | https://support.anthropic.com         |
