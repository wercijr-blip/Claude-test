# Guia de Deploy — MedScribe
### Para quem nunca fez deploy antes

> Este guia assume que você tem um computador com Windows ou Mac e vai colocar o MedScribe no ar em um servidor na nuvem. Siga cada passo na ordem. Não pule etapas.

---

## O que você vai precisar (antes de começar)

Antes de iniciar, separe:

| O que | Para que serve | Onde conseguir |
|-------|---------------|----------------|
| Cartão de crédito | Pagar o servidor | — |
| Chave da OpenAI | IA do sistema (transcrição e SOAP) | platform.openai.com |
| Domínio (ex: `minhaClinica.com.br`) | Endereço do site | registro.br ou godaddy.com |

---

## PARTE 1 — Contratar o Servidor

### Passo 1 — Criar conta na DigitalOcean

1. Acesse **digitalocean.com**
2. Clique em **Sign Up**
3. Crie conta com e-mail e senha
4. Coloque um cartão de crédito (cobrado conforme uso)

### Passo 2 — Criar o servidor (Droplet)

1. No painel, clique em **Create → Droplets**
2. Escolha as opções:
   - **Region:** São Paulo (ou o mais próximo do Brasil)
   - **Image:** Ubuntu 22.04 LTS
   - **Size:** Basic → Regular → **2 GB RAM / 1 CPU** (≈ $12/mês)
   - **Authentication:** Password → crie uma senha forte e **anote ela**
3. Clique em **Create Droplet**
4. Aguarde 1 minuto. Você receberá um **endereço IP** (ex: `143.198.50.25`) — **anote ele**

---

## PARTE 2 — Acessar o Servidor

### Passo 3 — Instalar o terminal SSH

**No Windows:**
1. Baixe o **MobaXterm** em mobaxterm.mobatek.net (versão Home gratuita)
2. Instale normalmente

**No Mac:**
1. Abra o aplicativo **Terminal** (já vem instalado)

### Passo 4 — Conectar ao servidor

**No MobaXterm (Windows):**
1. Abra o MobaXterm
2. Clique em **Session → SSH**
3. Em "Remote host", coloque o IP do seu servidor (ex: `143.198.50.25`)
4. Em "Username", coloque: `root`
5. Clique **OK**
6. Digite a senha que você criou no Passo 2

**No Terminal (Mac):**
```
ssh root@143.198.50.25
```
(troque pelo seu IP) → pressione Enter → Digite a senha

> Você está agora "dentro" do servidor. Tudo que digitar aqui roda no servidor, não no seu computador.

---

## PARTE 3 — Preparar o Servidor

Copie e cole **cada bloco de comandos** no terminal. Aguarde terminar antes de continuar.

### Passo 5 — Atualizar o sistema

```bash
apt update && apt upgrade -y
```
> Aguarde. Pode demorar 2-3 minutos.

