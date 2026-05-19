# Atos Saúde Bot — WhatsApp

Bot WhatsApp para a clínica **Atos Saúde Integrada** (Brasília-DF).

## Funcionalidades

- Menu principal interativo
- Informações sobre a clínica, especialidades e convênios
- Agendamento de consultas com Google Calendar
- Solicitação de infusões (Hospital Dia)
- Solicitação de medicação
- FAQ com IA (Claude) + base de conhecimento
- Painel web de gestão
- Exportação Excel

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

## Painel Web

Acesse: `http://localhost:3000/painel`

## Scripts

```bash
pnpm test               # Roda testes unitários + integração
pnpm run test:calendar  # Testa conexão com Google Calendar
pnpm run add:doctor     # Adiciona novo médico interativamente
```

## Estrutura

```
src/
  config/         Configurações (clínica, médicos, prompt IA)
  flows/          Máquinas de estado dos fluxos de conversa
  handlers/       Roteador de mensagens
  services/       DB, WhatsApp, Calendar, Claude, Export
  utils/          Validators, logger, rate limiter
  webhook/        Handler Evolution API
  panel/          Painel web (HTML + rotas API)
  scripts/        Scripts CLI utilitários
```
