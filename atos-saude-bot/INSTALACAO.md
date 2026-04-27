# 📦 Manual de Instalação — Atos Saúde Bot
### Guia Passo a Passo para Iniciantes (sem conhecimento técnico)

---

## 📋 O QUE VOCÊ VAI PRECISAR ANTES DE COMEÇAR

Antes de iniciar, separe as seguintes informações:

- [ ] Acesso à internet no seu computador
- [ ] Um cartão de crédito (para contratar o servidor — ~R$ 35/mês)
- [ ] Uma conta Google (Gmail) para o Google Calendar
- [ ] O número de WhatsApp que será usado como bot (um chip dedicado, não o seu pessoal)
- [ ] Cerca de 2 horas de tempo disponível

> 💡 **Não tem experiência com tecnologia?** Sem problema. Este guia foi escrito especialmente para você. Siga cada passo na ordem e não pule etapas.

---

## 🗺️ ENTENDENDO O SISTEMA (leia antes de instalar)

O sistema é composto por partes que trabalham juntas:

```
Paciente (WhatsApp)
        ↓
  Evolution API  ←→  Bot Atos Saúde  ←→  Banco de Dados
  (recebe/envia           (cérebro             (memória)
   mensagens)             do sistema)
        ↑                     ↓
   WhatsApp              Google Calendar
                              ↓
                          Claude AI (FAQ)
```

| Componente | Para que serve | Precisa instalar? |
|---|---|---|
| **Evolution API** | Conecta ao WhatsApp | Sim (via Docker) |
| **Bot Node.js** | Toda a lógica + painel web | Sim |
| **SQLite** | Banco de dados (arquivo local) | Não — criado automaticamente |
| **Google Calendar** | Agenda dos médicos na nuvem | Criar conta de serviço |
| **Claude AI** | Responde dúvidas de convênios | Criar chave de API |

---

## 🖥️ PARTE 1 — CONTRATANDO O SERVIDOR

Você precisa de um **servidor na nuvem** (computador que fica ligado 24 horas por dia). Não é possível usar seu computador pessoal.

### Por que um servidor na nuvem?
O bot precisa estar disponível 24/7. Se o computador desligar, o bot para de responder.

### Servidor recomendado: Hostinger VPS KVM 1

**Passo a passo:**

1. Abra o navegador e acesse: **hostinger.com.br**
2. No menu, clique em **"Hospedagem"** → **"VPS"**
3. Escolha o plano **KVM 1** (o menor é suficiente para começar)
   - Preço aproximado: R$ 25 a 40/mês
4. Em **Sistema Operacional**, selecione **Ubuntu 22.04 LTS**
   - ⚠️ IMPORTANTE: Escolha exatamente "Ubuntu 22.04". Outras versões podem ter problemas.
5. Finalize a compra
6. Aguarde o e-mail da Hostinger com:
   - **IP do servidor** (exemplo: `189.23.45.67`) — anote isso
   - **Usuário:** geralmente `root`
   - **Senha** — anote isso

> ⚠️ **NÃO USE:** hospedagem de sites comum (cPanel, Plesk, Wix, etc.). Essas opções não funcionam para este sistema.

---

## 🔌 PARTE 2 — ACESSANDO O SERVIDOR PELA PRIMEIRA VEZ

Você vai controlar o servidor digitando comandos de texto. O programa para isso se chama **SSH**.

### No Windows:

1. Baixe o programa **PuTTY** em: **putty.org** → clique em "Download PuTTY"
2. Instale e abra o PuTTY
3. Na tela que abrir:
   - Em **"Host Name (or IP address)"**, digite o IP do seu servidor (ex: `189.23.45.67`)
   - A porta deve ser **22** (já vem preenchida)
   - Clique em **"Open"**
4. Uma tela preta vai abrir. Se aparecer um aviso de segurança, clique em **"Accept"**
5. Quando pedir **"login as:"**, digite: `root` e pressione Enter
6. Quando pedir a senha, **digite a senha** (os caracteres NÃO aparecem na tela — isso é normal e seguro)
7. Pressione Enter

### No Mac:

1. Abra o **Terminal** (pesquise "Terminal" no Spotlight com Cmd+Espaço)
2. Digite o comando abaixo, substituindo pelo seu IP:
   ```
   ssh root@189.23.45.67
   ```
3. Pressione Enter e digite a senha quando pedir

### Como saber se funcionou?
Você verá algo como:
```
Welcome to Ubuntu 22.04.3 LTS
root@servidor:~#
```
O `#` no final significa que você está dentro do servidor. Agora todos os comandos que você digitar rodam no servidor.

---

