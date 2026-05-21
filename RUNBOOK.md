# Facilita PrEP — RUNBOOK

> Procedimentos operacionais para incidentes em produção.
> Manter atualizado a cada mudança de infraestrutura.

---

## Contatos de Emergência

| Papel | Responsável | Canal |
|-------|-------------|-------|
| Desenvolvedor | Werciley | WhatsApp pessoal |
| Railway Support | — | https://railway.app/help |
| TiDB Cloud | — | https://tidbcloud.com/support |
| Upstash Redis | — | https://upstash.com/support |
| AWS S3 | — | https://console.aws.amazon.com/support |

---

## 1. Banco de dados inoperante (TiDB)

**Sintomas:** `/api/health` retorna `"db": "error"` ou 503; logs mostram `ECONNREFUSED` ou timeout em query Drizzle.

**Diagnóstico:**
```bash
# Verificar status atual
curl https://facilitaprep.com.br/api/health | jq .

# Ver logs de banco no Railway
# Dashboard → claude-test → Logs → filtrar "db" ou "ECONNREFUSED"
```

**Ações:**
1. Verificar status do TiDB Cloud: https://status.pingcap.com
2. Confirmar que `DATABASE_URL` está correto em Railway → Variables
3. TiDB Cloud: verificar se IP egress do Railway está na allowlist (conexões vêm de IPs variáveis — usar `0.0.0.0/0` em dev, ou configurar Railway Private Networking)
4. Se conexão expirou por inatividade: a primeira query vai reconectar automaticamente (Drizzle usa pool)
5. Se TiDB em manutenção: aguardar recovery; Railway não drena novas conexões enquanto DB está down, então o serviço ficará em loop de erro. **Não reiniciar** — aguardar DB voltar e as queries vão recuperar sozinhas

**Recovery check:**
```bash
curl https://facilitaprep.com.br/api/health/deep | jq .checks
```

---

## 2. Redis inoperante (Upstash)

**Sintomas:** `/api/health` retorna `"redis": "error"`; rate limiting e sessões param de funcionar; workers BullMQ param de processar jobs.

**Diagnóstico:**
```bash
curl https://facilitaprep.com.br/api/health | jq .redis
```

**Ações:**
1. Verificar status do Upstash: https://status.upstash.com
2. Confirmar `REDIS_URL` em Railway → Variables
3. Upstash tem limite de 500k comandos/mês no plano gratuito — verificar dashboard se o limite foi atingido
4. Se Redis está down: a aplicação continua servindo (rate limiters falham aberto), mas workers BullMQ ficam parados

**Impacto de Redis down:**
- Rate limiting: falha aberto (não bloqueia requests)
- BullMQ workers: param de processar; jobs ficam enfileirados e serão processados quando Redis voltar
- Dedup nutricao: emails de nutrição podem ser reenviados após recovery (TTL = 25h)

**Recovery:** Redis recovery é automático; workers retomam processamento sem restart

---

## 3. Deploy travado no Railway

**Sintomas:** Deploy em "Building..." ou "Deploying..." por mais de 10 minutos sem completar.

**Ações:**
1. Railway Dashboard → claude-test → Deployments → clicar no deploy travado
2. Verificar logs de build para erros explícitos (`pnpm install`, `tsc`, `vite build`)
3. Se stuck em "Deploying": clicar em **Cancel** e fazer redeploy manual
4. Se o build completou mas o serviço não responde: verificar se `dist/client/index.html` existe (o servidor faz smoke check no boot e sai com código 1 se ausente)

**Rollback:**
1. Railway Dashboard → Deployments → escolher deploy anterior → **Redeploy**
2. Confirmar rollback: `curl https://facilitaprep.com.br/api/health/version | jq .commit`

**Variáveis de ambiente faltando após deploy:**
1. Railway → Variables → verificar se todas as variáveis obrigatórias estão presentes
2. Variáveis obrigatórias: `DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_KEY`, `CPF_HASH_SALT`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `OWNER_OPEN_ID`
3. O servidor valida o schema de env no boot via Zod e sai com código 1 se algo estiver faltando — os logs mostram exatamente qual variável está errada

---

## 4. Variável de ambiente incorreta ou ausente

**Sintomas:** Servidor não sobe; logs mostram `❌ Variáveis de ambiente inválidas:` seguido de JSON com os erros.

