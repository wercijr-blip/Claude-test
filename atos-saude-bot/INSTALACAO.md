# 📦 Manual de Instalação — Atos Saúde Bot
### Guia Completo para Iniciantes

---

## 🗺️ Visão Geral do Sistema

Antes de instalar, entenda o que o sistema é composto:

```
Internet (WhatsApp)
       ↓
Evolution API  ←→  Bot (Node.js)  ←→  Banco SQLite
       ↑                ↑
  (envia/recebe)   (lógica)
                        ↓
                 Google Calendar
                        ↓
                  Claude AI (FAQ)
```

| Componente | O que faz | Onde roda |
|---|---|---|
| **Evolution API** | Conecta ao WhatsApp | Servidor (Docker) |
| **Bot Node.js** | Toda a lógica do chatbot e painel | Servidor |
| **SQLite** | Banco de dados local (sem instalar separado) | Arquivo no servidor |
| **Google Calendar** | Agenda dos médicos | Nuvem Google |
| **Claude AI** | Responde dúvidas sobre convênios | Nuvem Anthropic |

---

## 🖥️ PARTE 1 — Escolhendo o Servidor

### Opção recomendada: VPS (Servidor na nuvem)

Você precisa de um servidor Linux sempre ligado. Recomendamos a **Hostinger KVM 1**:

- **Preço:** ~R$ 35/mês
- **Especificações mínimas:** 1 vCPU, 4 GB RAM, 50 GB SSD
- **Sistema operacional:** Ubuntu 22.04 LTS

> ⚠️ **NÃO** use computador local ou hospedagem de sites (cPanel/Plesk). Essas opções não funcionam com o sistema.

### Como contratar a Hostinger:
1. Acesse `hostinger.com.br`
2. Vá em **VPS Hosting → KVM 1**
3. Selecione **Ubuntu 22.04**
4. Anote o **IP do servidor**, **usuário** (root) e **senha** que chegará por e-mail

---

## 🔌 PARTE 2 — Acessando o Servidor

Você vai controlar o servidor pela linha de comando. Use um programa chamado **SSH**.

### No Windows:
1. Baixe o **PuTTY** em: `putty.org`
2. Abra o PuTTY
3. Em **Host Name**, coloque o IP do seu servidor (ex: `192.168.1.100`)
4. Clique em **Open**
5. Quando pedir login, digite: `root`
6. Digite a senha (os caracteres NÃO aparecem na tela — isso é normal, continue digitando)

### No Mac ou Linux:
1. Abra o **Terminal**
2. Digite: `ssh root@SEU_IP_AQUI` (substitua pelo IP real)
3. Digite a senha quando pedir

> 💡 A partir daqui, todos os comandos são digitados dentro do servidor.

---

## 🐋 PARTE 3 — Instalando o Docker

O Docker é necessário para rodar a Evolution API. Execute os comandos abaixo um por vez:

```bash
# 1. Atualiza o sistema
apt update && apt upgrade -y

# 2. Instala dependências
apt install -y curl git wget nano

# 3. Instala o Docker
curl -fsSL https://get.docker.com | sh

# 4. Instala o Docker Compose
apt install -y docker-compose-plugin

# 5. Verifica se instalou corretamente
docker --version
docker compose version
```

Se aparecer algo como `Docker version 24.x.x` — funcionou!

---

## 🟢 PARTE 4 — Instalando o Node.js 20

```bash
# 1. Adiciona o repositório do Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -

# 2. Instala o Node.js
apt install -y nodejs

# 3. Verifica a versão (deve ser 20.x.x)
node --version
npm --version
```

---

## ♻️ PARTE 5 — Instalando o PM2 (mantém o bot sempre ligado)

O PM2 é um gerenciador que reinicia o bot automaticamente se ele cair.

```bash
npm install -g pm2
pm2 --version
```

---

## 📱 PARTE 6 — Instalando a Evolution API (WhatsApp)

A Evolution API é o componente que conecta seu bot ao WhatsApp.

