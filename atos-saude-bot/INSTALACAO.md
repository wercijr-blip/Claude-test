# 📦 Manual de Instalação — Atos Saúde Bot

### Guia Completo Passo a Passo (para quem não tem experiência em TI)

> **Versões utilizadas neste guia:**
> Evolution API **v2.x** · Node.js **22 LTS** · Docker **26+** · PM2 **5+**

---

## 📋 O QUE VOCÊ VAI PRECISAR ANTES DE COMEÇAR

Antes de iniciar, separe as seguintes informações:

- [ ] Computador com acesso à internet (Windows, Mac ou Linux)
- [ ] Um cartão de crédito (para o servidor — a partir de R$ 35/mês)
- [ ] Uma conta Google (Gmail) para integração com Google Calendar
- [ ] Um chip de celular **exclusivo** para o bot (não use seu número pessoal)
- [ ] O número de WhatsApp já ativo nesse chip
- [ ] Cerca de 2–3 horas de tempo disponível na primeira instalação

> 💡 **Nunca mexeu com servidor?** Sem problema. Este guia foi escrito para você. Siga cada passo na ordem, não pule etapas e leia os avisos em destaque.

---

## 🗺️ ENTENDENDO O SISTEMA

O Atos Saúde Bot é composto por quatro partes que trabalham juntas:

```
Paciente (WhatsApp)
        ↓  ↑
 Evolution API v2          ← Recebe e envia mensagens pelo WhatsApp
        ↓  ↑
   Bot Atos Saúde          ← Cérebro: interpreta mensagens e decide o que fazer
        ↓  ↑
   Banco de Dados          ← Memória: salva agendamentos, sessões, histórico
        ↓
 Google Calendar           ← Agenda dos médicos (criação automática de eventos)
        ↓
  Painel Web               ← Interface para secretaria, faturamento e admin
```

### O que cada parte faz:

| Componente           | Função                         | Onde fica                     |
| -------------------- | ------------------------------ | ----------------------------- |
| **Evolution API v2** | Conecta o WhatsApp ao sistema  | No mesmo servidor, via Docker |
| **Bot Node.js**      | Processa as mensagens e fluxos | No mesmo servidor, via PM2    |
| **SQLite**           | Banco de dados local           | Arquivo no servidor           |
| **Google Calendar**  | Agenda dos médicos             | Nuvem do Google               |
| **Painel Web**       | Interface administrativa       | Acessado pelo navegador       |

---

## 🏗️ PORTAS UTILIZADAS

O sistema usa as seguintes portas no servidor:

| Porta  | Serviço          | Para quê                  |
| ------ | ---------------- | ------------------------- |
| `8080` | Evolution API v2 | Comunicação com WhatsApp  |
| `3000` | Bot + Painel Web | Interface do painel       |
| `22`   | SSH              | Acesso remoto ao servidor |

> ⚠️ Essas portas precisam estar abertas no firewall do servidor. O guia mostra como fazer isso.

---

## 🔄 EVOLUTION API v2 — O QUE MUDOU DA v1

Se você já usou a versão antiga (v1), saiba as principais diferenças:

| Aspecto           | v1 (antiga)                    | v2 (atual)                  |
| ----------------- | ------------------------------ | --------------------------- |
| Instalação        | Manual, compilação do código   | Docker Compose simplificado |
| Dashboard         | Não tinha                      | ✅ Interface web nativa     |
| Autenticação      | Somente API Key global         | API Key por instância       |
| Webhook           | Configuração manual no arquivo | Configurável pelo dashboard |
| Multi-instâncias  | Limitado                       | ✅ Suporte nativo           |
| Download de mídia | Endpoint separado instável     | ✅ Estável e documentado    |
| Estabilidade      | Variável                       | Muito melhorada             |

> 💡 **Instalando pela primeira vez?** Ignore a coluna v1. Você já vai direto para o melhor.

---

_Seção 1/10 concluída. Continua em: Servidor e Acesso SSH_

---

## 🖥️ PARTE 1 — CONTRATANDO O SERVIDOR

Você precisa de um servidor Linux na nuvem rodando 24 horas por dia. A opção mais simples e barata para iniciantes é a **DigitalOcean** (Droplet).

### Opção A — DigitalOcean (recomendada para iniciantes)