### Passo 6 — Instalar Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v
```
> Deve aparecer algo como `v20.x.x`. Se aparecer, está certo.

### Passo 7 — Instalar pnpm (gerenciador de pacotes)

```bash
npm install -g pnpm
pnpm -v
```
> Deve aparecer um número de versão. Está certo.

### Passo 8 — Instalar o banco de dados MySQL

```bash
apt install -y mysql-server
mysql_secure_installation
```

O sistema vai fazer perguntas. Responda assim:
- `Would you like to setup VALIDATE PASSWORD component?` → Digite `n` e Enter
- `New password:` → Crie uma senha forte (ex: `MedScribe@2025!`) — **anote ela**
- `Re-enter new password:` → Repita a senha
- Todas as próximas perguntas → Digite `y` e Enter

### Passo 9 — Criar o banco de dados

```bash
mysql -u root -p
```
Digite a senha do MySQL que você criou acima. Depois cole esses comandos um por um:

```sql
CREATE DATABASE medscribe CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'medscribe'@'localhost' IDENTIFIED BY 'SuaSenhaDoBanco123!';
GRANT ALL PRIVILEGES ON medscribe.* TO 'medscribe'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```
> **Anote:** usuário `medscribe`, senha que você escolheu acima.

### Passo 10 — Instalar Redis (fila de tarefas)

```bash
apt install -y redis-server
systemctl enable redis-server
systemctl start redis-server
redis-cli ping
```
> Deve aparecer `PONG`. Está funcionando.

### Passo 11 — Instalar o Nginx (servidor web)

```bash
apt install -y nginx
systemctl enable nginx
systemctl start nginx
```

### Passo 12 — Instalar o PM2 (mantém o site no ar)

```bash
npm install -g pm2
pm2 startup
```
> O comando vai mostrar uma linha começando com `sudo env PATH=...`. **Copie essa linha toda** e execute ela.

---

## PARTE 4 — Configurar o Domínio

### Passo 13 — Apontar o domínio para o servidor

1. Acesse o painel de onde você comprou o domínio (registro.br, GoDaddy, etc.)
2. Vá em **Gerenciar DNS** ou **Zone DNS**
3. Crie um registro do tipo **A**:
   - **Nome/Host:** `@` (ou deixe em branco para o domínio raiz)
   - **Valor/Points to:** o IP do seu servidor (ex: `143.198.50.25`)
   - **TTL:** 3600 (ou padrão)
4. Se quiser também o `www`, crie outro registro A com:
   - **Nome/Host:** `www`
   - **Valor:** mesmo IP

> **Aguarde 10-30 minutos** para o DNS propagar antes de continuar.

---

## PARTE 5 — Colocar o Código no Servidor

### Passo 14 — Fazer download do código

No terminal do servidor:

```bash
cd /var/www
git clone https://github.com/wercijr-blip/Claude-test.git medscribe
cd medscribe
git checkout claude/medscribe-auth-admin-3Lc5Y
```

### Passo 15 — Instalar as dependências

```bash
pnpm install
```
> Aguarde. Pode demorar 2-4 minutos na primeira vez.

---

## PARTE 6 — Configurar as Variáveis de Ambiente

### Passo 16 — Criar o arquivo .env

```bash
cp .env.example .env
nano .env
```

Um editor de texto vai abrir. Edite cada linha com seus dados reais:

```
DATABASE_URL=mysql://medscribe:SuaSenhaDoBanco123!@localhost:3306/medscribe
JWT_SECRET=cole_aqui_uma_string_aleatoria_grande
OPENAI_API_KEY=sk-...sua chave da OpenAI...
MEDSCRIBE_URL=https://seudominio.com.br
MEDSCRIBE_CLINIC_NAME=Nome da Sua Clínica
NODE_ENV=production
PORT=3000
REDIS_URL=redis://localhost:6379
VITE_APP_ID=medscribe
```

**Para gerar o JWT_SECRET** (abra outra aba do terminal ou rode antes de entrar no nano):
```bash
openssl rand -hex 32
```
Copie o resultado e cole no lugar de `cole_aqui_uma_string_aleatoria_grande`.

**Para salvar no nano:**
- Pressione `Ctrl + X`
- Pressione `Y`
- Pressione `Enter`

### Passo 17 — Configurar chave da OpenAI

1. Acesse **platform.openai.com**
2. Faça login ou crie uma conta
3. Vá em **API Keys → Create new secret key**
4. Copie a chave (começa com `sk-`)
5. Cole no `.env` no campo `OPENAI_API_KEY=`

---

## PARTE 7 — Configurar o Banco de Dados

### Passo 18 — Criar as tabelas

```bash
cd /var/www/medscribe
npx drizzle-kit push
```
> Vai mostrar várias linhas e perguntar confirmação. Digite `y` e Enter.

### Passo 19 — Aplicar as tabelas do MedScribe

```bash
mysql -u medscribe -p medscribe < drizzle/migrations/0004_auth_users.sql
mysql -u medscribe -p medscribe < drizzle/migrations/0005_knowledge_topics.sql
mysql -u medscribe -p medscribe < drizzle/migrations/0006_consultation_clinical_data.sql
mysql -u medscribe -p medscribe < drizzle/migrations/0007_bulletin_history.sql
```
> Vai pedir a senha do banco (`SuaSenhaDoBanco123!`) em cada comando.

### Passo 20 — Criar o primeiro usuário administrador

```bash
npx tsx seed.ts \
  --email=seuemail@gmail.com \
  --nome="Dr. Seu Nome" \
  --crm=12345 \
  --especialidade="Clínica Médica"