## 🔄 PARTE 3 — ATUALIZANDO O SERVIDOR

Com o servidor aberto, copie e cole os comandos abaixo. Para colar no terminal do Windows, clique com o botão direito do mouse.

```bash
apt update && apt upgrade -y
```

Aguarde terminar (pode demorar 1-3 minutos). Quando aparecer o `#` novamente, significa que terminou.

Agora instale ferramentas necessárias:

```bash
apt install -y curl git wget nano unzip
```

---

## 🐋 PARTE 4 — INSTALANDO O DOCKER

O Docker é um programa que "embalota" outros programas para rodar de forma isolada. Precisamos dele para a Evolution API.

```bash
curl -fsSL https://get.docker.com | sh
```

Aguarde. Depois instale o Docker Compose:

```bash
apt install -y docker-compose-plugin
```

Verifique se instalou corretamente:

```bash
docker --version
docker compose version
```

Você deve ver algo como `Docker version 24.x.x`. Se aparecer, funcionou!

---

## 🟢 PARTE 5 — INSTALANDO O NODE.JS 20

O Node.js é o programa que vai rodar o bot.

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
```

Verifique:

```bash
node --version
```

Deve aparecer `v20.x.x`. Se aparecer, funcionou!

---

## ♻️ PARTE 6 — INSTALANDO O PM2

O PM2 é um gerenciador que mantém o bot sempre ligado, mesmo se der algum erro.

```bash
npm install -g pm2
```

Verifique:

```bash
pm2 --version
```

---

## 📱 PARTE 7 — INSTALANDO A EVOLUTION API (WhatsApp)

A Evolution API é o componente que faz a ponte entre o seu bot e o WhatsApp.

### Passo 7.1 — Criar a pasta

```bash
mkdir -p /opt/evolution
cd /opt/evolution
```

### Passo 7.2 — Criar o arquivo de configuração

```bash
nano docker-compose.yml
```

Uma tela de edição vai abrir. Cole o conteúdo abaixo (no Windows, clique com botão direito para colar):

```yaml
version: '3.8'
services:
  evolution-api:
    image: atendai/evolution-api:v2.2.3
    container_name: evolution_api
    restart: always
    ports:
      - "8080:8080"
    environment:
      - SERVER_URL=http://localhost:8080
      - AUTHENTICATION_API_KEY=TROQUE_POR_UMA_CHAVE_SEGURA
      - AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES=true
      - DATABASE_ENABLED=true
      - DATABASE_PROVIDER=sqlite
      - DATABASE_CONNECTION_URI=file:./evolution.db
      - DATABASE_SAVE_DATA_INSTANCE=true
      - DATABASE_SAVE_DATA_NEW_MESSAGE=true
      - DATABASE_SAVE_MESSAGE_UPDATE=true
      - DATABASE_SAVE_DATA_CONTACTS=true
      - DATABASE_SAVE_DATA_CHATS=true
    volumes:
      - evolution_data:/evolution/instances
      - evolution_store:/evolution/store

volumes:
  evolution_data:
  evolution_store:
```

> ⚠️ **IMPORTANTE:** Troque `TROQUE_POR_UMA_CHAVE_SEGURA` por uma senha sua. Exemplo: `AtosClinica#2025!`. **Anote essa senha** — você vai precisar dela várias vezes.

Para salvar o arquivo:
1. Pressione `Ctrl + X`
2. Pressione `Y` (de "Yes")
3. Pressione `Enter`

### Passo 7.3 — Iniciar a Evolution API

```bash
docker compose up -d
```

Verifique se está rodando:

```bash
docker ps
```

Você deve ver uma linha com `evolution_api` e `Up` no status. Se aparecer, funcionou!

---

## 🤖 PARTE 8 — INSTALANDO O BOT

### Passo 8.1 — Copiar os arquivos

**Se você tem acesso ao repositório Git:**
```bash
cd /opt
git clone URL_DO_REPOSITORIO atos-saude-bot
cd atos-saude-bot
```

**Se vai fazer upload manual (via FileZilla):**
1. Baixe o FileZilla em: **filezilla-project.org** → "Download FileZilla Client"
2. Abra o FileZilla
3. No topo, preencha:
   - **Host:** IP do seu servidor
   - **Usuário:** root
   - **Senha:** sua senha do servidor
   - **Porta:** 22
4. Clique em **Conexão rápida**
5. Do lado direito (servidor), navegue até `/opt/`
6. Crie uma pasta chamada `atos-saude-bot`
7. Do lado esquerdo (seu computador), encontre a pasta do bot
8. Arraste todos os arquivos para a pasta no servidor

### Passo 8.2 — Instalar as dependências