1. Acesse [digitalocean.com](https://digitalocean.com) e crie uma conta
2. Clique em **Create → Droplets**
3. Escolha as configurações:
   - **Região:** São Paulo (BRA1) — menor latência
   - **Sistema:** Ubuntu **24.04 LTS** (64-bit)
   - **Plano:** Basic — **2 GB RAM / 1 CPU / 50 GB SSD** (~R$ 35/mês)
4. Em **Authentication**, escolha **Password** e defina uma senha forte (anote!)
5. Clique em **Create Droplet** e aguarde ~1 minuto
6. Copie o **endereço IP** que aparece (ex: `143.198.50.200`)

### Opção B — VPS própria ou outro provedor

Qualquer VPS com Ubuntu 22.04 ou 24.04, mínimo 2 GB RAM, funciona. Anote o IP e a senha root.

### Opção C — Railway (sem gerenciar servidor)

Railway é uma plataforma que gerencia o servidor para você. Indicado se você não quer lidar com linha de comando. A configuração é diferente — entre em contato com o suporte técnico.

> ⚠️ **Não use Windows Server.** O sistema só funciona em Linux (Ubuntu).

---

## 🔌 PARTE 2 — ACESSANDO O SERVIDOR PELA PRIMEIRA VEZ

Para gerenciar o servidor, você usa um programa chamado **SSH** — é como uma janela de comando que controla o servidor remotamente.

### No Windows — instalar o PuTTY

1. Baixe o PuTTY em: [putty.org](https://www.putty.org) → clique em **putty-64bit-X.XX-installer.msi**
2. Instale e abra o PuTTY
3. No campo **Host Name**, digite o IP do seu servidor (ex: `143.198.50.200`)
4. Porta: `22` | Connection type: `SSH`
5. Clique em **Open**
6. Na primeira vez, aparece um aviso de segurança — clique em **Accept**
7. Login: `root`
8. Password: a senha que você criou (não aparece enquanto digita — é normal)

### No Mac ou Linux — usar o Terminal

1. Abra o Terminal (Mac: `Cmd + Espaço` → "Terminal")
2. Digite o comando abaixo substituindo pelo seu IP:
   ```bash
   ssh root@143.198.50.200
   ```
3. Na primeira vez, confirme digitando `yes` e pressione Enter
4. Digite sua senha quando solicitado

### ✅ Como saber se funcionou

Você verá algo parecido com isto:

```
Welcome to Ubuntu 24.04 LTS
root@droplet-atos:~#
```

O `#` no final indica que você está conectado e é administrador. **Não feche essa janela** durante a instalação.

> 💡 **Dica:** Se desconectar, basta repetir o processo de conexão. Nada é perdido.

---

_Seção 2/10 concluída. Continua em: Docker, Node.js e PM2_

---

## 🔄 PARTE 3 — ATUALIZANDO O SERVIDOR

Antes de instalar qualquer coisa, atualize todos os pacotes do sistema. Copie e cole os comandos abaixo um por vez, aguardando cada um terminar:

```bash
apt update
```

```bash
apt upgrade -y
```

```bash
apt install -y curl wget git unzip nano ufw
```

> ⏳ O segundo comando pode demorar alguns minutos. Aguarde aparecer o `#` novamente antes de continuar.

---

## 🐋 PARTE 4 — INSTALANDO O DOCKER

O Docker é necessário para rodar a Evolution API v2. É como um "container" que isola o programa.

### Instalar o Docker (método oficial):

```bash
curl -fsSL https://get.docker.com | sh
```

Aguarde a instalação terminar (~2 minutos). Depois verifique se funcionou:

```bash
docker --version
```

Deve aparecer algo como: `Docker version 26.1.4, build 5650f9b`

### Instalar o Docker Compose v2:

O Docker Compose v2 já vem junto com o Docker moderno. Confirme:

```bash
docker compose version
```

Deve aparecer: `Docker Compose version v2.x.x`

> ⚠️ **Atenção:** O comando é `docker compose` (sem hífen). A versão antiga usava `docker-compose` (com hífen). Use sempre sem hífen neste guia.

---

## 🟢 PARTE 5 — INSTALANDO O NODE.JS 22 LTS

O bot é escrito em Node.js. Instale a versão 22 (LTS — Long Term Support):

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
```

```bash
apt install -y nodejs
```

Verifique a instalação:

```bash
node --version
```

```bash
npm --version
```

Você deve ver `v22.x.x` e `10.x.x` respectivamente.

---

## ♻️ PARTE 6 — INSTALANDO O PM2

O PM2 é o gerenciador de processos — ele mantém o bot rodando 24 horas, reinicia automaticamente em caso de erro e salva os logs.

```bash
npm install -g pm2
```

Verifique:

```bash
pm2 --version
```

Deve aparecer `5.x.x` ou superior.

---

## 🔥 PARTE 6.1 — CONFIGURANDO O FIREWALL

Configure o firewall para permitir apenas as portas necessárias:

```bash
ufw allow 22
```

```bash
ufw allow 8080
```

```bash
ufw allow 3000
```

```bash
ufw enable
```

Quando perguntar "Proceed with operation?", digite `y` e pressione Enter.

Verifique o status:

```bash
ufw status
```

Deve mostrar as três portas como `ALLOW`.

---

_Seção 3/10 concluída. Continua em: Evolution API v2 — Instalação_

---

## 📱 PARTE 7 — INSTALANDO A EVOLUTION API v2

A Evolution API v2 é o componente que conecta o sistema ao WhatsApp. Ela roda dentro de um container Docker.

### Passo 7.1 — Criar a pasta e o arquivo de configuração

```bash
mkdir -p /opt/evolution
cd /opt/evolution
```

Crie o arquivo `docker-compose.yml`:

```bash
nano docker-compose.yml
```

O editor de texto vai abrir. Copie e cole **todo o conteúdo abaixo** (use Ctrl+Shift+V para colar no terminal):

```yaml
version: "3.8"

services:
  evolution-api:
    image: atendai/evolution-api:v2.2.3
    container_name: evolution_api
    restart: always
    ports:
      - "8080:8080"
    environment:
      - SERVER_URL=http://localhost:8080
      - AUTHENTICATION_API_KEY=SUA_CHAVE_API_AQUI
      - AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES=true
      - QRCODE_LIMIT=30
      - QRCODE_COLOR=#000000
      - DEL_INSTANCE=false
      - LANGUAGE=pt-BR
      - LOG_LEVEL=ERROR
      - LOG_COLOR=true
      - DATABASE_ENABLED=true
      - DATABASE_PROVIDER=postgresql
      - DATABASE_CONNECTION_URI=postgresql://evolution:evolution123@evolution-db:5432/evolution
      - CACHE_REDIS_ENABLED=false
      - WEBHOOK_GLOBAL_ENABLED=false
    depends_on:
      - evolution-db
    volumes:
      - evolution_instances:/evolution/instances
      - evolution_store:/evolution/store

  evolution-db:
    image: postgres:16-alpine
    container_name: evolution_db
    restart: always
    environment:
      - POSTGRES_DB=evolution
      - POSTGRES_USER=evolution
      - POSTGRES_PASSWORD=evolution123
    volumes:
      - evolution_pgdata:/var/lib/postgresql/data

volumes:
  evolution_instances:
  evolution_store:
  evolution_pgdata:
```

> ⚠️ **Atenção:** Substitua `SUA_CHAVE_API_AQUI` por uma senha forte. Exemplo: `AtosSaude@2025!Secure`. **Guarde esta chave** — você vai precisar dela nas próximas etapas.

Para salvar o arquivo no nano:

- Pressione `Ctrl + X`
- Pressione `Y` (confirmar)
- Pressione `Enter`

### Passo 7.2 — Iniciar a Evolution API

```bash
docker compose up -d
```

Aguarde o Docker baixar as imagens (~3 minutos na primeira vez). Depois verifique se está rodando:

```bash
docker compose ps
```

Deve aparecer dois containers com status `running`:

```
NAME             STATUS
evolution_api    Up 2 minutes
evolution_db     Up 2 minutes
```

### Passo 7.3 — Verificar se a API está respondendo

```bash
curl http://localhost:8080
```

Deve retornar algo como: `{"status":200,"message":"Welcome to the Evolution API",...}`

> 💡 Se não retornou nada, aguarde mais 1 minuto e tente novamente. O banco de dados demora um pouco para inicializar na primeira vez.

---

_Seção 4/10 concluída. Continua em: Evolution API v2 — Configuração_

---

## ⚙️ PARTE 8 — CONFIGURANDO A EVOLUTION API v2

### Passo 8.1 — Criar a instância do WhatsApp via API

A instância é o "slot" onde seu número de WhatsApp será conectado. Crie-a com o comando abaixo (substitua `SUA_CHAVE_API_AQUI` pela chave que você definiu):

```bash
curl -X POST http://localhost:8080/instance/create \
  -H "Content-Type: application/json" \
  -H "apikey: SUA_CHAVE_API_AQUI" \
  -d '{
    "instanceName": "atos-saude",
    "qrcode": true,
    "integration": "WHATSAPP-BAILEYS"
  }'
```

Se funcionou, você verá uma resposta JSON com `"instanceName": "atos-saude"`.

> 💡 O nome `atos-saude` é importante — anote-o. Ele será usado no arquivo `.env` do bot.

### Passo 8.2 — Configurar o Webhook

O webhook é o canal pelo qual a Evolution API avisa o bot quando uma mensagem chega. Configure-o com:

```bash
curl -X POST http://localhost:8080/webhook/set/atos-saude \
  -H "Content-Type: application/json" \
  -H "apikey: SUA_CHAVE_API_AQUI" \
  -d '{
    "url": "http://localhost:3000/webhook",
    "webhook_by_events": false,
    "webhook_base64": false,
    "events": [
      "MESSAGES_UPSERT"
    ]
  }'
