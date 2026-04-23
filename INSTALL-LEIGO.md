# Guia de Instalação — Pipeline de Conhecimento Clínico
### Para quem nunca mexeu com servidor

> **Situação:** O MedScribe já está rodando no seu VPS. Vamos instalar o pipeline de conhecimento na mesma máquina, sem afetar nada que já existe.

---

## Antes de começar

Você vai precisar de:
- Acesso ao terminal do seu VPS (SSH)
- O endereço do seu VPS (IP ou domínio)
- A senha de acesso ao servidor
- Cerca de **1 hora** para fazer tudo com calma

**O que vai acontecer:** Vamos instalar dois programas novos no servidor (n8n e CouchDB), criar contas em alguns serviços gratuitos, e conectar tudo ao MedScribe. No final, toda vez que um médico registrar um caso, o sistema vai buscar artigos científicos automaticamente e criar notas no Obsidian.

---

## PARTE 1 — Criar as contas externas (faça no seu computador)

### 1.1 — Conta no Zotero (gerenciador de referências)

O Zotero vai guardar todos os artigos científicos encontrados, como uma biblioteca digital.

1. Abra o navegador e acesse: **zotero.org**
2. Clique em **Register** (canto superior direito)
3. Preencha: nome de usuário, email e senha → clique em **Register**
4. Confirme seu email (verifique a caixa de entrada)
5. Faça login no site
6. No menu superior, clique no seu nome → **Settings**
7. No menu lateral esquerdo, clique em **Feeds/API**
8. Anote o número que aparece em **Your userID**: `_______` ← escreva aqui
9. Role a página para baixo até **API keys**
10. Clique em **Create new private key**
11. Em **Key Description** coloque: `MedScribe Pipeline`
12. Marque as caixas:
    - ✓ Allow library access
    - ✓ Allow write access
13. Clique em **Save Key**
14. **IMPORTANTE:** Copie a chave que aparecer (ex: `AbCdEf1234567890`) — ela só aparece uma vez!
    Chave: `_______________________________` ← cole aqui

Agora crie a coleção de artigos:
15. Ainda no site do Zotero, clique em **My Library** (menu superior)
16. Clique no botão **+** ao lado de "My Library" para criar uma coleção
17. Nome da coleção: `Pipeline Clínico` → OK
18. Clique na coleção criada
19. Olhe a URL do navegador — vai aparecer algo assim:
    `https://www.zotero.org/seuusuario/collections/ABCD1234`
20. Anote o código no final da URL: `_______` ← esse é o Collection ID

---

### 1.2 — Chave do PubMed (gratuita)

Permite buscar mais artigos por hora sem ser bloqueado.

1. Acesse: **ncbi.nlm.nih.gov/account**
2. Clique em **Sign in with NCBI** → **Register for an NCBI account**
3. Preencha os dados e confirme o email
4. Após login, clique no seu nome → **Account Settings**
5. Role até a seção **API Key Management**
6. Clique em **Create an API Key**
7. Anote a chave gerada: `_______________________________` ← cole aqui

---

### 1.3 — Conta no SendGrid (envio de emails)

Vai enviar os boletins mensais para os médicos. Gratuito até 100 emails/dia.

1. Acesse: **sendgrid.com**
2. Clique em **Start For Free**
3. Preencha o cadastro com seu email profissional
4. Confirme o email
5. No painel do SendGrid, no menu lateral: **Settings → Sender Authentication**
6. Clique em **Verify a Single Sender**
7. Preencha com o email que vai enviar os boletins (ex: `conhecimento@suaclinica.com.br`)
8. Clique no link de confirmação que chegar no email
9. Volte ao SendGrid → menu lateral: **Settings → API Keys**
10. Clique em **Create API Key**
11. Nome: `MedScribe Pipeline` → selecione **Full Access** → **Create & View**
12. Copie a chave (começa com `SG.`): `_______________________________` ← cole aqui

---

### 1.4 — Chave do Claude/Anthropic

O Claude vai gerar os resumos clínicos e as meta-análises.

> Se você já tem uma chave do Claude no MedScribe, pode usar a mesma. Verifique no arquivo `.env` do MedScribe a variável `BUILT_IN_FORGE_API_KEY`.

Para criar uma nova:
1. Acesse: **console.anthropic.com**
2. Faça login ou crie uma conta
3. No menu lateral: **API Keys → Create Key**
4. Nome: `MedScribe Pipeline` → Create
5. Copie a chave (começa com `sk-ant-`): `_______________________________`