```bash
cd /opt/atos-saude-bot
npm install
```

Vai baixar os pacotes necessários. Aguarde (1-3 minutos).

---

## ⚙️ PARTE 9 — CONFIGURANDO O ARQUIVO .env

O arquivo `.env` é o "painel de controle" da instalação. Contém todas as senhas e configurações.

```bash
cp .env.example .env
nano .env
```

Você verá as linhas para preencher. Substitua cada valor conforme abaixo:

```env
# ── WhatsApp (Evolution API) ──────────────────────────────
EVOLUTION_URL=http://localhost:8080
EVOLUTION_API_KEY=A_SENHA_QUE_VOCÊ_CRIOU_NO_PASSO_7
INSTANCE_NAME=atossaude

# ── Google Calendar ───────────────────────────────────────
GOOGLE_SERVICE_ACCOUNT_PATH=./src/config/google-service-account.json

# ── Claude AI (FAQ de convênios) ──────────────────────────
ANTHROPIC_API_KEY=sk-ant-XXXXXXXXXX

# ── Configurações gerais ──────────────────────────────────
PORT=3000
NODE_ENV=production

# ── Segurança do painel web ───────────────────────────────
JWT_SECRET=CRIE_UMA_FRASE_LONGA_E_ALEATORIA_AQUI_MINIMO_32_CARACTERES
```

### Onde conseguir a chave do Claude AI (ANTHROPIC_API_KEY):

1. Acesse: **console.anthropic.com**
2. Clique em **"Sign Up"** e crie uma conta (pode usar o Google)
3. No menu, clique em **"API Keys"**
4. Clique em **"Create Key"** e dê um nome (ex: "Atos Saúde")
5. Copie a chave — ela começa com `sk-ant-`
6. Vá em **"Billing"** e adicione crédito (US$ 5 já é suficiente para começar)

### JWT_SECRET — o que é e como criar:

É uma senha interna que protege o painel web. Pode ser qualquer frase longa. Exemplo:
```
AtosClinica2025PainelSeguro!ChaveUnica#Bot
```

Para salvar: `Ctrl+X`, `Y`, `Enter`.

---

## 📅 PARTE 10 — CONFIGURANDO O GOOGLE CALENDAR

Esta é a parte mais detalhada. Siga com atenção, passo a passo.

### 10.1 — Criar Projeto no Google Cloud

1. Acesse: **console.cloud.google.com**
2. Faça login com a conta Google da clínica
3. No topo, clique em **"Selecionar projeto"** → **"Novo projeto"**
4. Nome do projeto: `AtosSaude`
5. Clique em **"Criar"**
6. Aguarde criar e certifique-se de que o projeto `AtosSaude` aparece selecionado no topo

### 10.2 — Ativar a API do Google Calendar

1. No menu lateral (as 3 linhas no canto superior esquerdo), clique em **"APIs e serviços"** → **"Biblioteca"**
2. Na caixa de pesquisa, digite: `Google Calendar API`
3. Clique no resultado **"Google Calendar API"**
4. Clique no botão azul **"Ativar"**
5. Aguarde ativar

### 10.3 — Criar a Conta de Serviço

A conta de serviço é como um "robô" que o bot usa para acessar os calendários.

1. No menu lateral, clique em **"APIs e serviços"** → **"Credenciais"**
2. Clique em **"+ Criar credenciais"** → **"Conta de serviço"**
3. Preencha:
   - **Nome:** `atos-saude-bot`
   - **ID:** será preenchido automaticamente
4. Clique em **"Criar e continuar"**
5. Em "Conceder acesso", não precisa selecionar nada → clique em **"Continuar"**
6. Clique em **"Concluído"**

### 10.4 — Baixar a chave JSON

1. Na lista de contas de serviço, clique na que você acabou de criar (`atos-saude-bot@...`)
2. Clique na aba **"Chaves"**
3. Clique em **"Adicionar chave"** → **"Criar nova chave"**
4. Selecione **"JSON"** e clique em **"Criar"**
5. Um arquivo `.json` será baixado automaticamente no seu computador
6. **Anote o e-mail** que aparece no campo `client_email` dentro do arquivo (parece com `atos-saude-bot@atossaude.iam.gserviceaccount.com`) — você vai precisar dele

### 10.5 — Enviar o arquivo JSON para o servidor

Use o FileZilla (Parte 8.1) para enviar o arquivo JSON para:
```
/opt/atos-saude-bot/src/config/google-service-account.json
```

> ⚠️ O nome do arquivo no servidor deve ser exatamente `google-service-account.json`

### 10.6 — Compartilhar o calendário com a conta de serviço