```

Resposta esperada: `{"webhook":{"enabled":true,...}}`

> ⚠️ O evento `MESSAGES_UPSERT` é o único necessário. Não ative outros eventos para não sobrecarregar o bot.

### Passo 8.3 — Verificar o dashboard da Evolution API v2

A Evolution API v2 inclui um dashboard web. Acesse pelo navegador:

```
http://SEU_IP_DO_SERVIDOR:8080
```

Você verá a interface web com:

- Status das instâncias
- QR Code para conectar o WhatsApp
- Configurações de webhook

Para fazer login no dashboard, use a API Key que você definiu.

### Passo 8.4 — Anotar as credenciais

Antes de continuar, anote em um local seguro:

| Informação           | Valor                     |
| -------------------- | ------------------------- |
| URL da Evolution API | `http://SEU_IP:8080`      |
| API Key              | A senha que você escolheu |
| Nome da instância    | `atos-saude`              |

Você vai precisar dessas três informações para configurar o bot.

---

_Seção 5/10 concluída. Continua em: Instalação do Bot e arquivo .env_

---

## 🤖 PARTE 9 — INSTALANDO O BOT

### Passo 9.1 — Baixar o código

```bash
cd /opt
git clone https://github.com/SEU_USUARIO/atos-saude-bot.git
cd atos-saude-bot
```