```

> Substitua pelos seus dados reais. O sistema vai mostrar uma senha temporária — **anote ela**, você vai precisar para fazer o primeiro login.

---

## PARTE 8 — Colocar o Site no Ar

### Passo 21 — Fazer o build (compilar o site)

```bash
cd /var/www/medscribe
pnpm build
```
> Aguarde. Pode demorar 1-2 minutos.

### Passo 22 — Iniciar o servidor com PM2

```bash
pm2 start pnpm --name medscribe -- start
pm2 save
```

Verifique se está rodando:
```bash
pm2 status
```
> Deve aparecer `medscribe` com status `online` em verde.

### Passo 23 — Configurar o Nginx (proxy)

```bash
nano /etc/nginx/sites-available/medscribe
```

Cole este conteúdo (substituindo `seudominio.com.br` pelo seu domínio real):

```nginx
server {
    listen 80;
    server_name seudominio.com.br www.seudominio.com.br;

    client_max_body_size 55M;

    location / {
        proxy_pass         http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

Salve: `Ctrl + X` → `Y` → `Enter`

Ative o site:
```bash
ln -s /etc/nginx/sites-available/medscribe /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```
> `nginx -t` deve mostrar `syntax is ok` e `test is successful`.

### Passo 24 — Instalar o certificado HTTPS (cadeado verde)

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d seudominio.com.br -d www.seudominio.com.br
```

O Certbot vai fazer perguntas:
- **Email:** coloque seu e-mail real (para avisos de expiração)
- **Agree to terms:** `A`
- **Share email with EFF:** `N`

Quando terminar, acesse `https://seudominio.com.br` no navegador. Deve aparecer o cadeado verde e a tela de login do MedScribe.

---

## PARTE 9 — Primeiro Acesso

### Passo 25 — Fazer login

1. Abra o navegador e acesse `https://seudominio.com.br`
2. Coloque o e-mail e a senha temporária gerada no Passo 20
3. O sistema vai pedir para criar uma nova senha — escolha uma senha forte

Pronto! O MedScribe está no ar.

---

## PARTE 10 — Manutenção Básica

### Ver se o site está funcionando
```bash
pm2 status
```

### Ver erros (se algo não funcionar)
```bash
pm2 logs medscribe --lines 50
```

### Reiniciar o servidor (após atualização)
```bash
cd /var/www/medscribe
git pull
pnpm install
pnpm build
pm2 restart medscribe
```

### Renovar o certificado HTTPS automaticamente

O Certbot já configura a renovação automática. Para verificar:
```bash
certbot renew --dry-run
```
> Deve aparecer `Congratulations, all simulated renewals succeeded`.

---

## Problemas Comuns

| Problema | Solução |
|----------|---------|
| Site não abre | Verifique `pm2 status` — deve estar `online`. Se `errored`, rode `pm2 logs medscribe` |
| "502 Bad Gateway" | O servidor Node não está rodando. Rode `pm2 restart medscribe` |
| Login não funciona | Verifique se `JWT_SECRET` está preenchido no `.env` |
| Transcrição de áudio não funciona | Verifique se `OPENAI_API_KEY` está correto e com crédito |
| DNS não resolveu ainda | Aguarde mais tempo (pode levar até 24h em alguns provedores) |
| Esqueci a senha do admin | No servidor: `npx tsx seed.ts --email=seuemail@gmail.com --nome="Nome" --crm=123 --especialidade="Especialidade"` — cria novo admin |

---

## Resumo dos dados que você anotou

Ao longo do guia, você precisou anotar:

- [ ] IP do servidor (ex: `143.198.50.25`)
- [ ] Senha do servidor (root)
- [ ] Senha do banco de dados MySQL
- [ ] JWT_SECRET gerado
- [ ] Chave da OpenAI (sk-...)
- [ ] Senha temporária do primeiro admin
- [ ] Seu domínio

Guarde essas informações em local seguro.
