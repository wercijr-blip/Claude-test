# MedScribe — Deploy Guide

## Requisitos

- Node.js 20+
- pnpm 10+
- MySQL 8 / TiDB
- Redis (para BullMQ)
- AWS S3 (opcional, para exames)

## 1. Variáveis de ambiente

Copie `.env.example` para `.env` e preencha todos os campos obrigatórios:

```bash
cp .env.example .env
```

Campos mínimos para o MedScribe funcionar:

```env
DATABASE_URL=mysql://user:pass@host:3306/medscribe?ssl={"rejectUnauthorized":true}
JWT_SECRET=<string aleatória >= 32 chars>
OPENAI_API_KEY=sk-...
MEDSCRIBE_URL=https://seu-dominio.com
MEDSCRIBE_CLINIC_NAME=Nome da Clínica
PORT=3000
```

## 2. Instalar dependências

```bash
pnpm install
```

## 3. Migrations do banco de dados

Execute as migrations **na ordem numérica**:

```sql
-- 0000 a 0003: schema base (Facilita PrEP legado)
-- Aplique com:
npx drizzle-kit push
```

Para as migrations MedScribe adicionadas manualmente:

```bash
mysql -u user -p medscribe < drizzle/migrations/0004_auth_users.sql
mysql -u user -p medscribe < drizzle/migrations/0005_knowledge_topics.sql
mysql -u user -p medscribe < drizzle/migrations/0006_consultation_clinical_data.sql
```

## 4. Criar primeiro admin

```bash
npx tsx seed.ts \
  --email=admin@clinica.com \
  --nome="Dr. Admin" \
  --crm=12345 \
  --especialidade=Clínica\ Médica \
  --senha=SenhaForte123!
```

O script cria o usuário e exibe a senha gerada (ou usa `--senha` se fornecida). Na primeira autenticação o sistema força troca de senha se `mustChangePassword=1`.

## 5. Build

```bash
pnpm build
```

Gera `dist/` (frontend estático) e o servidor compilado.

## 6. Iniciar em produção

```bash
pnpm start
```

Ou com PM2:

```bash
pm2 start pnpm --name medscribe -- start
pm2 save
pm2 startup
```

## 7. Nginx (proxy reverso)

```nginx
server {
    listen 443 ssl;
    server_name seu-dominio.com;

    ssl_certificate     /etc/letsencrypt/live/seu-dominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/seu-dominio.com/privkey.pem;

    client_max_body_size 55M;  # >= limite do Express (50MB)

    location / {
        proxy_pass         http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 8. Docker (opcional)

```dockerfile
FROM node:20-alpine
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate
COPY pnpm-lock.yaml package.json ./
RUN pnpm install --frozen-lockfile --prod
COPY . .
RUN pnpm build
EXPOSE 3000
CMD ["pnpm", "start"]
```

```bash
docker build -t medscribe .
docker run -d --env-file .env -p 3000:3000 medscribe
```

## 9. Ordem de migration detalhada

| Arquivo | Conteúdo |
|---------|----------|
| `0000_*.sql` | Tabela `tokens` |
| `0001_*.sql` | Tabelas `pacientes`, `exames`, `tcle_assinaturas` |
| `0002_*.sql` | Tabela `security_events` |
| `0003_*.sql` | Tabela `users` (base) |
| `0004_auth_users.sql` | Colunas MedScribe em `users` + rename de roles |
| `0005_knowledge_topics.sql` | Tabela `knowledge_topics` |
| `0006_consultation_clinical_data.sql` | Tabelas `consultations` + `consultation_clinical_data` |

## 10. Verificação pós-deploy

```bash
# Testes automatizados
pnpm test

# TypeScript
pnpm check

# Verificar servidor
curl https://seu-dominio.com/trpc/auth.me
# Deve retornar 401 (não autenticado)
```