---

## PARTE 2 — Conectar ao servidor (VPS)

### 2.1 — Abrir o terminal

**No Windows:**
- Pressione `Win + R`, digite `cmd`, pressione Enter
- Ou instale o **Windows Terminal** pela Microsoft Store (recomendado)

**No Mac:**
- Pressione `Cmd + Espaço`, digite `Terminal`, pressione Enter

### 2.2 — Conectar ao VPS

No terminal, digite (substituindo pelos seus dados):

```bash
ssh root@IP_DO_SEU_VPS
```

> Se o seu provedor usa usuário diferente de `root`, use o que foi fornecido (ex: `ubuntu`, `admin`).

Quando perguntar `Are you sure you want to continue connecting?` → digite `yes` e pressione Enter.

Digite sua senha quando solicitado (os caracteres não aparecem na tela — isso é normal).

**✓ Checkpoint:** Se aparecer algo como `root@seuservidor:~#` você está dentro do servidor.

---

### 2.3 — Encontrar a pasta do MedScribe

No servidor, execute:

```bash
find / -name "docker-compose.yml" 2>/dev/null | grep -v pipeline | head -5
```

Vai aparecer o caminho onde o MedScribe está instalado. Geralmente é algo como `/root/medscribe` ou `/home/ubuntu/medscribe`.

**Anote a pasta:** `_______________________________`

Navegue até ela:

```bash
cd /root/medscribe
```
> Substitua `/root/medscribe` pela pasta que você encontrou acima.

**✓ Checkpoint:** Execute `ls` — deve aparecer arquivos como `package.json`, `docker-compose.yml`, etc.

---

## PARTE 3 — Criar as contas no servidor

### 3.1 — Criar o arquivo de configuração do pipeline

Ainda na pasta do MedScribe, crie o arquivo de configuração:

```bash
nano .env.pipeline
```

O terminal vai abrir um editor de texto. Cole o conteúdo abaixo, **substituindo todos os valores entre `< >` pelos dados que você anotou nas etapas anteriores:**

```env
# ═══════════════════════════════════════════
# CONFIGURAÇÃO DO PIPELINE — PREENCHA TUDO
# ═══════════════════════════════════════════

# MedScribe — URL pública da sua instalação
MEDSCRIBE_URL=https://<seu-dominio-medscribe.com.br>

# Chave secreta para comunicação interna (qualquer texto longo, sem espaços)
# Sugestão: use o gerador abaixo para criar uma chave segura
N8N_MEDSCRIBE_KEY=<gere-uma-chave-abaixo>

# ID da sua clínica no MedScribe (geralmente 1 se for a primeira)
CLINIC_ID=1

# PubMed
NCBI_API_KEY=<sua-chave-ncbi>

# Unpaywall — seu email profissional (sem cadastro)
UNPAYWALL_EMAIL=<seu@email.com.br>

# Zotero
ZOTERO_USER_ID=<seu-user-id-zotero>
ZOTERO_API_KEY=<sua-chave-zotero>
ZOTERO_COLLECTION_ID=<collection-id-zotero>

# Claude (Anthropic)
ANTHROPIC_API_KEY=<sua-chave-anthropic>

# CouchDB — banco de dados do Obsidian (você cria a senha agora)
COUCHDB_URL=https://couchdb.<seu-dominio.com.br>
COUCHDB_USER=admin
COUCHDB_PASSWORD=<crie-uma-senha-forte-para-o-couchdb>
COUCHDB_DATABASE=obsidian-knowledge

# SendGrid — envio dos boletins mensais
SENDGRID_API_KEY=<sua-chave-sendgrid>
BULLETIN_FROM_EMAIL=<email-remetente-verificado-no-sendgrid>
BULLETIN_FROM_NAME=MedScribe — Conhecimento Clínico

# n8n — painel de automações (você cria o usuário/senha agora)
N8N_USER=admin
N8N_PASSWORD=<crie-uma-senha-forte-para-o-n8n>
N8N_HOST=n8n.<seu-dominio.com.br>
```

**Para gerar a chave N8N_MEDSCRIBE_KEY**, abra um segundo terminal e execute:
```bash
openssl rand -hex 32
```
Copie o resultado e cole no lugar de `<gere-uma-chave-abaixo>`.

Após preencher tudo:
- Pressione `Ctrl + X`
- Pressione `Y` para confirmar
- Pressione `Enter` para salvar

**✓ Checkpoint:** Execute `cat .env.pipeline` — deve aparecer o arquivo preenchido.

