# Atos Saúde Bot — WhatsApp

Bot WhatsApp para a clínica **Atos Saúde Integrada** (Brasília-DF).

## Funcionalidades

- Menu principal interativo
- Informações sobre a clínica, especialidades e convênios
- Agendamento de consultas com Google Calendar
- Solicitação de infusões (Hospital Dia) e medicações
- FAQ com IA (Claude Haiku) + base de conhecimento
- Painel web de gestão em tempo real (SSE)
- Exportação Excel de agendamentos
- Fila de encaixe com notificação automática
- Pesquisa de satisfação pós-consulta

## Setup

```bash
# 1. Instalar dependências
pnpm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com suas credenciais

# 3. (Opcional) Configurar Google Calendar
# Baixar Service Account JSON e salvar em src/config/google-service-account.json

# 4. Iniciar
pnpm start
```

## Deploy no Railway

```bash
# 1. Conecte o repositório no Railway
# 2. Configure as variáveis de ambiente (ver .env.example)
# 3. Monte um volume persistente em /app para o banco SQLite:
#    RAILWAY_VOLUME_MOUNT_PATH=/app   →   DB_PATH=/app/atos-saude.db
# 4. O railway.json já configura start command, health check e restart policy
```

**Variáveis obrigatórias em produção:**
| Variável | Descrição |
|----------|-----------|
| `JWT_SECRET` | Mínimo 32 chars |
| `PII_ENCRYPTION_KEY` | 64 hex chars — `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `PANEL_ORIGIN` | URL pública do painel (ex: `https://meu-app.up.railway.app`) |
| `BASE_URL` | URL base para links de remarcação |
| `EVOLUTION_URL` | URL do servidor Evolution API |
| `EVOLUTION_API_KEY` | API key da Evolution API |
| `ANTHROPIC_API_KEY` | API key da Anthropic |

## Painel Web

Acesse: `http://localhost:3000/painel`

**Roles disponíveis:**
- `admin` — acesso total
- `secretaria` — agenda, atendimento, encaixe, marcação manual
- `faturamento` — agenda, exportação Excel

## Scripts

```bash
pnpm test               # Roda testes unitários + integração (47 testes)
pnpm run test:calendar  # Testa conexão com Google Calendar
pnpm run add:doctor     # Adiciona novo médico interativamente
```

## API — Endpoints Principais

| Método | Endpoint | Acesso | Descrição |
|--------|----------|--------|-----------|
| `POST` | `/api/auth/login` | público | Login |
| `GET` | `/api/auth/me` | autenticado | Dados do usuário |
| `GET` | `/api/agendamentos` | todos | Lista agendamentos |
| `POST` | `/api/agendamentos/:id/cancelar` | admin/secretaria | Cancela agendamento |
| `PATCH` | `/api/agendamentos/:id/status` | admin/secretaria | Atualiza status |
| `POST` | `/api/agendamentos/manual` | admin/secretaria | Marcação manual |
| `GET` | `/api/slots` | autenticado | Horários disponíveis |
| `GET` | `/api/stats` | autenticado | Estatísticas do dia |
| `GET` | `/api/encaixe` | autenticado | Fila de encaixe |
| `GET` | `/api/sessions/humanas` | admin/secretaria | Atendimentos humanos |
| `POST` | `/api/sessions/:phone/assume` | admin/secretaria | Assume atendimento |
| `POST` | `/api/sessions/:phone/encerrar` | admin/secretaria | Encerra atendimento |
| `GET` | `/api/conversations` | admin/secretaria | Monitor de conversas |
| `POST` | `/api/conversations/:phone/reply` | admin/secretaria | Responde via painel |
| `GET` | `/api/events` | admin/secretaria | SSE para updates em tempo real |
| `GET` | `/api/medicos` | admin/secretaria | Lista médicos |
| `POST` | `/api/conhecimento/upload` | admin | Upload base de conhecimento |
| `POST` | `/api/export` | admin/faturamento | Exportar Excel |
| `GET` | `/api/whatsapp/status` | admin | Status conexão WhatsApp |
| `GET` | `/health` | público | Health check |
| `POST` | `/webhook` | Evolution API | Webhook WhatsApp |

## Segurança

- Senhas com bcrypt (fator 10)
- JWT 12h com verificação no banco a cada request
- Rate limit: login (10/15min), API geral (120/min), WhatsApp (5 msgs/min por número)
- CSP headers via Helmet (scripts apenas de CDN autorizado)
- HTTPS obrigatório em produção
- PII (nome, nascimento, telefone) cifrado com AES-256-GCM no banco
- Retenção automática de mensagens: 90 dias (LGPD)
- Webhook validado com `timingSafeEqual`

## Estrutura

```
src/
  config/         Configurações (clínica, médicos, prompt IA, textos)
  flows/          Máquinas de estado dos fluxos de conversa
  handlers/       Roteador de mensagens WhatsApp
  services/       DB, WhatsApp, Calendar, Claude, Export, Auth
  utils/          Logger, rate-limiter, retry, SSE, PII crypto, validators
  webhook/        Handler Evolution API
  panel/          Painel web (Alpine.js + rotas Express)
  tests/          Testes (vitest) — auth, routes, webhook, router, pii, scheduler
  scripts/        Scripts CLI utilitários
```