### 6.1 — Criar pasta e arquivo de configuração

```bash
# Cria a pasta
mkdir -p /opt/evolution
cd /opt/evolution

# Cria o arquivo docker-compose.yml
nano docker-compose.yml
```

Quando o editor abrir, cole o conteúdo abaixo (use Ctrl+Shift+V para colar no terminal):

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
      - AUTHENTICATION_API_KEY=TROQUE_POR_UMA_CHAVE_SEGURA_AQUI
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

> ⚠️ **IMPORTANTE:** Troque `TROQUE_POR_UMA_CHAVE_SEGURA_AQUI` por uma senha forte (ex: `MinhaChave#2025!`). Anote essa chave — você vai precisar depois.

Para salvar: pressione `Ctrl+X`, depois `Y`, depois `Enter`.

### 6.2 — Iniciar a Evolution API

```bash
cd /opt/evolution
docker compose up -d

# Verifica se está rodando
docker ps
```

Deve aparecer o container `evolution_api` com status `Up`.

---

## 🤖 PARTE 7 — Instalando o Bot

### 7.1 — Copiar os arquivos para o servidor

Se o código está em um repositório Git:
```bash
cd /opt
git clone URL_DO_SEU_REPOSITORIO atos-saude-bot
cd atos-saude-bot
```

Se você vai fazer upload manual (via FTP/SFTP):
- Use o programa **FileZilla** (gratuito em `filezilla-project.org`)
- Conecte com: Host = IP do servidor, Usuário = root, Senha = sua senha, Porta = 22
- Faça upload de toda a pasta do bot para `/opt/atos-saude-bot`

```bash
# Após copiar os arquivos, entre na pasta
cd /opt/atos-saude-bot
```

### 7.2 — Instalar as dependências

```bash
npm install
```

Aguarde. Vai baixar todos os pacotes necessários (~1-2 minutos).

---

## ⚙️ PARTE 8 — Configurando o Arquivo .env

O arquivo `.env` contém todas as configurações do sistema. É como o "painel de controle" da instalação.

```bash
# Cria o arquivo .env a partir do exemplo
cp .env.example .env

# Abre para editar
nano .env
```

### O que preencher em cada linha:

```env
# ─── Evolution API (WhatsApp) ─────────────────────────────
EVOLUTION_URL=http://localhost:8080
EVOLUTION_API_KEY=AQUI_A_CHAVE_QUE_VOCÊ_CRIOU_NO_DOCKER
INSTANCE_NAME=atossaude

# ─── Google Calendar ──────────────────────────────────────
GOOGLE_SERVICE_ACCOUNT_PATH=./src/config/google-service-account.json

# ─── Claude AI (FAQ de convênios) ─────────────────────────
ANTHROPIC_API_KEY=sk-ant-XXXXXXXXXX

# ─── Configurações gerais ─────────────────────────────────
PORT=3000
NODE_ENV=production

# ─── Segurança do painel ──────────────────────────────────
JWT_SECRET=CRIE_UMA_SENHA_LONGA_E_ALEATÓRIA_AQUI_MINIMO_32_CARACTERES
```

#### Onde conseguir cada chave:

**EVOLUTION_API_KEY:** É a senha que você escolheu no Passo 6.1.

**ANTHROPIC_API_KEY:**
1. Acesse `console.anthropic.com`
2. Crie uma conta (ou faça login)
3. Vá em **API Keys → Create Key**
4. Copie a chave (começa com `sk-ant-`)
5. Adicione créditos em **Billing** (~$5 dólares já é suficiente para começar)

**JWT_SECRET:** Invente uma senha longa e aleatória, ex:
`MinhaClinicaAtos#2025!ChaveSegura@Panel`

Para salvar: `Ctrl+X`, `Y`, `Enter`.

---

## 📅 PARTE 9 — Configurando o Google Calendar

Esta é a parte mais técnica. Siga com atenção.

### 9.1 — Criar Projeto no Google Cloud