> 💡 Se você recebeu o código em um arquivo ZIP, use:
>
> ```bash
> cd /opt
> mkdir atos-saude-bot && cd atos-saude-bot
> # Transfira o ZIP via SCP ou SFTP e extraia:
> unzip atos-saude-bot.zip
> ```

### Passo 9.2 — Instalar as dependências

```bash
npm install
```

Aguarde o npm baixar todos os pacotes (~1–2 minutos). No final aparece algo como:
`added 247 packages in 45s`

### Passo 9.3 — Criar a pasta de uploads

```bash
mkdir -p uploads/exames
```

Essa pasta armazena os exames enviados pelos pacientes pelo WhatsApp.

---

## ⚙️ PARTE 10 — CONFIGURANDO O ARQUIVO .env

O arquivo `.env` contém todas as configurações do bot. Crie-o com:

```bash
nano .env
```

Cole o conteúdo abaixo e **substitua cada valor** conforme as instruções:

```env
# ─── Evolution API v2 ─────────────────────────────────────
EVOLUTION_URL=http://localhost:8080
EVOLUTION_API_KEY=SUA_CHAVE_API_AQUI
INSTANCE_NAME=atos-saude

# ─── Servidor ─────────────────────────────────────────────
PORT=3000
NODE_ENV=production

# ─── Painel Web ───────────────────────────────────────────
JWT_SECRET=UmaFraseSecretaMuitoLongaParaSegurança2025

# ─── Google Calendar ──────────────────────────────────────
GOOGLE_SERVICE_ACCOUNT_JSON=/opt/atos-saude-bot/google-service-account.json

# ─── Claude AI (para FAQ de convênios) ───────────────────
CLAUDE_API_KEY=sk-ant-SUACHAVE

# ─── Configurações do bot ─────────────────────────────────
CLINIC_PHONE=556140427188
CLINIC_NAME=Atos Saúde Integrada
```