---

### 3.2 — Adicionar as variáveis ao MedScribe também

O MedScribe precisa conhecer a chave do pipeline para aceitar as chamadas automáticas. Execute:

```bash
# Verifique como está o .env atual do MedScribe
cat .env | grep N8N
```

Se não aparecer nada, execute o comando abaixo para adicionar as variáveis (substitua os valores):

```bash
cat >> .env << 'ENVEOF'

# Pipeline de conhecimento clínico
N8N_MEDSCRIBE_KEY=<mesma-chave-do-.env.pipeline>
ENVEOF
```

> **Importante:** Use exatamente a mesma `N8N_MEDSCRIBE_KEY` que você colocou no `.env.pipeline`.

---

## PARTE 4 — Subir o pipeline no servidor

### 4.1 — Iniciar n8n e CouchDB

Execute o comando abaixo (uma linha só):

```bash
docker compose -f docker-compose.pipeline.yml --env-file .env.pipeline up -d
```

Vai aparecer texto rolando na tela com downloads. Aguarde até voltar ao prompt `#`.

Verifique se tudo subiu:

```bash
docker compose -f docker-compose.pipeline.yml ps
```

**✓ Checkpoint:** Deve aparecer uma lista com `n8n` e `couchdb-obsidian` com status `Up` ou `running`.

Se aparecer `Exit` ou `Error`, execute para ver o erro:
```bash
docker logs n8n --tail 30
docker logs couchdb-obsidian --tail 30
```

---

### 4.2 — Configurar o proxy (para acessar pelo navegador)

Para acessar o n8n e o CouchDB pelo endereço do site, precisamos configurar o nginx (programa que gerencia os endereços).

Primeiro, veja como o MedScribe está configurado no nginx:

```bash
ls /etc/nginx/sites-available/
```

Crie a configuração para os novos serviços:

```bash
nano /etc/nginx/sites-available/pipeline
```

Cole o conteúdo abaixo (substitua `seu-dominio.com.br` pelo seu domínio):

```nginx
# n8n — painel de automações
server {
    listen 80;
    server_name n8n.seu-dominio.com.br;

    location / {
        proxy_pass http://localhost:5678;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}

# CouchDB — banco do Obsidian
server {
    listen 80;
    server_name couchdb.seu-dominio.com.br;

    location / {
        proxy_pass http://localhost:5984;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Salve: `Ctrl + X` → `Y` → `Enter`

Ative a configuração:

```bash
ln -s /etc/nginx/sites-available/pipeline /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

**✓ Checkpoint:** `nginx -t` deve mostrar `syntax is ok` e `test is successful`.

Agora adicione o SSL (certificado de segurança HTTPS) automático:

```bash
certbot --nginx -d n8n.seu-dominio.com.br -d couchdb.seu-dominio.com.br
```

Siga as instruções na tela. Quando perguntar sobre redirecionamento, escolha a opção `2` (redirecionar HTTP para HTTPS).

> **Pré-requisito:** Os subdomínios `n8n.seu-dominio.com.br` e `couchdb.seu-dominio.com.br` precisam estar apontando para o IP do seu VPS no painel DNS do seu domínio. Se não sabe como fazer isso, peça ao seu provedor de hospedagem.

---

### 4.3 — Criar o banco de dados do Obsidian no CouchDB

Execute o comando abaixo (substitua `SUASENHA` pela senha que você definiu para o CouchDB):

```bash
# Criar o banco de dados
curl -X PUT https://couchdb.seu-dominio.com.br/obsidian-knowledge \
  -u admin:SUASENHA

# Ativar acesso externo (necessário para o Obsidian conectar)
curl -X PUT "https://couchdb.seu-dominio.com.br/_node/nonode@nohost/_config/httpd/enable_cors" \
  -d '"true"' \
  -H "Content-Type: application/json" \
  -u admin:SUASENHA

curl -X PUT "https://couchdb.seu-dominio.com.br/_node/nonode@nohost/_config/cors/origins" \
  -d '"*"' \
  -H "Content-Type: application/json" \
  -u admin:SUASENHA

curl -X PUT "https://couchdb.seu-dominio.com.br/_node/nonode@nohost/_config/cors/credentials" \
  -d '"true"' \
  -H "Content-Type: application/json" \
  -u admin:SUASENHA
```

**✓ Checkpoint:** O primeiro comando deve retornar `{"ok":true}`.

---

## PARTE 5 — Atualizar o banco de dados do MedScribe

