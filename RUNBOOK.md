# CIS — Runbook de Recuperação de Desastres

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

1. Acesse o Railway dashboard → projeto `cis` → Deployments.
2. Clique no deploy com falha → aba **Logs** → procure linhas com `ERROR` ou `FATAL`.
3. Verifique se o healthcheck falhou: `GET /api/health` retorna 503?
4. Analise a causa raiz nas causas comuns abaixo.

**Causas comuns e correção:**

| Causa                        | Sintoma no log                                                         | Correção                                                                            |
| ---------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Variável de ambiente ausente | `Variáveis de ambiente inválidas:` seguido de JSON com campos faltando | Adicionar variável faltante em Railway → Variables → redeploy                       |
| Bundle Vite ausente          | `Cannot find module` ou `dist/client/index.html não existe`            | Verificar se `pnpm build` rodou no nixpacks                                         |
| DATABASE_URL inválida        | `Error: connect ECONNREFUSED` ou `TiKV server timeout`                 | Verificar `DATABASE_URL` no Railway Variables                                       |
| Porta errada                 | Container sobe mas healthcheck não alcança                             | Confirmar que `PORT` está definida ou que Railway injeta a variável automaticamente |

**Fix geral:** Corrigir a variável/configuração → Railway dashboard → **Deploy** (botão de redeploy manual).

---

### Cenário B: Redis indisponível

**Sintomas:**

- `GET /api/health` retorna `{ redis: "error" }` ou status 503.
- Jobs BullMQ (PubMed, Digest, CaseSeries) não são processados.
- Logs do servidor mostram `connect ECONNREFUSED` ou `Redis connection failed`.

**Impacto:**

- **Filas paradas:** síntese PubMed, Clinical Digest e Case Series não funcionam.
- **Rate limiting:** cai para in-memory — maior exposição a abuso temporário.
- **Budget Opus:** contador de tokens perde estado — limite diário não é aplicado até Redis voltar.

**Passos de recuperação:**

1. Railway dashboard → serviço **Redis** → botão **Restart**.
2. Aguardar ~30 segundos e verificar `GET /api/health`.
3. Se Redis persistente (AOF/RDB) estava configurado, jobs em fila voltam automaticamente.
4. Se Redis **sem** persistence: jobs perdidos precisam ser reenfileirados manualmente.

> **OBSERVAÇÃO CRÍTICA:** Redis no Railway sem persistence perde **todos os jobs em fila** em caso de reinício. Configurar RDB persistence (snapshot a cada 60 segundos) é obrigatório em produção.

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

### Cenário D: Anthropic API indisponível

**Sintomas:**

- Jobs PubMed e Clinical Digest falham com erro 529 ou 503.
- SOAP notes são geradas sem síntese clínica.
- Logs mostram `overloaded_error` ou `Connection timeout` para `api.anthropic.com`.

**Impacto parcial:** O sistema de consultas e SOAP notes funciona normalmente. Apenas síntese por IA, análise de exames e Clinical Digest são afetados.

**Passos de recuperação:**

1. Verificar status em [https://status.anthropic.com](https://status.anthropic.com).
2. BullMQ executa **retry automático com exponential backoff** — aguardar resolução.
3. Jobs falhos ficam na fila `failed` e podem ser reprocessados manualmente via BullMQ dashboard (Bull Board) após o incidente.

---

### Cenário E: S3 indisponível

**Sintomas:**

- Upload de áudio falha com erro de rede ou S3.
- Logs mostram `NetworkingError` ou `TimeoutError` para `s3.amazonaws.com`.

**Impacto:** Uploads novos bloqueados; áudios já armazenados continuam acessíveis.

**Passos de recuperação:**

1. Verificar status em [https://status.aws.amazon.com](https://status.aws.amazon.com).
2. AWS S3 possui SLA de 99,99% — incidentes geralmente se resolvem automaticamente.
3. Se a região `sa-east-1` estiver afetada, avaliar failover temporário para `us-east-1`.

---

## Seção 3 — DLQ (Dead Letter Queue)

Jobs que falharam após todas as tentativas de retry são movidos para a DLQ (`cis:dlq`).

**Verificar DLQ:**

```bash
# Via endpoint de métricas
curl https://cis.atos.med.br/api/health/metrics
# Resposta: { "dlq": { "count": 0 }, "opus": {...} }
```

**Reprocessar jobs da DLQ:**

```bash
# Via Railway CLI (acessar o container)
railway run --service cis-server node -e "
  const { Queue } = require('bullmq');
  const dlq = new Queue('cis:dlq', { connection: { url: process.env.REDIS_URL } });
  dlq.getJobs(['failed']).then(jobs => {
    jobs.forEach(j => j.retry());
    console.log('Reprocessando', jobs.length, 'jobs');
  });
"
```

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
  5. RTO estimado: < 4 horas.

### Backup manual antes de migration crítica

```bash
mysqldump \
  --host=<TIDB_HOST> --port=4000 \
  --user="$DB_USER" --password="$DB_PASS" \
  --ssl-mode=VERIFY_IDENTITY --single-transaction \
  cis_db | gzip > backup-cis-$(date -u +%Y%m%d-%H%M%S).sql.gz
```

### AWS S3 (Áudio das consultas)

- Habilitar versioning no bucket para proteção contra deleção acidental.
- Restore de arquivo: AWS Console → S3 → bucket → Objects → mostrar versões → selecionar versão anterior.

### Redis (Filas BullMQ)

- **Habilitar RDB persistence:** Railway dashboard → serviço Redis → Variables → adicionar `REDIS_SAVE=60 1`.
- **Impacto sem persistence:** todos os jobs em fila são perdidos em reinício.

### Segredos e Variáveis de Ambiente

- Manter cópia offline encriptada de **todas as variáveis Railway** em gerenciador de senhas corporativo (ex: 1Password, Bitwarden).
- Atualizar a cópia sempre que uma variável for alterada no Railway.
- Nunca armazenar segredos em repositório git.

---

## Seção 5 — Contatos de Emergência

| Papel               | Contato                                                   |
| ------------------- | --------------------------------------------------------- |
| Responsável técnico | Dr. Werciley Saraiva Vieira Junior — werciley@atos.med.br |
| Suporte Railway     | https://railway.app/help                                  |
| Suporte TiDB Cloud  | https://tidbcloud.com/support                             |
| Suporte AWS         | https://aws.amazon.com/support                            |
| Suporte Anthropic   | https://support.anthropic.com                             |