### Guia de preenchimento:

| Variável                      | O que colocar                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------ |
| `EVOLUTION_URL`               | `http://localhost:8080` (não mude se instalou no mesmo servidor)                           |
| `EVOLUTION_API_KEY`           | A chave que você criou na Parte 7                                                          |
| `INSTANCE_NAME`               | `atos-saude` (ou o nome que você usou ao criar a instância)                                |
| `JWT_SECRET`                  | Invente uma frase longa com letras, números e símbolos. Ex: `Atos@Saude#2025!PainelSeguro` |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Caminho para o arquivo JSON do Google (próxima seção)                                      |
| `CLAUDE_API_KEY`              | Chave da API Anthropic (para o FAQ de convênios) — obtenha em console.anthropic.com        |
| `CLINIC_PHONE`                | Número da clínica com DDI+DDD (ex: `556140427188`)                                         |
| `CLINIC_NAME`                 | Nome da clínica como deve aparecer nas mensagens                                           |

Salve com `Ctrl+X → Y → Enter`.

> 🔒 **Segurança:** O arquivo `.env` contém senhas. Nunca o compartilhe ou publique online.

---

_Seção 6/10 concluída. Continua em: Google Calendar_

---

## 📅 PARTE 11 — CONFIGURANDO O GOOGLE CALENDAR

O bot cria automaticamente eventos no Google Calendar dos médicos quando um paciente agenda uma consulta. Para isso, você precisa de uma **conta de serviço** do Google.

### Passo 11.1 — Criar o projeto no Google Cloud