As novas tabelas do pipeline precisam ser criadas no banco de dados. Execute:

```bash
# Ainda na pasta do MedScribe
pnpm db:push
```

Vai aparecer uma lista de tabelas sendo criadas. Responda `Yes` se perguntar.

**✓ Checkpoint:** Deve terminar sem erros, listando as tabelas criadas:
- `pubmed_articles`
- `article_topic_links`
- `article_clusters`
- `monthly_evidence_reports`
- `bulletin_send_logs`
- `admin_notifications`

Depois, reinicie o MedScribe para carregar as novas configurações:

```bash
docker compose restart
# ou, dependendo da sua instalação:
pm2 restart all
```

---

## PARTE 6 — Configurar o n8n (painel de automações)

### 6.1 — Acessar o n8n

Abra o navegador e acesse: `https://n8n.seu-dominio.com.br`

Faça login com o usuário e senha que você definiu no `.env.pipeline` (`N8N_USER` e `N8N_PASSWORD`).

### 6.2 — Importar o Workflow 1 (Pipeline Diário)

1. No menu lateral esquerdo, clique em **Workflows**
2. Clique no botão **+** (Add workflow) ou **Import**
3. Selecione **Import from file**
4. Navegue até a pasta do MedScribe no seu computador
5. Selecione o arquivo: `n8n/workflow-daily.json`
6. O workflow vai abrir mostrando todos os blocos conectados
7. Clique em **Save** (ícone de disquete ou botão salvar)

### 6.3 — Importar o Workflow 2 (Relatório Mensal)

Repita o processo acima com o arquivo: `n8n/workflow-monthly.json`

### 6.4 — Verificar as variáveis de ambiente no n8n

No n8n, vá em: **menu lateral → Settings → Environment Variables**

Verifique se as variáveis do `.env.pipeline` aparecem aqui. Elas são passadas automaticamente pelo Docker — se não aparecerem, reinicie o container:

```bash
docker restart n8n
```

---

## PARTE 7 — Configurar o Obsidian no seu computador

### 7.1 — Instalar o plugin de sincronização

1. Abra o Obsidian no seu computador
2. Vá em **Configurações** (ícone de engrenagem ⚙️)
3. Clique em **Plugins de terceiros** no menu lateral
4. Desative o **Modo restrito** (clique em "Desativar")
5. Clique em **Navegar**
6. Na barra de pesquisa, digite: `Self-hosted LiveSync`
7. Clique em **Instalar** → depois em **Ativar**

### 7.2 — Configurar a sincronização

1. Nas configurações do Obsidian, clique em **Self-hosted LiveSync** (aparece no final do menu)
2. Clique em **Remote Database Configuration** (ou similar)
3. Preencha os campos:

| Campo | O que colocar |
|---|---|
| **URI** | `https://couchdb.seu-dominio.com.br` |
| **Username** | `admin` |
| **Password** | a senha do CouchDB que você criou |
| **Database name** | `obsidian-knowledge` |

4. Clique em **Test** — deve aparecer uma mensagem de sucesso verde
5. Em **Sync Mode** selecione **LiveSync**
6. Ative a opção **Sync on Save**
7. Clique em **Apply**

**✓ Checkpoint:** Crie uma nota de teste no Obsidian. Espere 30 segundos e verifique no servidor:

```bash
curl https://couchdb.seu-dominio.com.br/obsidian-knowledge/_all_docs \
  -u admin:SUASENHA
```

Deve aparecer o nome da nota que você criou.

---

## PARTE 8 — Configurar médicos para receber o boletim mensal

Para que um médico receba o boletim mensal por email, acesse o painel admin do MedScribe e edite o usuário do médico, ou execute diretamente no banco de dados:

```bash
# Conecte ao banco de dados do MedScribe
# (ajuste o comando conforme sua configuração de banco)
docker exec -it facilita-mysql mysql -u facilita -pfacilita facilita_prep
```

Dentro do MySQL, execute (um médico por vez):

```sql
-- Listar médicos cadastrados
SELECT id, nome, email FROM users WHERE role = 'medico';

-- Ativar boletim para um médico (substitua o ID e o email)
UPDATE users
SET receive_monthly_bulletin = 1,
    bulletin_email = 'dr.silva@suaclinica.com.br'
WHERE id = 1;

-- Sair do MySQL
exit
```

---

## PARTE 9 — Teste completo do pipeline

### 9.1 — Executar o pipeline manualmente pela primeira vez