1. Acesse `console.cloud.google.com`
2. Clique em **Selecionar projeto → Novo projeto**
3. Nome: `AtosSaude` — clique em **Criar**
4. Certifique-se que o projeto `AtosSaude` está selecionado

### 9.2 — Ativar a API do Calendar

1. No menu lateral, vá em **APIs e serviços → Biblioteca**
2. Pesquise `Google Calendar API`
3. Clique nela e depois em **Ativar**

### 9.3 — Criar a Conta de Serviço

1. Vá em **APIs e serviços → Credenciais**
2. Clique em **Criar credenciais → Conta de serviço**
3. Nome: `atos-saude-bot`
4. Clique em **Criar e continuar → Concluído**
5. Clique na conta de serviço que acabou de criar
6. Vá na aba **Chaves → Adicionar chave → Criar nova chave**
7. Escolha **JSON** → **Criar**
8. Um arquivo `.json` será baixado no seu computador

### 9.4 — Enviar o arquivo JSON para o servidor

Use o FileZilla para enviar o arquivo baixado para:
`/opt/atos-saude-bot/src/config/google-service-account.json`

### 9.5 — Compartilhar o Calendário do Médico com a Conta de Serviço

Para cada médico que usa o sistema:

1. Abra o **Google Calendar** da conta do médico
2. No calendário do médico (barra lateral esquerda), clique nos **3 pontinhos → Configurações e compartilhamento**
3. Em **Compartilhar com pessoas específicas**, clique em **Adicionar pessoas**
4. Cole o e-mail da conta de serviço (está dentro do arquivo JSON, campo `client_email` — parece com `atos-saude-bot@atossaude.iam.gserviceaccount.com`)
5. Permissão: **Fazer alterações e gerenciar compartilhamento**
6. Clique em **Enviar**
7. Anote o **ID do calendário**: nas configurações do calendário, role até **ID do calendário** (parece com `xxxxx@group.calendar.google.com`)

> 💡 O ID do calendário você vai precisar ao cadastrar o médico no painel.

---

## 🏥 PARTE 10 — Primeira Inicialização

```bash
cd /opt/atos-saude-bot
node index.js
```

Na primeira execução você vai ver mensagens como:
```
[WARN]  Banco de dados inicializado
[WARN]  ╔══════════════════════════════════════════════════════╗
[WARN]  ║  ATENÇÃO: Usuários padrão criados. TROQUE AS SENHAS! ║
[WARN]  ║  admin / Admin@123                                   ║
[WARN]  ║  secretaria / Secr@123                               ║
[WARN]  ║  faturamento / Fat@123                               ║
[WARN]  ╚══════════════════════════════════════════════════════╝
[INFO]  Painel disponível em http://localhost:3000/painel
```

Isso é normal. Pare o bot por agora com `Ctrl+C`.

---

## 📱 PARTE 11 — Conectando o WhatsApp

### 11.1 — Criar a instância na Evolution API

```bash
curl -X POST http://localhost:8080/instance/create \
  -H "Content-Type: application/json" \
  -H "apikey: SUA_CHAVE_DA_EVOLUTION" \
  -d '{"instanceName": "atossaude", "integration": "WHATSAPP-BAILEYS"}'
```

### 11.2 — Conectar via QR Code

1. Abra no navegador (no seu computador, não no servidor):
   `http://IP_DO_SERVIDOR:8080/manager`

2. Faça login com a chave da Evolution API

3. Clique na instância **atossaude**

4. Clique em **Connect → QR Code**

5. No celular da clínica (o número que será o bot):
   - Abra WhatsApp → Menu (3 pontinhos) → **Aparelhos conectados**
   - Toque em **Conectar aparelho**
   - Escaneie o QR Code

6. Aguarde ficar **Connected** (verde)

### 11.3 — Configurar o Webhook (avisar o bot sobre mensagens)

```bash
curl -X POST "http://localhost:8080/webhook/set/atossaude" \
  -H "Content-Type: application/json" \
  -H "apikey: SUA_CHAVE_DA_EVOLUTION" \
  -d '{
    "url": "http://localhost:3000/webhook",
    "webhook_by_events": false,
    "webhook_base64": false,
    "events": ["messages.upsert"]
  }'
```

