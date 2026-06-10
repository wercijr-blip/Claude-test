# 📖 Manual de Uso — Atos Saúde Bot

### Guia Completo de Funcionalidades — Painel v2

---

## 🗂️ ÍNDICE

1. [Visão Geral do Sistema](#visão-geral)
2. [Acesso ao Painel](#acesso-ao-painel)
3. [Níveis de Acesso](#níveis-de-acesso)
4. [Navegação no Painel v2](#navegação)
5. [Tab: Agenda](#tab-agenda)
6. [Tab: Marcação Manual](#tab-marcação-manual)
7. [Tab: Textos & Fluxos](#tab-textos-e-fluxos)
8. [Tab: Atendimento Humano](#tab-atendimento)
9. [Tab: Encaixe](#tab-encaixe)
10. [Tab: Exames](#tab-exames)
11. [Tab: Médicos](#tab-médicos)
12. [Tab: Usuários](#tab-usuários)
13. [Tab: WhatsApp](#tab-whatsapp)
14. [Tab: Medicações](#tab-medicações)
15. [Tab: Base de Conhecimento](#tab-conhecimento)
16. [Tab: Satisfação](#tab-satisfação)
17. [Tab: Conversas (Monitor)](#tab-conversas)
18. [Bot WhatsApp — Fluxos](#bot-whatsapp)
19. [Lembretes Automáticos](#lembretes)
20. [Pesquisa de Satisfação](#pesquisa-satisfação)
21. [Perguntas Frequentes](#faq)

---

## 🏥 Visão Geral

O sistema da Atos Saúde Integrada é composto por:

| Componente                 | Função                                                        |
| -------------------------- | ------------------------------------------------------------- |
| **Bot WhatsApp**           | Atende pacientes automaticamente 24h/7d                       |
| **Painel Web v2**          | Interface para secretaria, faturamento e administração        |
| **Monitor de Conversas**   | Visualização e resposta em tempo real para todas as conversas |
| **Evolution API v2**       | Integração com o WhatsApp (recebe e envia mensagens)          |
| **Google Calendar**        | Consultas salvas automaticamente na agenda dos médicos        |
| **IA de Convênios**        | Responde dúvidas sobre planos automaticamente                 |
| **Lembretes Automáticos**  | Mensagens enviadas 24h e 2h antes das consultas               |
| **Pesquisa de Satisfação** | Enviada 3 horas após cada consulta                            |
| **Envio de Exames**        | Paciente envia exame pelo WhatsApp para análise médica        |

---

## 🔐 Acesso ao Painel

**Endereço:** `http://IP_DO_SERVIDOR:3000/painel`

### Fazer Login:

1. Digite seu **usuário** e **senha**
2. Clique em **Entrar**

### Primeiro acesso:

Na primeira vez que cada usuário fizer login, o sistema **obriga** a troca de senha. Escolha uma senha com pelo menos 6 caracteres.

> ⚠️ Nunca compartilhe sua senha com outras pessoas. Cada funcionário deve ter seu próprio login.

---

_Seção 1/10 concluída. Continua em: Níveis de acesso e navegação_

---

## 👥 Níveis de Acesso

O sistema possui 3 níveis de acesso com permissões diferentes:

### 🔴 Administrador (`admin`)

Acesso total ao sistema:

- Ver e gerenciar agenda completa
- Fazer e cancelar marcações
- Bloquear agenda de médicos
- Exportar dados para Excel
- Cadastrar e editar médicos
- Editar textos do bot
- Gerenciar usuários
- Acessar e editar a base de conhecimento
- Ver conversas e responder pelo painel
- Ver exames enviados pelos pacientes

### 🔵 Secretaria (`secretaria`)

- Ver agenda completa
- Fazer marcações manuais e cancelar consultas
- Bloquear agenda de médicos
- Ver e responder conversas no monitor
- Ver exames enviados e baixar arquivos
- Ver medicações e satisfação
- Atender pacientes em modo humano
- **Não pode** exportar dados ou gerenciar usuários

### 🟢 Faturamento (`faturamento`)

- Ver agenda (somente visualização)
- Ver medicações e pesquisas de satisfação
- **Pode** exportar dados para Excel
- **Não pode** cancelar, bloquear, fazer marcações ou acessar conversas

---

## 🖥️ Navegação no Painel v2

O painel v2 tem um **menu lateral fixo** (sidebar) com todas as abas. Não é mais necessário navegar por menus separados.

### Estrutura do painel:

```
┌─────────────────┬────────────────────────────────────────┐
│                 │                                        │
│   LOGO ATOS     │         CONTEÚDO DA ABA SELECIONADA   │
│                 │                                        │
│  📅 Agenda      │                                        │
│  ➕ Marcação    │                                        │
│  ✍️ Textos      │                                        │
│  🩺 Atendimento │                                        │
│  ⚡ Encaixe     │                                        │
│  👨‍⚕️ Médicos    │                                        │
│  👥 Usuários    │                                        │
│  🩺 Exames      │                                        │
│  📱 WhatsApp    │                                        │
│  💊 Medicações  │                                        │
│  📚 Conheciment │                                        │
│  ⭐ Satisfação  │                                        │
│  💬 Conversas   │                                        │
│                 │                                        │
│  👤 Nome/Logout │                                        │
└─────────────────┴────────────────────────────────────────┘
```

### Badges de alerta no sidebar:

Algumas abas mostram um número vermelho indicando itens que precisam de atenção:

- **🩺 Atendimento** → quantidade de pacientes aguardando atendimento humano
- **⚡ Encaixe** → pacientes na fila de encaixe

### Cabeçalho superior:

No topo do painel você encontra:

- **🔔 Badge de alertas** (atendimentos aguardando)
- **🕐 Relógio** em tempo real
- **🔄 Botão de atualização** geral de todos os dados

---

_Seção 2/10 concluída. Continua em: Tab Agenda_

---

## 📅 Tab: Agenda

Esta é a tela principal. Exibe todos os agendamentos registrados no sistema.

### Filtros disponíveis:

| Filtro            | O que faz                                     |
| ----------------- | --------------------------------------------- |
| **Status**        | Filtra por PENDENTE, CONFIRMADO ou CANCELADO  |
| **Tipo**          | Filtra por CONSULTA, INFUSÃO ou MEDICAÇÃO     |
| **Especialidade** | Filtra por especialidade médica               |
| **Data**          | Mostra só agendamentos de uma data específica |

Para filtrar: preencha os campos desejados e clique em **🔍 Filtrar**. Para limpar os filtros, apague os campos e clique em Filtrar novamente.

### Colunas da tabela:

| Coluna            | O que mostra                          |
| ----------------- | ------------------------------------- |
| **#**             | Número do agendamento no sistema      |
| **Tipo**          | CONSULTA, INFUSÃO ou MEDICAÇÃO        |
| **Especialidade** | Ex: Infectologia, Reumatologia        |
| **Médico**        | Nome do médico responsável            |
| **Data/Hora**     | Data e horário da consulta            |
| **Tipo Atend.**   | CONVÊNIO ou PARTICULAR                |
| **Convênio**      | Nome do plano informado pelo paciente |
| **Nome**          | Nome do paciente                      |
| **Nascimento**    | Data de nascimento                    |
| **Telefone**      | Número de contato                     |
| **Status**        | PENDENTE, CONFIRMADO ou CANCELADO     |
| **Cadastrado**    | Quando o agendamento foi criado       |
| **Ações**         | Botões de confirmar e cancelar        |

### Confirmar uma consulta:

1. Localize a linha do paciente
2. Clique no botão **✅ Confirmar**
3. O status muda para CONFIRMADO

### Cancelar uma consulta:

1. Localize a linha do paciente
2. Clique no botão **✕ Cancelar**
3. Confirme na janela de diálogo
4. O sistema automaticamente:
   - Muda o status para CANCELADO no banco
   - Remove o evento do Google Calendar
   - Envia mensagem de cancelamento ao paciente pelo WhatsApp

### Bloquear Agenda (botão 🚫 Bloquear Agenda):

Permite bloquear a agenda de um médico em uma data específica, impedindo novos agendamentos.

**Quando usar:** Férias, congresso, doença, emergência.

**Como usar:**

1. Clique em **🚫 Bloquear Agenda**
2. Selecione o médico
3. Informe a data do bloqueio
4. Informe o motivo (ex: "Congresso Médico")
5. Clique em **Confirmar Bloqueio**

### Exportar dados (botão 📥 Exportar):

Gera um arquivo CSV com os agendamentos. Disponível apenas para Administrador e Faturamento.

Clique em **📥 Exportar** para baixar a planilha no computador com todos os dados da lista atual.

---

_Seção 3/10 concluída. Continua em: Marcação Manual e Textos & Fluxos_

---

## ➕ Tab: Marcação Manual

Permite à secretaria registrar um agendamento manualmente — por telefone, presencialmente ou por indicação.

### Passo a passo:

**1. Especialidade**
Selecione a especialidade médica (ex: Infectologia, Reumatologia).

**2. Médico**
Selecione o médico na lista.

**3. Data e horário**
Informe a data e o horário da consulta. O campo aceita data e hora juntos.

**4. Tipo de atendimento** _(obrigatório)_
Selecione **Convênio** ou **Particular**.
Se for convênio, informe o nome do plano no campo seguinte.

**5. Dados do paciente** _(todos obrigatórios)_

- Nome completo
- Data de nascimento (formato DD/MM/AAAA)
- Telefone de contato com DDD (ex: `61999999999`)

**6. Confirmar**
Clique em **✅ Confirmar Agendamento**.

Se tudo estiver correto:

- O agendamento aparece na aba Agenda
- Um evento é criado automaticamente no Google Calendar do médico
- O paciente recebe confirmação pelo WhatsApp (se tiver número cadastrado)

> 💡 Se o número de telefone informado for o WhatsApp do paciente, ele receberá lembretes automáticos 24h e 2h antes da consulta.

---

## ✍️ Tab: Textos & Fluxos

_Disponível apenas para Administrador._

Permite editar todas as mensagens que o bot envia pelo WhatsApp sem precisar de programador. As alterações entram em vigor em segundos.

### Botão "+ Novo Texto":

Clique em **+ Novo Texto** para adicionar uma nova mensagem personalizada ao sistema. Preencha:

- **Nome** → Identificador interno (ex: `mensagem_feriado`)
- **Conteúdo** → O texto que o bot vai enviar

### Mensagens existentes disponíveis para edição:

| Chave                         | Quando é enviada                                  |
| ----------------------------- | ------------------------------------------------- |
| `menu_boas_vindas`            | Menu inicial quando paciente envia "oi"           |
| `lembrete_24h`                | Lembrete 24 horas antes da consulta               |
| `lembrete_2h`                 | Lembrete 2 horas antes da consulta                |
| `pesquisa_pergunta`           | Pergunta da pesquisa de satisfação                |
| `cancelamento_individual`     | Notificação de cancelamento individual            |
| `cancelamento_bloqueio`       | Notificação de cancelamento em bloqueio de agenda |
| `confirmacao_marcacao_manual` | Confirmação de agendamento feito pela secretaria  |

### Variáveis disponíveis nos textos:

| Variável          | O que coloca no texto      |
| ----------------- | -------------------------- |
| `{nome}`          | Nome do paciente           |
| `{medico}`        | Nome do médico             |
| `{especialidade}` | Especialidade médica       |
| `{data}`          | Data no formato DD/MM/AAAA |
| `{hora}`          | Horário (ex: 14h30)        |
| `{diaSemana}`     | Nome do dia da semana      |

### Exemplo de texto com variáveis:

```
Olá, {nome}! 👋

Sua consulta com {medico} está confirmada para {diaSemana}, {data} às {hora}.

Qualquer dúvida: (61) 4042-7188
Atos Saúde Integrada 🏥
```

### Como editar:

1. Localize o texto desejado na lista
2. Clique no texto para editar
3. Faça a alteração
4. Clique em **💾 Salvar**

### Remover um texto:

Clique em **🗑️ Remover** na linha do texto. A remoção é permanente.

---

_Seção 4/10 concluída. Continua em: Atendimento, Encaixe e Exames_

---

## 🩺 Tab: Atendimento Humano

Exibe todos os pacientes que estão aguardando atendimento humano — ou seja, foram transferidos do bot para a equipe.

### Quando um paciente vai para atendimento humano:

- Escolheu a opção **"5 — Falar com atendente"** no menu
- Digitou a palavra **"atendente"** em qualquer momento da conversa
- A IA de convênios não conseguiu responder satisfatoriamente
- Recebeu resposta manual da secretaria pelo painel (modo humano ativado automaticamente)

### O badge vermelho no sidebar:

O número ao lado da aba 🩺 Atendimento indica quantos pacientes estão aguardando. **Prioridade alta** — verifique sempre que aparecer.

### Tabela de atendimento:

| Coluna             | O que mostra                             |
| ------------------ | ---------------------------------------- |
| **Telefone**       | Número do paciente                       |
| **Nome**           | Nome registrado na sessão                |
| **Aguardando há**  | Tempo desde a transferência para humano  |
| **Fluxo anterior** | De onde veio (MENU, FAQ, MEDICACAO etc.) |
| **Ações**          | Botões de assumir e encerrar             |

### Ações disponíveis:

**Assumir atendimento:** Marca o paciente como "em atendimento" e o remove da lista de espera. O operador deve então ir ao **Monitor de Conversas** (aba 💬) para responder.

**Encerrar atendimento:** Encerra o atendimento humano. O paciente pode iniciar um novo fluxo normalmente no bot.

> 💡 Para responder ao paciente diretamente, use o **Monitor de Conversas** (Tab 💬) — lá você pode enviar mensagens em tempo real.

---

## ⚡ Tab: Encaixe

Exibe a fila de pacientes que solicitaram **encaixe** — ou seja, querem ser avisados se surgir um horário mais cedo do que o agendado.

### Como funciona:

1. Paciente agenda uma consulta normalmente pelo bot
2. O bot pergunta se deseja entrar na lista de encaixe
3. Se aceitar, aparece na lista desta aba
4. Quando um horário se liberar, a secretaria notifica o paciente manualmente

### Tabela de encaixe:

| Coluna            | O que mostra                       |
| ----------------- | ---------------------------------- |
| **Nome**          | Nome do paciente                   |
| **Especialidade** | Especialidade desejada             |
| **Médico**        | Médico preferido (se especificado) |
| **Desde**         | Data/hora da solicitação           |

### Ações:

- **Notificar** → Marca o paciente como notificado (para não notificar duas vezes)
- **Remover** → Remove da fila de encaixe

---

## 🩺 Tab: Exames

Exibe todos os exames enviados pelos pacientes pelo WhatsApp para análise médica.

### Como funciona o fluxo de exames:

1. Paciente escolhe a opção **"4 — Enviar exame para análise médica"** no menu do bot
2. Bot solicita o nome do paciente
3. Bot pergunta o nome do médico que irá analisar
4. Bot instrui o paciente a enviar o arquivo (imagem ou PDF)
5. Paciente envia o arquivo no chat do WhatsApp
6. Sistema baixa e salva o arquivo automaticamente
7. Registro aparece nesta aba para a secretaria

### Tabela de exames:

| Coluna       | O que mostra                       |
| ------------ | ---------------------------------- |
| **#**        | Número do registro                 |
| **Paciente** | Nome informado pelo paciente       |
| **Médico**   | Nome do médico para análise        |
| **Tipo**     | Imagem, PDF ou PDF com legenda     |
| **Arquivo**  | Link para baixar o arquivo enviado |
| **Data**     | Data e hora do envio               |

### Baixar o exame:

Clique em **⬇ Baixar** na linha do exame para fazer o download do arquivo enviado pelo paciente.

> 💡 **Prioridade:** Esta aba não tem badge de urgência. Verifique-a periodicamente ou quando o médico solicitar.

> ⚠️ **Importante:** O paciente aguarda retorno do médico. Encaminhe o arquivo ao médico responsável o quanto antes.

---

_Seção 5/10 concluída. Continua em: Médicos e Usuários_

---

## 👨‍⚕️ Tab: Médicos

_Disponível apenas para Administrador._

Centraliza o cadastro e configuração de todos os médicos da clínica.

### Cadastrar Novo Médico:

Preencha o formulário:

- **Nome completo** → Ex: `Dr. João da Silva`
- **Especialidades** → Ex: `Infectologia, Reumatologia` (separadas por vírgula)
- **Google Calendar ID** → O ID do calendário do médico
  - Aparece nas configurações do Google Calendar
  - Formato: `nomeDoMedico@group.calendar.google.com`

Clique em **✅ Salvar**.

> 💡 O calendário do médico precisa estar compartilhado com a conta de serviço do Google para que os agendamentos sejam criados automaticamente.

### Tabela de médicos:

| Coluna             | O que mostra            |
| ------------------ | ----------------------- |
| **Nome**           | Nome completo do médico |
| **Especialidades** | Lista de especialidades |
| **Status**         | Ativo ou Inativo        |
| **Ações**          | Remover                 |

### Desativar/Ativar um Médico:

- **Desativar** → O médico não aparece mais nas opções do bot para novos agendamentos
- Consultas já agendadas **não são canceladas** ao desativar

---

## 👥 Tab: Usuários

_Disponível apenas para Administrador._

Gerencia os usuários que têm acesso ao painel.

### Adicionar Novo Usuário:

Preencha o formulário:

- **Nome completo** → Nome para exibição (ex: `Maria da Silva`)
- **Usuário (login)** → Nome de acesso sem espaços (ex: `maria.silva`)
- **Senha inicial** → Mínimo 6 caracteres. O usuário será obrigado a trocar no primeiro acesso
- **Perfil** → Secretaria, Faturamento ou Admin

Clique em **✅ Criar Usuário**.

### Tabela de usuários:

| Coluna     | O que mostra                     |
| ---------- | -------------------------------- |
| **Nome**   | Nome completo                    |
| **Login**  | Nome de acesso                   |
| **Função** | Admin, Secretaria ou Faturamento |
| **Status** | Ativo ou Inativo                 |
| **Ações**  | Bloquear/Ativar e Reset senha    |

### Ações por usuário:

**Bloquear:** Impede o login sem excluir o usuário. Útil quando um funcionário sai da clínica.

**Ativar:** Reativa um usuário bloqueado.

**Reset senha:** O administrador define uma nova senha temporária. O usuário precisará trocá-la no próximo login.

> ⚠️ Você não pode bloquear sua própria conta.

---

_Seção 6/10 concluída. Continua em: WhatsApp, Medicações e Conhecimento_

---

## 📱 Tab: WhatsApp

Exibe o status da conexão com o WhatsApp e permite reconectar quando necessário.

### Status de conexão:

| Indicador           | Significado                      |
| ------------------- | -------------------------------- |
| 🟢 **Conectado**    | Bot funcionando normalmente      |
| 🟡 **Conectando**   | Aguardando estabelecer conexão   |
| 🔴 **Desconectado** | Bot não está recebendo mensagens |

### Conectar ou reconectar o WhatsApp:

Quando o status estiver Desconectado:

1. Clique em **🔄 Gerar novo QR**
2. Um QR Code aparece na tela (atualiza automaticamente a cada 25 segundos)
3. No celular com o chip do bot:
   - Abra o WhatsApp
   - Toque em ⋮ → **Dispositivos conectados**
   - Toque em **Conectar um dispositivo**
   - Aponte a câmera para o QR Code
4. Após escanear, o painel atualiza e mostra **✅ Conectado**

> 💡 O QR Code expira em 60 segundos. Se expirar, clique em **🔄 Gerar novo QR** novamente.

### Quando o WhatsApp desconecta:

O WhatsApp pode desconectar por:

- Bateria do celular zerou
- Celular reiniciou
- WhatsApp atualizado no celular
- Celular ficou sem internet por muito tempo

**Solução:** Basta gerar novo QR e escanear novamente. Não é necessário reiniciar o bot.

---

## 💊 Tab: Medicações

Exibe todas as solicitações de medicação recebidas pelo bot.

Quando um paciente escolhe a opção de medicação no WhatsApp, o sistema registra aqui as informações para a equipe entrar em contato.

### Tabela de medicações:

| Coluna         | O que mostra                                  |
| -------------- | --------------------------------------------- |
| **Nome**       | Nome do paciente                              |
| **Telefone**   | Número de contato                             |
| **Nascimento** | Data de nascimento                            |
| **Convênio**   | Plano ou "Particular"                         |
| **Observação** | Informações adicionais deixadas pelo paciente |
| **Status**     | PENDENTE (padrão)                             |
| **Data**       | Quando a solicitação foi feita                |

> Esta aba é somente para visualização e acompanhamento. O contato com o paciente deve ser feito manualmente pela equipe.

---

## 📚 Tab: Base de Conhecimento

A IA de convênios do bot usa os documentos cadastrados aqui para responder automaticamente às dúvidas dos pacientes (ex: "Meu convênio é aceito?", "Precisa de autorização prévia?").

### Adicionar um novo documento:

1. Preencha o **título** do documento
2. Selecione a **categoria** (autorizacao, convenio ou geral)
3. Cole ou digite o **conteúdo** do documento na área de texto
4. Clique em **💾 Salvar**

O documento fica imediatamente disponível para a IA usar nas respostas.

### Tipos de documentos recomendados:

- Lista de convênios aceitos pela clínica
- Procedimentos que precisam ou não de autorização prévia
- Prazos máximos da ANS por tipo de procedimento
- Tabela de valores para particular
- Protocolos e orientações específicas da clínica

### Desativar um documento:

1. Localize o documento na tabela
2. Clique em **Remover**
3. O documento deixa de ser usado pela IA

> ⚠️ Mantenha os documentos atualizados. Informações desatualizadas geram respostas incorretas ao paciente.

---

_Seção 7/10 concluída. Continua em: Satisfação e Conversas_

---

## ⭐ Tab: Satisfação

Exibe os resultados da pesquisa de satisfação enviada automaticamente aos pacientes após as consultas.

### Cards de resumo no topo:

| Card                    | O que mostra                                |
| ----------------------- | ------------------------------------------- |
| **Nota média**          | Média geral de 1 a 5 de todas as avaliações |
| **Total de avaliações** | Quantidade de pesquisas respondidas         |
| **Nota ≥ 4**            | Quantidade de avaliações boas ou excelentes |

### Escala de notas:

| Nota | Classificação | Cor no painel |
| ---- | ------------- | ------------- |
| 5    | Excelente 🌟  | Verde         |
| 4    | Bom 😊        | Verde         |
| 3    | Regular 😐    | Amarelo       |
| 2    | Ruim 😕       | Vermelho      |
| 1    | Péssimo 😞    | Vermelho      |

### Tabela de avaliações:

| Coluna            | O que mostra                            |
| ----------------- | --------------------------------------- |
| **Telefone**      | Número do paciente                      |
| **Médico**        | Médico avaliado                         |
| **Especialidade** | Especialidade da consulta               |
| **Nota**          | Nota de 1 a 5                           |
| **Comentário**    | Texto deixado pelo paciente (se houver) |
| **Data**          | Data da avaliação                       |

---

## 💬 Tab: Conversas — Monitor em Tempo Real

O Monitor de Conversas é uma das funcionalidades mais importantes do painel v2. Ele exibe **todas as conversas** que estão ocorrendo pelo WhatsApp — em andamento ou recentes.

### Lista de conversas:

| Coluna              | O que mostra                                                 |
| ------------------- | ------------------------------------------------------------ |
| **Telefone**        | Número do paciente                                           |
| **Nome**            | Nome registrado na sessão                                    |
| **Última mensagem** | Texto da última mensagem (IN = paciente, ▶ OUT = bot/equipe) |
| **Fluxo**           | Etapa atual (MENU, CONSULTA, HUMANO etc.)                    |
| **Msgs**            | Total de mensagens trocadas                                  |
| **Quando**          | Data e hora da última mensagem                               |

### Abrir uma conversa:

Clique em qualquer linha da tabela para abrir o **chat completo** com o histórico de mensagens do paciente.

As mensagens são exibidas em formato de chat:

- **Bolha cinza/branca** → mensagem enviada pelo paciente
- **Bolha teal/verde** → mensagem enviada pelo bot ou pela equipe

### Responder ao paciente pelo painel:

Com o chat aberto, você pode **enviar mensagens diretamente ao paciente** sem sair do painel:

1. Digite a mensagem no campo de texto no rodapé do chat
2. Pressione **Enter** ou clique em **Enviar**
3. A mensagem é enviada imediatamente pelo WhatsApp

> ⚠️ **Importante:** Ao enviar uma resposta pelo painel, a sessão do paciente é automaticamente transferida para **atendimento humano**. O bot para de responder automaticamente. O paciente só voltará ao modo automático se digitar "oi" ou "menu".

### Quando usar o Monitor de Conversas:

- Verificar o andamento de uma conversa específica
- Responder pacientes em atendimento humano
- Acompanhar o status de um fluxo em andamento
- Verificar histórico de conversa de um paciente
- Resolver situações que o bot não conseguiu atender

### Identificar conversas que precisam de atenção:

Conversas com `Fluxo = HUMANO` na coluna de fluxo estão aguardando atendimento da equipe. Verifique-as prioritariamente junto com a aba **🩺 Atendimento**.

---

_Seção 8/10 concluída. Continua em: Bot WhatsApp — todos os fluxos_

---

## 🤖 Bot WhatsApp — Fluxos de Atendimento

Quando um paciente envia qualquer mensagem (como "oi", "olá", "bom dia"), o bot apresenta o menu principal:

```
🏥 Atos Saúde Integrada — Como posso ajudar?

1️⃣ Agendar consulta
2️⃣ Solicitar infusão ou medicação
3️⃣ Informações sobre convênios
4️⃣ Enviar exame para análise médica
5️⃣ Falar com atendente
```

### Fluxo 1 — Agendamento de Consulta:

```
Paciente escolhe "1"
        ↓
Escolhe a especialidade (Infectologia, Reumatologia, etc.)
        ↓
Escolhe preferência: horário mais cedo OU escolher médico
        ↓
Bot busca horários livres no Google Calendar
        ↓
Paciente escolhe um dos horários disponíveis
        ↓
Informa tipo: Convênio ou Particular
        ↓
Se Convênio: informa o nome do plano
        ↓
Informa nome completo, data de nascimento, telefone
        ↓
Bot confirma o agendamento com resumo completo
        ↓
Evento criado no Google Calendar ✅
Agendamento salvo no painel → aba Agenda ✅
```

### Fluxo 2 — Infusão ou Medicação:

```
Paciente escolhe "2"
        ↓
Escolhe tipo: Infusão ou Medicação
        ↓
Informa convênio ou particular
        ↓
Informa nome, nascimento, telefone
        ↓
Solicitação registrada no painel (aba Medicações)
Bot informa que a equipe entrará em contato
```

### Fluxo 3 — Informações sobre Convênios (IA):

```
Paciente escolhe "3"
        ↓
Digita a dúvida em linguagem natural
Ex: "Meu convênio GEAP é aceito?"
Ex: "Preciso de autorização para infusão?"
        ↓
IA (Claude) busca nos documentos da Base de Conhecimento
        ↓
Responde com base nas informações cadastradas
        ↓
Pergunta se a resposta ajudou (S/N)
        ↓
Se não ajudou: transfere para atendimento humano
```

### Fluxo 4 — Envio de Exame para Análise Médica: _(novo)_

```
Paciente escolhe "4"
        ↓
Bot solicita o nome completo do paciente
        ↓
Bot pergunta o nome do médico que irá analisar
        ↓
Bot instrui: "Envie agora o exame como imagem ou PDF"
        ↓
Paciente envia o arquivo
        ↓
Sistema baixa e salva o arquivo automaticamente
        ↓
Bot agradece e informa sobre o retorno do médico
        ↓
Registro aparece no painel → aba Exames ✅
```

### Fluxo 5 — Falar com Atendente:

```
Paciente escolhe "5"
        ↓
Bot informa que um atendente irá responder em breve
Sessão transferida para HUMANO
        ↓
Aparece na aba Atendimento do painel
Equipe pode responder pelo Monitor de Conversas
```

### Palavras de reinício:

A qualquer momento, o paciente pode digitar uma das palavras abaixo para voltar ao menu principal:

- `oi`, `olá`, `ola`, `menu`, `início`, `inicio`, `cancelar`, `restart`, `voltar`

### Palavra especial:

- **`atendente`** → transfere imediatamente para atendimento humano de qualquer etapa do fluxo

---

_Seção 9/10 concluída. Continua em: Lembretes, Pesquisa e FAQ_

---

## ⏰ Lembretes Automáticos

O sistema envia lembretes automáticos para pacientes que possuem número de WhatsApp cadastrado.

### Lembrete 24 horas antes:

Enviado automaticamente 24h antes do horário da consulta.

**Exemplo de mensagem:**

```
Olá, Maria! 👋

Lembramos que você tem consulta amanhã:
👨‍⚕️ Dr. Werciley Júnior
🩺 Infectologia
📅 Segunda-feira, 28/04/2025 às 09h30

Em caso de imprevistos: (61) 4042-7188
Atos Saúde Integrada 🏥
```

### Lembrete 2 horas antes:

Enviado automaticamente 2h antes do horário da consulta.

**Exemplo de mensagem:**

```
⏰ Sua consulta é em breve!

👨‍⚕️ Dr. Werciley Júnior — Infectologia
📅 Hoje às 09h30

Já confirme seu deslocamento. Até logo! 🏥
```

### Como funciona:

- O sistema verifica os agendamentos a cada 15 minutos
- Cada lembrete é enviado **apenas uma vez** (não envia duplicado)
- Só funciona para agendamentos com status CONFIRMADO ou PENDENTE
- Agendamentos CANCELADOS não recebem lembrete

---

## 📊 Pesquisa de Satisfação Automática

3 horas após o horário de uma consulta, o bot envia automaticamente uma pesquisa de satisfação.

### Como funciona:

**Passo 1 — Pergunta da nota:**

```
Olá, Maria! 😊

Como foi sua consulta hoje na Atos Saúde?
De 1 a 5, qual nota você daria?

1️⃣ 😞 Péssimo
2️⃣ 😕 Ruim
3️⃣ 😐 Regular
4️⃣ 😊 Bom
5️⃣ 🌟 Excelente
```

**Passo 2 — Pedido de comentário:**

- Nota ≥ 4: "Que ótimo! Quer deixar um comentário sobre o que foi bom?"
- Nota ≤ 3: "Sentimos muito. Pode nos contar o que podemos melhorar?"
- O paciente pode responder ou digitar `0` para pular

**Passo 3 — Agradecimento:**

- Resposta salva na aba Satisfação do painel
- Bot agradece e encerra a pesquisa

> A pesquisa só é disparada para agendamentos do tipo CONSULTA.

---

## ❓ Perguntas Frequentes

### Por que o bot não está respondendo?

1. Verifique a aba **📱 WhatsApp** — o status deve ser **Conectado**
2. Se estiver desconectado, gere um novo QR e escaneie
3. Se o status estiver conectado mas o bot não responde, verifique os logs:
   ```bash
   pm2 logs atos-saude-bot --lines 30
   ```

### Como ver o histórico de conversa de um paciente?

Acesse a aba **💬 Conversas**, localize o número na lista e clique na linha para abrir o chat completo.

### O paciente está aguardando atendimento. Como responder?

1. Acesse a aba **💬 Conversas**
2. Localize o paciente (coluna Fluxo = `HUMANO`)
3. Clique na linha para abrir o chat
4. Digite a mensagem e clique em **Enviar**

### Como adicionar um novo médico?

Acesse a aba **👨‍⚕️ Médicos**, preencha o formulário com nome, especialidades e ID do Google Calendar, e clique em Salvar.

### Como atualizar um texto do bot?

Acesse a aba **✍️ Textos & Fluxos**, localize o texto, edite e clique em Salvar. A alteração entra em vigor em segundos.

### Um lembrete não foi enviado. O que pode ter acontecido?

- O agendamento não tem número de WhatsApp cadastrado
- O agendamento estava como CANCELADO
- O bot estava offline no momento do envio
- O WhatsApp do paciente estava sem internet

### Como fazer backup do banco de dados?

```bash
cp /opt/atos-saude-bot/atos-saude.db /opt/backups/atos-saude-$(date +%Y%m%d).db
```

### O que fazer se o servidor reiniciar?

O PM2 reinicia o bot automaticamente. A Evolution API precisa que o Docker seja iniciado:

```bash
cd /opt/evolution && docker compose up -d
```

Se configurou `pm2 startup` e `pm2 save` na instalação, o bot volta sozinho junto com a Evolution API se o Docker também estiver configurado para iniciar automaticamente.

### Como devolcer o bot ao controle automático após atendimento humano?

Quando um paciente está em modo HUMANO, ele voltará ao fluxo automático quando digitar qualquer palavra de reinício: `oi`, `menu`, `olá`, `inicio`.

---

## 📞 Suporte Técnico

Para dúvidas técnicas sobre o sistema, tenha em mãos:

```bash
pm2 logs atos-saude-bot --lines 100
node --version
pm2 --version
docker compose -f /opt/evolution/docker-compose.yml ps
```

Informe: o que aconteceu, quando aconteceu e a mensagem de erro exata que apareceu no log.