Para que o bot crie e gerencie eventos na agenda dos médicos, você precisa compartilhar cada calendário:

**Isso você faz pelo Google Calendar normal (calendar.google.com):**

1. Acesse: **calendar.google.com** com a conta do médico
2. No lado esquerdo, procure o calendário do médico
3. Clique nos **3 pontinhos** ao lado do nome do calendário
4. Clique em **"Configurações e compartilhamento"**
5. Role a página até encontrar **"Compartilhar com pessoas específicas ou grupos"**
6. Clique em **"+ Adicionar pessoas e grupos"**
7. Cole o e-mail da conta de serviço (aquele que você anotou no passo 10.4)
8. Em permissão, selecione: **"Fazer alterações e gerenciar compartilhamento"**
9. Clique em **"Enviar"**

**Anotar o ID do Calendário:**
1. Ainda nas configurações do calendário, role para baixo até **"Integrar agenda"**
2. O **"ID da agenda"** aparece lá — parece com `abc123@group.calendar.google.com`
3. **Anote esse ID** — você vai precisar ao cadastrar o médico no painel

> 💡 Se o médico ainda não tem um calendário criado, você pode criar um novo calendário no Google Calendar antes de compartilhar.

---

## 🚀 PARTE 11 — PRIMEIRA INICIALIZAÇÃO DO BOT

```bash
cd /opt/atos-saude-bot
node index.js
```

Na primeira vez, você verá mensagens assim:

```
[INFO] Banco de dados inicializado
[WARN] ╔══════════════════════════════════════════╗
[WARN] ║  ATENÇÃO: Usuários padrão criados!       ║
[WARN] ║  admin       / Admin@123                 ║
[WARN] ║  secretaria  / Secr@123                  ║
[WARN] ║  faturamento / Fat@123                   ║
[WARN] ╚══════════════════════════════════════════╝
[INFO] Painel disponível em http://localhost:3000/painel
[INFO] Bot iniciado com sucesso!
```

Isso é normal e esperado. Pare o bot por agora pressionando `Ctrl + C`.

---

## 📲 PARTE 12 — CONECTANDO O WHATSAPP

### 12.1 — Criar a instância na Evolution API

Cole o comando abaixo, **substituindo** `SUA_CHAVE_AQUI` pela senha que você criou no Passo 7:

```bash
curl -X POST http://localhost:8080/instance/create \
  -H "Content-Type: application/json" \
  -H "apikey: SUA_CHAVE_AQUI" \
  -d '{"instanceName": "atossaude", "integration": "WHATSAPP-BAILEYS"}'
```

Se aparecer `"error":false` na resposta, funcionou!

### 12.2 — Conectar via QR Code pelo Painel

Após iniciar o bot (Parte 13), você poderá conectar o WhatsApp diretamente pelo painel web:

1. Acesse o painel no navegador: `http://IP_DO_SERVIDOR:3000/painel`
2. Faça login com `admin` / `Admin@123`
3. Clique na aba **📱 WhatsApp**
4. Clique em **"Gerar QR Code para Conectar"**
5. Escaneie o QR Code com o WhatsApp do celular da clínica:
   - Abra o WhatsApp → Menu (3 pontinhos) → **Aparelhos conectados** → **Conectar aparelho**
6. Aguarde ficar conectado (o painel mostrará "WhatsApp Conectado" em verde)

### 12.3 — Configurar o Webhook

O webhook é o "aviso" que a Evolution API envia ao bot quando chega uma mensagem. Execute:

```bash
curl -X POST "http://localhost:8080/webhook/set/atossaude" \
  -H "Content-Type: application/json" \
  -H "apikey: SUA_CHAVE_AQUI" \
  -d '{
    "url": "http://localhost:3000/webhook",
    "webhook_by_events": false,
    "webhook_base64": false,
    "events": ["messages.upsert"]
  }'
```

---

## ♾️ PARTE 13 — DEIXAR O BOT SEMPRE LIGADO (PM2)

```bash
cd /opt/atos-saude-bot

# Inicia o bot com PM2
pm2 start index.js --name "atos-saude-bot"

# Verifica se está online
pm2 status
```

Você verá uma tabela. A coluna **"status"** deve mostrar `online`.

Agora configure para reiniciar automaticamente quando o servidor ligar:

```bash
pm2 startup
```

Um comando vai aparecer na tela — **copie e execute esse comando exato** (começa com `sudo env PATH=...`).

Depois salve:

```bash
pm2 save
```

---

## 🌐 PARTE 14 — ACESSANDO O PAINEL WEB

Abra o navegador no seu computador e acesse:

```
http://IP_DO_SERVIDOR:3000/painel
```

**Credenciais iniciais:**

| Usuário | Senha inicial | Nível de acesso |
|---|---|---|
| `admin` | `Admin@123` | Administrador — acesso total |
| `secretaria` | `Secr@123` | Secretaria |
| `faturamento` | `Fat@123` | Faturamento |

> ⚠️ **OBRIGATÓRIO:** Na primeira vez que cada usuário entrar, o sistema **exige** a troca de senha. Faça isso imediatamente para todos os perfis.

---

## 👨‍⚕️ PARTE 15 — CADASTRANDO OS MÉDICOS

Com o painel aberto, clique na aba **👨‍⚕️ Médicos**:

1. Preencha o formulário à esquerda com os dados do médico
2. **Google Calendar ID:** Cole o ID que você anotou no Passo 10.6
   - Parece com: `nomemedico@group.calendar.google.com`
3. Configure os dias e horários de atendimento
4. Clique em **"✅ Cadastrar Médico"**

> 💡 O Google Calendar do médico será **criado e configurado automaticamente** pelo sistema após o cadastro.

---

## 🔒 PARTE 16 — SEGURANÇA BÁSICA (Recomendado)

Configure o firewall para bloquear portas desnecessárias:

```bash
ufw allow 22      # SSH (acesso ao servidor)
ufw allow 3000    # Painel web
ufw allow 8080    # Evolution API
ufw enable
```

Quando perguntar "Command may disrupt existing ssh connections. Proceed with operation (y|n)?", digite `y` e Enter.

---

## ✅ CHECKLIST FINAL

Antes de liberar o sistema para uso, confirme cada item:

- [ ] **Evolution API** rodando → `docker ps` mostra `evolution_api` com `Up`
- [ ] **Bot** rodando → `pm2 status` mostra `atos-saude-bot` com `online`
- [ ] **WhatsApp** conectado → Painel mostra "Conectado" na aba WhatsApp
- [ ] **Webhook** configurado (Passo 12.3)
- [ ] **Painel web** acessível no navegador
- [ ] **Senhas trocadas** para todos os usuários
- [ ] **Arquivo google-service-account.json** enviado para o servidor
- [ ] **Médicos cadastrados** no painel com ID do Calendar correto
- [ ] **Teste final:** Envie "oi" para o número do WhatsApp e o bot deve responder com o menu

---

## 🆘 PROBLEMAS COMUNS E SOLUÇÕES

### Bot não responde no WhatsApp

**Causa mais comum:** WhatsApp desconectado.

```bash
pm2 logs atos-saude-bot --lines 50
```

Veja os erros e:
1. Acesse o painel → aba **WhatsApp** → verifique o status
2. Se desconectado, clique em **"Gerar QR Code"** e reconecte

### Painel não abre no navegador

```bash
pm2 status
```

Se o status não for `online`:
```bash
pm2 logs atos-saude-bot --lines 30
pm2 restart atos-saude-bot
```

### "Cannot find module" ao iniciar

```bash
cd /opt/atos-saude-bot
npm install
pm2 restart atos-saude-bot
```

### Google Calendar não está sendo atualizado

Verifique 3 coisas:
1. O arquivo `google-service-account.json` está em `/opt/atos-saude-bot/src/config/`?
   ```bash
   ls /opt/atos-saude-bot/src/config/
   ```
2. O calendário foi compartilhado com o e-mail da conta de serviço?
3. O ID do calendário no cadastro do médico está correto?

### Servidor reiniciou e tudo parou

```bash
cd /opt/evolution && docker compose up -d
pm2 resurrect
```

Se configurou `pm2 startup` corretamente, o bot sobe sozinho. Só a Evolution API precisa do comando acima.

---

## 📞 COMANDOS ESSENCIAIS PARA O DIA A DIA

```bash
# Ver se tudo está rodando
pm2 status
docker ps

# Ver logs do bot (mensagens de erro e atividade)
pm2 logs atos-saude-bot

# Ver logs ao vivo (fica atualizando)
pm2 logs atos-saude-bot --lines 100

# Reiniciar o bot
pm2 restart atos-saude-bot

# Reiniciar a Evolution API
cd /opt/evolution && docker compose restart

# Atualizar o código (se receber atualização)
cd /opt/atos-saude-bot
git pull
npm install
pm2 restart atos-saude-bot

# Fazer backup do banco de dados
cp /opt/atos-saude-bot/atos-saude.db /root/backup-$(date +%Y%m%d).db
```

---

*Versão do documento: 2.0 — Abril 2025*
*Sistema: Atos Saúde Integrada — Bot WhatsApp + Painel Web*