1. Acesse o n8n: `https://n8n.seu-dominio.com.br`
2. Abra o **Workflow 1 — Pipeline Diário**
3. Clique no botão **Test workflow** (ou **Execute workflow**)
4. Acompanhe os blocos acendendo em verde (funcionando) ou vermelho (erro)

**Se tudo der verde:** O pipeline está funcionando! Passe para o próximo passo.

**Se algum bloco der vermelho:** Clique no bloco vermelho para ver o erro. Os erros mais comuns são:
- `Unauthorized` → a chave de API está errada
- `Connection refused` → o serviço não está rodando
- `Not found` → o endpoint do MedScribe está incorreto

### 9.2 — Verificar os resultados

Após a execução, verifique:

**No banco de dados:**
```bash
docker exec -it facilita-mysql mysql -u facilita -pfacilita facilita_prep \
  -e "SELECT pmid, title, total_notes_generated FROM pubmed_articles LIMIT 5;"
```

**No Obsidian:** Aguarde até 1 minuto — uma nota nova deve aparecer na pasta `/Knowledge/`

**No Zotero:** Acesse `zotero.org` → sua biblioteca → deve ter novos artigos na coleção `Pipeline Clínico`

---

## PARTE 10 — Ativar os agendamentos automáticos

Quando os testes estiverem funcionando, ative os workflows para rodar automaticamente:

### Pipeline Diário (a cada hora)

1. No n8n, abra o **Workflow 1 — Pipeline Diário**
2. No canto superior direito, clique no **toggle** (interruptor) para ativar
3. Deve ficar verde com o texto **Active**

### Relatório Mensal (dia 1 de cada mês)

1. No n8n, abra o **Workflow 2 — Relatório Mensal**
2. Ative da mesma forma

**✓ Pronto!** O pipeline está rodando automaticamente.

---

## Resumo do que acontece agora

```
Médico registra caso no MedScribe
           ↓
   (a cada hora, automático)
           ↓
Sistema busca artigos no PubMed
           ↓
Verifica se tem PDF gratuito (Unpaywall)
           ↓
Salva referência no Zotero
           ↓
Claude gera resumo clínico em português
           ↓
Nota aparece no Obsidian (em segundos)
           ↓
   (todo dia 1 do mês, automático)
           ↓
Claude analisa todos os artigos do mês
           ↓
Gera meta-análises e relatório
           ↓
Envia boletim por email para cada médico
           ↓
Notificação aparece no painel admin
```

---

## Dúvidas frequentes

**P: O pipeline vai afetar o desempenho do MedScribe?**
R: Não. Os containers do pipeline (n8n e CouchDB) são separados e usam poucos recursos. O MedScribe continua funcionando normalmente.

**P: E se um artigo não tiver PDF gratuito?**
R: O pipeline continua normalmente — salva a referência no Zotero sem o PDF e cria a nota no Obsidian assim mesmo.

**P: Se o servidor reiniciar, o pipeline continua?**
R: Sim. Todos os containers estão configurados com `restart: always` — sobem automaticamente quando o servidor reiniciar.

**P: Como vejo se o pipeline está rodando?**
R: Acesse `https://n8n.seu-dominio.com.br` → **Executions** no menu lateral. Vai aparecer o histórico de todas as execuções.

**P: O Obsidian precisa estar aberto para as notas chegarem?**
R: Não. As notas são salvas no CouchDB do servidor. Quando você abrir o Obsidian, elas sincronizam automaticamente.

**P: Como adiciono uma nova especialidade médica?**
R: Basta os médicos registrarem casos nessa especialidade no MedScribe. O pipeline detecta automaticamente e cria as notas na pasta correta.

---

## Em caso de problemas

### Ver o que está acontecendo dentro do n8n:
```bash
docker logs n8n --tail 50 -f
```
(pressione `Ctrl + C` para parar)

### Ver o que está acontecendo no CouchDB:
```bash
docker logs couchdb-obsidian --tail 30
```

### Reiniciar apenas o pipeline (sem afetar o MedScribe):
```bash
docker compose -f docker-compose.pipeline.yml restart
```

### Parar o pipeline temporariamente:
```bash
docker compose -f docker-compose.pipeline.yml stop
```

### Religar o pipeline:
```bash
docker compose -f docker-compose.pipeline.yml --env-file .env.pipeline up -d
```

---

*Guia preparado para MedScribe — Pipeline de Conhecimento Clínico*
*Se precisar de ajuda, abra um chamado com a mensagem de erro completa.*
