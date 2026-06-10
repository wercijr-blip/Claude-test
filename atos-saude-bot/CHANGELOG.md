# Changelog — Atos Saúde WhatsApp Bot

## [Unreleased] — 2026-04-27

### Bug Fixes

#### Painel Web (`src/panel/index.html`)

- **Bug #1 — Conflito x-for/tab**: variável de loop `tab` em `x-for="tab in tabs..."` sobrescrevia a propriedade de estado `tab: 'agenda'` do Alpine.js, fazendo `tab.id` falhar com `undefined`. Renomeada para `navItem`.
- **Bug #2 — QR Code via serviço externo**: `<img>` apontava para `api.qrserver.com` (serviço externo de geração de QR), substituído por renderização direta do base64 retornado pela Evolution API (`data:image/png;base64,...`).
- **Bug #2 — Extração do QR Code**: `loadQR()` usava `d.qr || d.base64` mas Evolution API v2 retorna `d.qrcode.base64`. Corrigido para `d.qrcode?.base64 || d.base64 || d.qr`.
- **Bug #2 — Extração do status WA**: `loadWAStatus()` usava `d.status` mas Evolution API v2 retorna `d.instance.state`. Corrigido para `d.instance?.state || d.instance?.connectionStatus || d.state || d.status`.
- **Conflito de nome `login`**: método `async login()` sobrescrevia o objeto de estado `login: {}`. Renomeado para `_doLogin()`.
- **Troca de senha**: `salvarNovaSenha()` enviava `{ password }` mas backend espera `{ currentPassword, newPassword }`. Corrigido + adicionado estado `currentPwd`.
- **Tabs com binding errado**: 6 abas usavam `x-show="tab==='...'"` em vez de `x-show="activeTab==='...'"`. Corrigidas todas + adicionado `x-cloak`.
- **`exportar()` tentava parsear JSON em download de arquivo**: trocado `api()` por `fetch()` + blob download.
- **`loadTextos()` array vs objeto**: API retorna array `[{id, nome, conteudo}]`, `textosEditados` precisa de `{nome: conteudo}`. Corrigido com conversão explícita.
- **`salvarMarcacao()` nomes de campo errados**: enviava `medico_id, slot_datetime` mas rota espera `doctorId, slotISO`.

#### Backend (`src/panel/routes/index.js`)

- Adicionadas 18+ rotas em PT-BR como aliases e funcionalidades novas.
- `GET /api/medicos` agora retorna `especialidade` E `especialidades` (compatibilidade com frontend).
- Adicionado `PATCH /api/medicos/:id/toggle` para ativar/desativar médicos.
- Adicionado `GET /api/medicos/:id/slots` para buscar slots disponíveis.
- Adicionado `PUT /api/textos` para substituição em massa de mensagens.
- `POST /api/medicos` aceita todos os campos expandidos do formulário.

#### Servidor (`index.js`)

- Corrigida montagem do router de auth: `app.use('/auth', ...)` → `app.use('/api/auth', ...)` declarado ANTES de `app.use('/api', ...)` para match correto de rotas.

#### IA (`src/services/claude.js`)

- Substituído modelo hardcoded inválido por `process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001'`.

#### Configuração (`.env.example`)

- Adicionada variável `CLAUDE_MODEL=claude-haiku-4-5-20251001`.

---

### Mapa de Endpoints do Painel

| Método | Rota                                 | Descrição                                             |
| ------ | ------------------------------------ | ----------------------------------------------------- |
| GET    | `/api/agendamentos`                  | Lista agendamentos (filtros: data, status, medico_id) |
| POST   | `/api/agendamentos`                  | Cria novo agendamento                                 |
| PATCH  | `/api/agendamentos/:id/status`       | Atualiza status do agendamento                        |
| DELETE | `/api/agendamentos/:id`              | Cancela agendamento                                   |
| GET    | `/api/pacientes`                     | Lista pacientes                                       |
| GET    | `/api/medicos`                       | Lista médicos                                         |
| POST   | `/api/medicos`                       | Cadastra novo médico                                  |
| PATCH  | `/api/medicos/:id/toggle`            | Ativa/desativa médico                                 |
| GET    | `/api/medicos/:id/slots`             | Slots disponíveis de um médico                        |
| GET    | `/api/encaixes`                      | Lista fila de encaixe                                 |
| POST   | `/api/encaixes`                      | Adiciona à fila de encaixe                            |
| GET    | `/api/atendimento/humano`            | Lista chats em atendimento humano                     |
| GET    | `/api/textos`                        | Lista textos/mensagens configuráveis                  |
| PUT    | `/api/textos`                        | Salva todos os textos em bulk                         |
| GET    | `/api/usuarios`                      | Lista usuários do sistema                             |
| GET    | `/api/whatsapp/status`               | Status da conexão WhatsApp                            |
| GET    | `/api/whatsapp/qr`                   | QR Code para conexão (base64)                         |
| GET    | `/api/stats`                         | Estatísticas gerais                                   |
| GET    | `/api/export`                        | Exporta agendamentos (Excel)                          |
| POST   | `/api/auth/login`                    | Login de usuário                                      |
| POST   | `/api/auth/change-password`          | Troca de senha própria                                |
| GET    | `/api/auth/users`                    | Lista usuários (admin)                                |
| POST   | `/api/auth/users`                    | Cria usuário (admin)                                  |
| PATCH  | `/api/auth/users/:id/toggle`         | Ativa/desativa usuário (admin)                        |
| POST   | `/api/auth/users/:id/reset-password` | Reset de senha (admin)                                |
| GET    | `/api/auth/me`                       | Dados do usuário logado                               |