**Diagnóstico:**
```
# Nos logs do Railway (primeiros segundos do boot):
❌ Variáveis de ambiente inválidas:
{ "ENCRYPTION_KEY": ["String must contain exactly 64 character(s)"] }
```

**Ações:**
1. Railway → Service → Variables → corrigir a variável indicada
2. Fazer redeploy (Railway redeploy automático quando variável muda)
3. Para gerar valores corretos:
   - `JWT_SECRET` (mín 32 chars): `openssl rand -hex 32`
   - `ENCRYPTION_KEY` (64 hex chars): `openssl rand -hex 32`
   - `CPF_HASH_SALT` (mín 32 chars): `openssl rand -hex 32`
   - `OPS_TOKEN` (mín 32 chars): `openssl rand -hex 32`
   - `TOTP_ENC_KEY` (64 hex chars): `openssl rand -hex 32`

---

## 5. Workers BullMQ parados

**Sintomas:** PDFs não são gerados; e-mails de lembrete não são enviados; `/api/metrics` mostra filas crescendo.

**Diagnóstico:**
```bash
# Requer OPS_TOKEN configurado
curl -H "x-ops-token: $OPS_TOKEN" https://facilitaprep.com.br/api/metrics | jq .queues
```

**Ações:**
1. Verificar se Redis está ok (workers dependem de Redis)
2. Verificar logs do Railway para erros nos workers
3. Workers rodam em-processo (mesmo serviço Express) por padrão — um restart do serviço reinicia os workers
4. Se `WORKERS_ENABLED=false` foi acidentalmente configurado: remover a variável (padrão é `true`)
5. Restart do serviço: Railway Dashboard → claude-test → **Restart**

---

## 6. Certificado ICP-Brasil expirando

**Sintomas:** Logs mostram `[cert] Certificado ICP-Brasil expira em breve` no boot; PDFs gerados sem assinatura válida.

**Ações:**
1. Verificar dias restantes nos logs de boot
2. Solicitar renovação do certificado A3 junto ao ICP-Brasil com antecedência de 30 dias
3. Após renovação: exportar novo `.pfx` e atualizar `ICP_PFX_BASE64` no Railway:
   ```bash
   base64 -w 0 novo-cert.pfx | pbcopy  # macOS
   base64 -w 0 novo-cert.pfx | xclip   # Linux
   ```
4. Atualizar `ICP_PFX_PASSWORD` se a senha mudou
5. Fazer redeploy e verificar que os logs não mostram mais o aviso

---

## 7. Site fora do ar — diagnóstico rápido

```bash
# 1. Ping superficial
curl -o /dev/null -s -w "%{http_code}" https://facilitaprep.com.br/api/health

# 2. Diagnóstico completo
curl https://facilitaprep.com.br/api/health/deep | jq .

# 3. Versão em produção
curl https://facilitaprep.com.br/api/health/version | jq .

# 4. Métricas de filas (requer token)
curl -H "x-ops-token: $OPS_TOKEN" https://facilitaprep.com.br/api/metrics | jq .
```

**Árvore de decisão:**
- HTTP 502/503 da Railway → container crashou → ver logs → corrigir e redeploy
- HTTP 503 do próprio servidor → DB ou Redis down → seções 1 e 2 acima
- HTTP 200 mas SPA não carrega → build Vite ausente ou corrompido → redeploy forçando novo build
- DNS não resolve → verificar configuração DNS do domínio no registrar

---

## 8. Plano de comunicação durante incidentes

| Duração | Ação |
|---------|------|
| < 15 min | Sem comunicação externa — corrigir silenciosamente |
| 15–60 min | Notificar por WhatsApp pacientes com atendimento ativo no dia |
| > 60 min | Postar status em @facilitaprep (Instagram) + responder DMs ativamente |
| > 4h | Considerar reembolso proativo de pagamentos realizados durante a janela |

**Mensagem padrão para pacientes:**
> "Olá! Estamos cientes de uma instabilidade temporária no sistema Facilita PrEP. Nossa equipe está trabalhando para resolver. Seu atendimento está garantido e entraremos em contato assim que o sistema voltar ao normal. Pedimos desculpas pelo transtorno."

---

## 9. Pós-incidente

Após resolução de qualquer incidente de P1 (site fora) ou P2 (feature crítica inoperante):

1. Documentar no CHANGELOG.md: data, duração, causa raiz, ação corretiva
2. Abrir issue no repositório com label `incident` se causa raiz foi bug de código
3. Avaliar se o scorecard técnico precisa ser revisado (especialmente D07)
