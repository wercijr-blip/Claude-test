# MedScrita — Guia de Deploy

## Pré-requisitos

- Node.js 20+
- pnpm 10+
- MySQL 8 / TiDB (banco de dados)
- Conta AWS (S3)
- Conta OpenAI (Whisper + GPT-4o)
- Conta SendGrid (e-mail)

---

## 1. Configurar variáveis de ambiente

Copie `.env.example` para `.env` e preencha todas as variáveis:

```bash
cp .env.example .env
```

Variáveis obrigatórias:

```env
DATABASE_URL=mysql://user:pass@host:3306/medscrita
JWT_SECRET=pelo_menos_32_caracteres_aleatorios
OPENAI_API_KEY=sk-...
SENDGRID_API_KEY=SG....
SENDGRID_FROM=noreply@seudominio.com.br
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_S3_BUCKET=medscrita-audio
NODE_ENV=production
PORT=3000
```

---

## 2. Instalar dependências

```bash
pnpm install
```

---

## 3. Criar o banco de dados

```bash
# Aplicar schema (cria as 5 tabelas)
pnpm db:push

# Criar primeiro usuário admin
node seed.ts
```

O seed imprime no terminal: `Admin criado: admin@medscrita.com.br / SENHA_GERADA`

Guarde a senha impressa — ela não é armazenada em texto puro.

---

## 4. Build de produção

```bash
pnpm build
```

Gera `dist/` com o bundle do cliente (Vite) e transpila o servidor.

---

## 5. Iniciar o servidor

```bash
pnpm start
```

O servidor Express serve:
- API tRPC em `/trpc`
- Arquivos estáticos do frontend via `sirv` em `/`

Por padrão na porta `3000` (configure via `PORT`).

---

## 6. Configurar proxy reverso (Nginx)

```nginx
server {
    listen 80;
    server_name app.seudominio.com.br;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Usar Certbot para SSL:

```bash
certbot --nginx -d app.seudominio.com.br
```

---

## 7. Process manager (PM2)

```bash
npm install -g pm2

pm2 start pnpm --name medscrita -- start
pm2 save
pm2 startup
```

---

## 8. S3 Bucket

Crie o bucket com:
- Acesso público bloqueado (uploads são via pre-signed URLs)
- CORS configurado para permitir `PUT` do domínio da aplicação
- Política de lifecycle para deletar áudios após 30 dias (opcional, economia de custo)

---

## 9. Primeiro acesso

1. Acesse `https://app.seudominio.com.br`
2. Faça login com `admin@medscrita.com.br` e a senha gerada pelo seed
3. O sistema solicitará troca de senha no primeiro login (`mustChangePassword = true`)
4. Após trocar a senha, acesse **Painel Administrativo** para cadastrar médicos

---

## Tabelas do banco

| Tabela | Descrição |
|---|---|
| `users` | Médicos e admins |
| `consultations` | Consultas transcritas com SOAP |
| `knowledge_topics` | Tópicos de conhecimento por clínica |
| `consultation_clinical_data` | Dados clínicos extraídos (diagnósticos, exames, medicações) |
| `bulletin_history` | Histórico de boletins enviados |

---

## Atualizações

```bash
git pull origin main
pnpm install
pnpm db:push   # apenas se houver mudanças no schema
pnpm build
pm2 restart medscrita
```