---

## 🔄 PARTE 12 — Deixar o Bot Sempre Ligado com PM2

```bash
cd /opt/atos-saude-bot

# Inicia com PM2
pm2 start index.js --name "atos-saude-bot"

# Verifica se está rodando
pm2 status

# Para iniciar automaticamente quando o servidor reiniciar
pm2 startup
# (copie e execute o comando que aparecer na tela)
pm2 save

# Ver logs em tempo real
pm2 logs atos-saude-bot
```

---

## 🌐 PARTE 13 — Acessar o Painel

Abra o navegador no seu computador e acesse:

```
http://IP_DO_SERVIDOR:3000/painel
```

**Credenciais iniciais:**
| Usuário | Senha | Nível |
|---|---|---|
| `admin` | `Admin@123` | Administrador (acesso total) |
| `secretaria` | `Secr@123` | Secretaria |
| `faturamento` | `Fat@123` | Faturamento |

> ⚠️ **OBRIGATÓRIO:** Na primeira entrada, o sistema exigirá que você troque a senha. Faça isso imediatamente para todos os usuários.

---

## 🔒 PARTE 14 — Segurança Básica (Recomendado)

### Bloquear portas desnecessárias:
```bash
ufw allow 22      # SSH
ufw allow 3000    # Painel
ufw allow 8080    # Evolution API
ufw enable
```

### (Opcional) Usar domínio com HTTPS:
Se você tiver um domínio (ex: `painel.atossaude.com.br`), instale o Nginx como proxy:

```bash
apt install nginx certbot python3-certbot-nginx -y
```

Isso fornece HTTPS gratuito via Let's Encrypt. Consulte um técnico para essa configuração.

---

## ✅ CHECKLIST FINAL DE INSTALAÇÃO

Antes de colocar em produção, confirme:

- [ ] Evolution API rodando (`docker ps` mostra container ativo)
- [ ] WhatsApp conectado (status Connected na interface da Evolution)
- [ ] Webhook configurado
- [ ] Bot iniciado com PM2 (`pm2 status` mostra `online`)
- [ ] Painel acessível no navegador
- [ ] Senhas padrão trocadas para todos os usuários
- [ ] Arquivo `google-service-account.json` copiado para o servidor
- [ ] Calendário dos médicos compartilhado com a conta de serviço
- [ ] Médicos cadastrados no painel com ID do Calendar correto
- [ ] Teste: envie `oi` para o número do WhatsApp e veja se o bot responde

---

## 🆘 Problemas Comuns

### Bot não responde no WhatsApp
```bash
pm2 logs atos-saude-bot   # veja os erros
pm2 restart atos-saude-bot
```
Verifique se o WhatsApp ainda está conectado na Evolution API.

### Painel não abre
```bash
pm2 status  # verifica se está rodando
# Se estiver "errored":
pm2 logs atos-saude-bot --lines 50
```

### Google Calendar não funciona
- Verifique se o arquivo `google-service-account.json` está no caminho correto
- Verifique se o calendário foi compartilhado com o e-mail da conta de serviço
- Verifique se o ID do calendário está correto no cadastro do médico

### Restartar tudo após reboot do servidor:
```bash
pm2 resurrect          # reinicia os processos salvos
cd /opt/evolution
docker compose up -d   # reinicia a Evolution API
```

---

## 📞 Resumo dos Comandos Essenciais

```bash
# Status do bot
pm2 status

# Ver logs ao vivo
pm2 logs atos-saude-bot

# Reiniciar bot
pm2 restart atos-saude-bot

# Parar bot
pm2 stop atos-saude-bot

# Status da Evolution API
docker ps

# Reiniciar Evolution API
cd /opt/evolution && docker compose restart

# Atualizar o código (se usar Git)
cd /opt/atos-saude-bot
git pull
npm install
pm2 restart atos-saude-bot
```