1. Acesse: [console.cloud.google.com](https://console.cloud.google.com)
2. Faça login com sua conta Gmail
3. No topo, clique em **Selecionar projeto → Novo projeto**
4. Nome do projeto: `Atos Saude Bot`
5. Clique em **Criar** e aguarde

### Passo 11.2 — Ativar a API do Google Calendar

1. No menu lateral, vá em **APIs e serviços → Biblioteca**
2. Pesquise por `Google Calendar API`
3. Clique nela e depois em **Ativar**

### Passo 11.3 — Criar a conta de serviço

1. Vá em **APIs e serviços → Credenciais**
2. Clique em **Criar credenciais → Conta de serviço**
3. Nome: `atos-saude-bot`
4. Clique em **Criar e continuar**
5. Em "Conceder acesso", selecione o papel **Editor**
6. Clique em **Concluído**

### Passo 11.4 — Baixar o arquivo JSON

1. Na lista de contas de serviço, clique na que você acabou de criar
2. Vá na aba **Chaves**
3. Clique em **Adicionar chave → Criar nova chave**
4. Escolha formato **JSON**
5. Clique em **Criar** — o arquivo será baixado automaticamente

### Passo 11.5 — Enviar o arquivo para o servidor

No seu computador, use o SFTP para enviar o arquivo:

**No Windows (WinSCP):**

1. Baixe o WinSCP em [winscp.net](https://winscp.net)
2. Conecte com o IP do servidor, usuário `root` e sua senha
3. Navegue até `/opt/atos-saude-bot/`
4. Arraste o arquivo JSON para essa pasta
5. Renomeie o arquivo para `google-service-account.json`

**No Mac/Linux (terminal):**

```bash
scp ~/Downloads/atos-saude-bot-xxxx.json root@SEU_IP:/opt/atos-saude-bot/google-service-account.json
```

### Passo 11.6 — Compartilhar o calendário com a conta de serviço

Para cada médico cadastrado:

1. Abra o Google Calendar ([calendar.google.com](https://calendar.google.com))
2. No painel esquerdo, clique nos três pontinhos ao lado do calendário do médico
3. Clique em **Configurações e compartilhamento**
4. Em **Compartilhar com pessoas específicas**, clique em **+ Adicionar pessoas**
5. Cole o **e-mail da conta de serviço** (aparece no arquivo JSON no campo `client_email`)
   - Parece com: `atos-saude-bot@atos-saude-bot-xxxxx.iam.gserviceaccount.com`
6. Permissão: **Fazer alterações nos eventos**
7. Clique em **Enviar**

> 💡 O ID do calendário do médico aparece nas configurações do calendário, no campo **ID do calendário**. Guarde-o para cadastrar no painel. Parece com: `nome@group.calendar.google.com`

---

_Seção 7/10 concluída. Continua em: Primeira inicialização e conexão WhatsApp_

---

## 🚀 PARTE 12 — PRIMEIRA INICIALIZAÇÃO DO BOT

### Passo 12.1 — Criar o primeiro usuário administrador

Na primeira execução, o bot cria automaticamente um usuário admin padrão. Inicie o bot uma vez para isso acontecer:

```bash
cd /opt/atos-saude-bot
node index.js &
```

Aguarde aparecer a mensagem: `Bot Atos Saúde rodando na porta 3000`

Pressione `Ctrl + C` para parar. O banco de dados foi criado com o usuário inicial.

### Passo 12.2 — Verificar o banco de dados

```bash
ls -la atos-saude.db
```

Se o arquivo `atos-saude.db` aparecer, o banco foi criado com sucesso.

### Passo 12.3 — Iniciar com PM2 (modo definitivo)

```bash
pm2 start index.js --name atos-saude-bot
```

Verifique se está rodando:

```bash
pm2 status
```

Deve aparecer:

```
┌────┬──────────────────┬─────────┬──────┬───────────┬────────┐
│ id │ name             │ mode    │ ↺    │ status    │ cpu    │
├────┼──────────────────┼─────────┼──────┼───────────┼────────┤
│ 0  │ atos-saude-bot   │ fork    │ 0    │ online    │ 0%     │
└────┴──────────────────┴─────────┴──────┴───────────┴────────┘
```

### Passo 12.4 — Salvar para reiniciar automaticamente

```bash
pm2 save
pm2 startup
```

O comando `pm2 startup` vai gerar um comando para você copiar e colar. Execute-o exatamente como aparecer na tela. Isso garante que o bot reinicie automaticamente se o servidor reiniciar.

---

## 📲 PARTE 13 — CONECTANDO O WHATSAPP PELO PAINEL

A Evolution API v2 permite conectar o WhatsApp diretamente pelo painel do bot — sem precisar de linha de comando.

### Passo 13.1 — Acessar o painel

Abra o navegador e acesse:

```
http://SEU_IP_DO_SERVIDOR:3000/painel
```

Faça login com as credenciais padrão:

- **Usuário:** `admin`
- **Senha:** `admin123`

> ⚠️ Na primeira vez, o sistema obriga a troca de senha. Escolha uma senha forte e anote-a.

### Passo 13.2 — Conectar o WhatsApp pelo painel

1. No painel, clique na tab **📱 WhatsApp** (na barra lateral)
2. O status aparecerá como **Desconectado**
3. Clique em **🔄 Gerar novo QR**
4. Um QR Code aparecerá na tela

### Passo 13.3 — Escanear o QR Code

No celular com o chip do bot:

1. Abra o **WhatsApp**
2. Toque nos três pontinhos (⋮) no canto superior direito
3. Selecione **Dispositivos conectados**
4. Toque em **Conectar um dispositivo**
5. Aponte a câmera para o QR Code na tela do painel

### Passo 13.4 — Confirmar a conexão

Após escanear, o painel atualizará automaticamente e mostrará:

- Status: **✅ Conectado**
- O QR Code desaparecerá

> 💡 O QR Code expira em 60 segundos. Se expirar antes de escanear, clique em **🔄 Gerar novo QR** novamente. O painel atualiza automaticamente a cada 25 segundos.

### Passo 13.5 — Testar o bot

Envie uma mensagem de qualquer número para o WhatsApp do bot:

```
oi
```

O bot deve responder com o menu de opções em alguns segundos. ✅

---

_Seção 8/10 concluída. Continua em: Painel web, médicos, usuários e segurança_

---

## 🌐 PARTE 14 — ACESSANDO E CONFIGURANDO O PAINEL WEB

O painel web é a interface principal para a equipe da clínica. Ele possui 13 abas com todas as funcionalidades.

### Endereço de acesso:

```
http://SEU_IP_DO_SERVIDOR:3000/painel
```

### Abas disponíveis no painel v2:

| Aba                | Função                                |
| ------------------ | ------------------------------------- |
| 📅 Agenda          | Visualizar e gerenciar agendamentos   |
| ➕ Marcação Manual | Agendar consultas manualmente         |
| ✍️ Textos & Fluxos | Editar mensagens do bot               |
| 🩺 Atendimento     | Sessões em atendimento humano         |
| ⚡ Encaixe         | Fila de espera para encaixe           |
| 👨‍⚕️ Médicos         | Cadastro e agenda dos médicos         |
| 👥 Usuários        | Gerenciar logins do painel            |
| 🩺 Exames          | Exames enviados pelos pacientes       |
| 📱 WhatsApp        | Status e QR Code de conexão           |
| 💊 Medicações      | Solicitações de medicação             |
| 📚 Conhecimento    | Base de documentos para a IA          |
| ⭐ Satisfação      | Pesquisas respondidas pelos pacientes |
| 💬 Conversas       | Monitor de todas as conversas         |

---

## 👨‍⚕️ PARTE 15 — CADASTRANDO OS MÉDICOS

Antes de o bot poder agendar consultas, os médicos precisam ser cadastrados.

1. Acesse o painel e clique na aba **👨‍⚕️ Médicos**
2. Preencha o formulário:
   - **Nome completo** → Ex: `Dr. João da Silva`
   - **Especialidades** → Ex: `Infectologia, Reumatologia`
   - **Google Calendar ID** → Obtido nas configurações do calendário do médico
3. Clique em **Salvar**
4. Repita para cada médico

> 💡 O Google Calendar ID do médico aparece nas configurações do calendário. Formato: `nomecalendario@group.calendar.google.com`

---

## 👥 PARTE 15.1 — CRIANDO USUÁRIOS DO PAINEL

Crie logins para cada membro da equipe:

1. Acesse a aba **👥 Usuários**
2. Preencha: nome, login (sem espaços), senha inicial e perfil
3. Perfis disponíveis:
   - **Admin** — acesso total
   - **Secretaria** — agenda, marcações, atendimento, exames, conversas
   - **Faturamento** — visualização e exportação
4. Clique em **Criar Usuário**

Na primeira vez que o usuário fizer login, o sistema obriga a troca de senha.

---

## 🔒 PARTE 16 — SEGURANÇA BÁSICA

### Trocar a senha root do servidor

```bash
passwd
```

### Desativar login root por senha (após criar usuário alternativo)

```bash
adduser atos
usermod -aG sudo atos
```

### Atualizar o sistema regularmente

```bash
apt update && apt upgrade -y
```

Execute este comando mensalmente para manter o servidor seguro.

### Backup automático do banco de dados

Crie um script de backup diário:

```bash
nano /opt/backup-atos.sh
```

Cole o conteúdo:

```bash
#!/bin/bash
DATE=$(date +%Y%m%d)
cp /opt/atos-saude-bot/atos-saude.db /opt/backups/atos-saude-$DATE.db
find /opt/backups -name "*.db" -mtime +30 -delete
```

Salve e configure para rodar todo dia às 3h:

```bash
mkdir -p /opt/backups
chmod +x /opt/backup-atos.sh
crontab -e
```

Adicione a linha:

```
0 3 * * * /opt/backup-atos.sh
```

Salve com `Ctrl+X → Y → Enter`.

---

_Seção 9/10 concluída. Continua em: Checklist final e problemas comuns_

---

## ✅ CHECKLIST FINAL DE INSTALAÇÃO

Antes de colocar em produção, verifique cada item:

### Servidor e infraestrutura

- [ ] Servidor Ubuntu rodando (DigitalOcean, VPS ou similar)
- [ ] Docker e Docker Compose v2 instalados (`docker compose version`)
- [ ] Node.js 22 instalado (`node --version` → v22.x)
- [ ] PM2 instalado (`pm2 --version`)
- [ ] Firewall configurado (portas 22, 8080, 3000 liberadas)

### Evolution API v2

- [ ] Containers `evolution_api` e `evolution_db` rodando (`docker compose ps`)
- [ ] Instância `atos-saude` criada
- [ ] Webhook configurado apontando para `http://localhost:3000/webhook`

### Bot

- [ ] Arquivo `.env` criado e preenchido corretamente
- [ ] `npm install` executado sem erros
- [ ] Pasta `uploads/exames/` criada
- [ ] Bot iniciado com PM2 (`pm2 status` → online)
- [ ] PM2 configurado para reiniciar automaticamente (`pm2 startup` + `pm2 save`)

### Google Calendar

- [ ] Conta de serviço criada no Google Cloud
- [ ] API do Google Calendar ativada
- [ ] Arquivo `google-service-account.json` no servidor
- [ ] Calendário de cada médico compartilhado com a conta de serviço

### Painel Web

- [ ] Painel acessível em `http://IP:3000/painel`
- [ ] WhatsApp conectado (aba 📱 WhatsApp → status ✅ Conectado)
- [ ] Médicos cadastrados na aba 👨‍⚕️
- [ ] Usuários da equipe criados na aba 👥
- [ ] Senha padrão do admin alterada

### Teste final

- [ ] Enviou "oi" para o bot e recebeu o menu de opções
- [ ] Fez um agendamento de teste e verificou na aba Agenda
- [ ] Evento apareceu no Google Calendar do médico

---

## 🆘 PROBLEMAS COMUNS E SOLUÇÕES

### ❌ Bot não responde no WhatsApp

**Verificações:**

```bash
pm2 status                    # Bot deve estar "online"
pm2 logs atos-saude-bot --lines 20  # Ver últimos erros
docker compose ps             # Evolution API deve estar "running"
```

Se o bot estiver offline:

```bash
pm2 restart atos-saude-bot
```

Se a Evolution API estiver parada:

```bash
cd /opt/evolution && docker compose up -d
```

---

### ❌ WhatsApp desconectou (QR expirado)

1. Acesse o painel → aba **📱 WhatsApp**
2. Clique em **🔄 Gerar novo QR**
3. Escaneie com o celular do bot

---

### ❌ Erro ao criar eventos no Google Calendar

Verifique se:

- O arquivo `google-service-account.json` está no caminho correto
- O calendário do médico foi compartilhado com o e-mail da conta de serviço
- O ID do calendário no cadastro do médico está correto

```bash
pm2 logs atos-saude-bot --lines 50 | grep calendar
```

---

### ❌ Painel não abre no navegador

```bash
pm2 status              # Bot precisa estar online
ufw status              # Porta 3000 precisa estar aberta
curl http://localhost:3000/painel  # Testar localmente no servidor
```

---

### ❌ Exames não são baixados

A Evolution API v2 precisa ter o download de mídia habilitado. Verifique os logs:

```bash
pm2 logs atos-saude-bot --lines 30 | grep -i exame
```

Se houver erro de conexão com a Evolution API:

```bash
curl http://localhost:8080 -H "apikey: SUA_CHAVE"
```

---

### ❌ Banco de dados corrompido

```bash
cp /opt/atos-saude-bot/atos-saude.db /opt/backups/atos-saude-emergencia.db
sqlite3 /opt/atos-saude-bot/atos-saude.db "PRAGMA integrity_check"
```

Se retornar `ok`, o banco está íntegro. Se retornar erros, restaure o backup mais recente.

---

## 📞 COMANDOS ESSENCIAIS PARA O DIA A DIA

### Verificar se tudo está rodando

```bash
pm2 status && docker compose -f /opt/evolution/docker-compose.yml ps
```

### Ver logs do bot em tempo real

```bash
pm2 logs atos-saude-bot
```

### Reiniciar o bot

```bash
pm2 restart atos-saude-bot
```

### Reiniciar a Evolution API

```bash
cd /opt/evolution && docker compose restart
```

### Atualizar o bot (nova versão)

```bash
cd /opt/atos-saude-bot
git pull
npm install
pm2 restart atos-saude-bot
```

### Backup manual do banco

```bash
cp /opt/atos-saude-bot/atos-saude.db /opt/backups/atos-saude-$(date +%Y%m%d-%H%M).db
```

### Ver uso de disco

```bash
df -h
```

### Ver uso de memória

```bash
free -h && pm2 monit
```

---

## 📞 SUPORTE TÉCNICO

Ao acionar suporte, tenha em mãos:

```bash
node --version
pm2 --version
docker --version
pm2 logs atos-saude-bot --lines 100
```

Informe também: IP do servidor, sistema operacional e a mensagem de erro exata.
