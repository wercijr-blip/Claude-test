# Pipeline de Conhecimento Clínico — Guia de Instalação

> Configuração completa do pipeline MedScribe → PubMed → Unpaywall → Zotero → Claude → Obsidian → Email

---

## Pré-requisitos

- VPS com Docker e Docker Compose instalados
- Domínio configurado apontando para o VPS (ex: `suaclinica.com.br`)
- MedScribe já instalado e rodando no mesmo VPS
- Obsidian instalado no computador local

---

## Passo 1 — Conta Zotero

1. Acesse [zotero.org](https://www.zotero.org) e crie uma conta gratuita
2. Faça login e acesse **Configurações → Feeds/API** (`zotero.org/settings/keys`)
3. Clique em **Create new private key** e marque:
   - Allow library access ✓
   - Allow write access ✓
4. Copie o **API Key** gerado — você precisará dele depois
5. Seu **User ID** está na mesma página (ex: `1234567`)
6. No Zotero Web, crie uma coleção chamada `Infectologia` (ou a especialidade principal)
7. Clique na coleção → anote o **Collection ID** da URL (ex: `ABCD1234`)

**Variáveis resultantes:**
```
ZOTERO_USER_ID=1234567
ZOTERO_API_KEY=SuaChaveGeradaAqui
ZOTERO_COLLECTION_ID=ABCD1234
```

---

## Passo 2 — Chave NCBI (PubMed)

1. Acesse [ncbi.nlm.nih.gov/account](https://www.ncbi.nlm.nih.gov/account) e crie uma conta gratuita
2. Após login, vá em **Settings → API Key Management**
3. Clique em **Create an API Key**
4. Copie a chave gerada

> A chave NCBI é gratuita e aumenta o limite de requisições de 3/s para 10/s.

**Variável resultante:**
```
NCBI_API_KEY=suachaveaqui
```

---

## Passo 3 — Email para Unpaywall

O Unpaywall não requer cadastro formal — apenas um email profissional real.
Será usado para identificar sua aplicação nas requisições à API.

**Variável resultante:**
```
UNPAYWALL_EMAIL=seu@email.com.br
```

---

## Passo 4 — Conta Sendgrid

1. Acesse [sendgrid.com](https://sendgrid.com) e crie uma conta (gratuito até 100 emails/dia)
2. Verifique seu domínio de email remetente em **Settings → Sender Authentication**
3. Vá em **Settings → API Keys** e clique em **Create API Key**
4. Selecione **Full Access** e copie a chave
5. Defina o email remetente dos boletins (deve ser do domínio verificado)

**Variáveis resultantes:**
```
SENDGRID_API_KEY=SG.suachaveaqui
BULLETIN_FROM_EMAIL=conhecimento@suaclinica.com.br
BULLETIN_FROM_NAME=MedScribe — Conhecimento Clínico
```

---

## Passo 5 — VPS: subir Docker Compose do pipeline

### 5.1 — Criar arquivo de variáveis de ambiente

Crie o arquivo `.env.pipeline` na raiz do projeto MedScribe no VPS:

```bash
# No VPS, na pasta do MedScribe
nano .env.pipeline
```

Cole o conteúdo abaixo preenchendo todos os valores:

```env
# ── MedScribe ────────────────────────────────────────────────────
MEDSCRIBE_URL=https://medscribe.suaclinica.com.br
# Gere com: openssl rand -hex 32
N8N_MEDSCRIBE_KEY=sua_chave_secreta_32_chars_minimo
CLINIC_ID=1

# ── PubMed ───────────────────────────────────────────────────────
NCBI_API_KEY=sua_chave_ncbi

# ── Unpaywall ────────────────────────────────────────────────────
UNPAYWALL_EMAIL=seu@email.com.br

# ── Zotero ───────────────────────────────────────────────────────
ZOTERO_USER_ID=1234567
ZOTERO_API_KEY=SuaChaveZotero
ZOTERO_COLLECTION_ID=ABCD1234

# ── Claude (Anthropic) ───────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-sua-chave-aqui

# ── CouchDB / Obsidian LiveSync ──────────────────────────────────
COUCHDB_URL=https://couchdb.suaclinica.com.br
COUCHDB_USER=admin
COUCHDB_PASSWORD=senha_forte_aqui
COUCHDB_DATABASE=obsidian-knowledge

# ── Email (boletins) ─────────────────────────────────────────────
SENDGRID_API_KEY=SG.suachave
BULLETIN_FROM_EMAIL=conhecimento@suaclinica.com.br
BULLETIN_FROM_NAME=MedScribe — Conhecimento Clínico

# ── n8n ──────────────────────────────────────────────────────────
N8N_USER=admin
N8N_PASSWORD=senha_forte_n8n
N8N_HOST=n8n.suaclinica.com.br
```

### 5.2 — Subir os containers

```bash
# Na pasta do MedScribe no VPS
docker compose -f docker-compose.pipeline.yml --env-file .env.pipeline up -d

# Verificar status
docker compose -f docker-compose.pipeline.yml ps
docker logs n8n --tail 50
docker logs couchdb-obsidian --tail 20
```

### 5.3 — Configurar banco de dados do CouchDB

```bash
# Criar banco do Obsidian
curl -X PUT https://couchdb.suaclinica.com.br/obsidian-knowledge \
  -u admin:senha_forte_aqui

# Criar usuário CORS para o Obsidian local (substitua os valores)
curl -X PUT https://couchdb.suaclinica.com.br/_node/nonode@nohost/_config/httpd/enable_cors \
  -d '"true"' -u admin:senha_forte_aqui

curl -X PUT https://couchdb.suaclinica.com.br/_node/nonode@nohost/_config/cors/origins \
  -d '"*"' -u admin:senha_forte_aqui
```

### 5.4 — Reverso proxy (nginx) — exemplo de configuração

Adicione ao seu nginx.conf (ou crie `/etc/nginx/sites-available/pipeline`):

```nginx
# n8n
server {
    listen 443 ssl;
    server_name n8n.suaclinica.com.br;
    # ... configuração SSL (Let's Encrypt) ...
    location / {
        proxy_pass http://localhost:5678;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}

# CouchDB
server {
    listen 443 ssl;
    server_name couchdb.suaclinica.com.br;
    # ... configuração SSL ...
    location / {
        proxy_pass http://localhost:5984;
        proxy_set_header Host $host;
    }
}
```

---

## Passo 6 — Obsidian: Self-hosted LiveSync

### 6.1 — Instalar plugin

1. No Obsidian, vá em **Configurações → Plugins de terceiros → Navegar**
2. Procure por **Self-hosted LiveSync** e instale
3. Ative o plugin

### 6.2 — Configurar sincronização

Nas configurações do plugin, preencha:

| Campo | Valor |
|---|---|
| Server URL | `https://couchdb.suaclinica.com.br` |
| Username | `admin` (ou usuário CouchDB) |
| Password | sua senha CouchDB |
| Database name | `obsidian-knowledge` |
| Sync Mode | LiveSync |
| Sync on Save | ✓ ativado |

Clique em **Test Connection** — deve aparecer "OK".

### 6.3 — Testar sincronização

1. Crie uma nota manualmente no Obsidian
2. Verifique no CouchDB se ela apareceu:
   ```
   curl https://couchdb.suaclinica.com.br/obsidian-knowledge/_all_docs \
     -u admin:senha
   ```
3. As notas criadas pelo pipeline aparecerão no Obsidian em segundos

---

## Passo 7 — n8n: importar workflows

### 7.1 — Acessar n8n

Acesse `https://n8n.suaclinica.com.br` com o usuário e senha definidos.

### 7.2 — Importar Workflow 1 (Pipeline Diário)

1. No menu lateral, clique em **Workflows → New workflow → Import from file**
2. Selecione o arquivo `n8n/workflow-daily.json` do repositório
3. Revise os nós e confirme que as variáveis de ambiente estão corretas
4. Salve o workflow

### 7.3 — Importar Workflow 2 (Relatório Mensal)

1. Repita o processo com o arquivo `n8n/workflow-monthly.json`
2. Salve o workflow

### 7.4 — Verificar variáveis de ambiente

No n8n, vá em **Settings → Environment Variables** e confirme que todas as variáveis listadas em `.env.pipeline` estão disponíveis. Elas são passadas automaticamente via `docker-compose.pipeline.yml`.

Para acessar nos workflows use: `{{ $env.NOME_DA_VARIAVEL }}`

---

## Passo 8 — MedScribe: atualizar banco de dados

Após fazer deploy das mudanças no servidor do MedScribe, aplique as migrations:

```bash
# Na pasta do MedScribe
pnpm db:push
```

Isso criará as novas tabelas:
- `pubmed_articles`
- `article_topic_links`
- `article_clusters`
- `monthly_evidence_reports`
- `bulletin_send_logs`
- `admin_notifications`

E adicionará as colunas `receive_monthly_bulletin` e `bulletin_email` na tabela `users`.

### Configurar médicos para receber boletim

No painel admin do MedScribe (ou via SQL direto), ative o boletim para cada médico:

```sql
UPDATE users
SET receive_monthly_bulletin = true,
    bulletin_email = 'dr.silva@suaclinica.com.br'
WHERE id = 1;
```

### Configurar a variável N8N_MEDSCRIBE_KEY no MedScribe

Adicione ao `.env` do MedScribe:

```env
N8N_MEDSCRIBE_KEY=sua_chave_secreta_32_chars_minimo
```

> **Importante:** use a mesma chave definida no `.env.pipeline`.

---

## Passo 9 — Teste end-to-end

### 9.1 — Criar tópico de teste

Via MedScribe (dashboard do médico ou API), crie um tópico de conhecimento:

```json
{
  "status": "pending",
  "medical_specialty": "Infectologia",
  "specialty_category": "Doenças Infecciosas",
  "topic": "PrEP — eficácia em MSM",
  "pubmed_query": "PrEP HIV MSM efficacy 2023[pdat]",
  "subtopics": ["HIV", "Prevenção", "MSM"],
  "clinic_id": 1
}
```

### 9.2 — Executar workflow manualmente

1. No n8n, abra o Workflow 1 (Pipeline Diário)
2. Clique em **Test workflow** (executa uma vez manualmente)
3. Acompanhe a execução nó por nó

### 9.3 — Verificar resultados

Após a execução bem-sucedida, verifique:

- [ ] Artigo apareceu na tabela `pubmed_articles` do banco
- [ ] Referência criada no Zotero (acesse `zotero.org/[user_id]/`)
- [ ] Nota `.md` apareceu no Obsidian local (aguarde ~30 segundos)
- [ ] Tópico marcado como `done` no MedScribe
- [ ] Resumo Claude presente na nota do Obsidian

```bash
# Verificar no banco
mysql -h localhost -u facilita -p facilita_prep \
  -e "SELECT pmid, title, total_notes_generated FROM pubmed_articles LIMIT 5;"
```

---

## Passo 10 — Ativar agendamentos

Após validar o pipeline com testes manuais:

### Workflow 1 — Pipeline Diário

1. No n8n, abra o Workflow 1
2. Clique no toggle **Active** para ativar
3. O workflow passará a executar **a cada 1 hora** automaticamente

### Workflow 2 — Relatório Mensal

1. Abra o Workflow 2 no n8n
2. Ative o toggle **Active**
3. Executará automaticamente no **dia 1 de cada mês às 08h00**

---

## Variáveis de Ambiente — Referência Completa

### `.env.pipeline` (containers Docker do pipeline)

```env
# MedScribe
MEDSCRIBE_URL=https://medscribe.suaclinica.com.br
N8N_MEDSCRIBE_KEY=chave_minimo_32_chars          # openssl rand -hex 32
CLINIC_ID=1

# PubMed
NCBI_API_KEY=sua_chave_ncbi_gratuita

# Unpaywall
UNPAYWALL_EMAIL=email@suaclinica.com.br

# Zotero
ZOTERO_USER_ID=1234567
ZOTERO_API_KEY=SuaChaveZotero
ZOTERO_COLLECTION_ID=ABCD1234

# Claude
ANTHROPIC_API_KEY=sk-ant-api03-...

# CouchDB / Obsidian
COUCHDB_URL=https://couchdb.suaclinica.com.br
COUCHDB_USER=admin
COUCHDB_PASSWORD=senha_forte
COUCHDB_DATABASE=obsidian-knowledge

# Sendgrid
SENDGRID_API_KEY=SG.suachave
BULLETIN_FROM_EMAIL=conhecimento@suaclinica.com.br
BULLETIN_FROM_NAME=MedScribe — Conhecimento Clínico

# n8n
N8N_USER=admin
N8N_PASSWORD=senha_n8n_forte
N8N_HOST=n8n.suaclinica.com.br
```

### Adições ao `.env` do MedScribe

```env
# Pipeline de conhecimento
N8N_MEDSCRIBE_KEY=chave_minimo_32_chars          # mesma do .env.pipeline
COUCHDB_URL=https://couchdb.suaclinica.com.br
COUCHDB_USER=admin
COUCHDB_PASSWORD=senha_forte
COUCHDB_DATABASE=obsidian-knowledge
NCBI_API_KEY=sua_chave_ncbi
ZOTERO_USER_ID=1234567
ZOTERO_API_KEY=SuaChaveZotero
ZOTERO_COLLECTION_ID=ABCD1234
UNPAYWALL_EMAIL=email@suaclinica.com.br
SENDGRID_API_KEY=SG.suachave
BULLETIN_FROM_EMAIL=conhecimento@suaclinica.com.br
BULLETIN_FROM_NAME=MedScribe — Conhecimento Clínico
```

---

## Arquitetura do Pipeline

```
Consulta médica
      │
      ▼
MedScribe cria tópico (status: pending)
      │
      ▼ (a cada 1h — n8n Workflow 1)
PubMed API ──→ até 3 artigos relevantes
      │
      ▼
Unpaywall ──→ PDF gratuito (se disponível)
      │
      ▼
Banco já tem? ──Sim──→ reutiliza zotero_item_key
      │ Não
      ▼
Zotero API ──→ salva referência + PDF
      │
      ▼
MedScribe DB ──→ pubmed_articles + article_topic_links
      │
      ▼
Claude API ──→ resumo clínico em português
      │
      ▼
CouchDB ──→ nota .md (sincroniza com Obsidian local)
      │
      ▼
MedScribe ──→ marca tópico como done


(Dia 1 de cada mês — n8n Workflow 2)
      │
      ▼
Agrupa por especialidade + calcula métricas
      │
      ▼
Claude API ──→ panorama do mês
      │
      ▼
Claude API ──→ clustering de artigos
      │
      ▼
Claude API ──→ meta-análise por cluster (nível A/B/C)
      │
      ▼
MedScribe DB ──→ article_clusters + monthly_evidence_reports
      │
      ▼
CouchDB ──→ nota mensal por especialidade
      │
      ▼
Sendgrid ──→ boletim personalizado para cada médico
      │
      ▼
MedScribe ──→ notificação para admin
```

---

## Solução de Problemas

### n8n não consegue acessar MedScribe

Verifique se os containers estão na mesma rede Docker ou se o MEDSCRIBE_URL usa o host externo correto.

```bash
docker exec n8n curl -s http://host.docker.internal:3000/health
```

### CouchDB retorna erro de CORS

```bash
# Verificar configuração CORS
curl https://couchdb.suaclinica.com.br/_node/nonode@nohost/_config/cors \
  -u admin:senha
```

### PubMed retorna 429 (rate limit)

A chave NCBI aumenta o limite. Confirme que `NCBI_API_KEY` está preenchida no `.env.pipeline`.

### Artigos não aparecem no Obsidian

1. Verifique se o plugin Self-hosted LiveSync está ativo
2. Teste a conexão nas configurações do plugin
3. Verifique logs do CouchDB: `docker logs couchdb-obsidian --tail 50`

### Claude retorna erro de quota

Verifique o saldo na conta Anthropic (`console.anthropic.com`) e confirme que `ANTHROPIC_API_KEY` está correta no `.env.pipeline`.

---

*Documentação gerada para MedScribe — Pipeline de Conhecimento Clínico*
*Versão: 1.0 | Data: 2026-04*
