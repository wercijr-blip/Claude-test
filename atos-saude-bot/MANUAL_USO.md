# 📖 Manual de Uso — Atos Saúde Bot
### Guia Completo de Funcionalidades

---

## 🗂️ ÍNDICE

1. [Visão Geral do Sistema](#visão-geral)
2. [Acesso ao Painel](#acesso-ao-painel)
3. [Níveis de Acesso](#níveis-de-acesso)
4. [Tab: Agenda](#tab-agenda)
5. [Tab: Nova Marcação](#tab-nova-marcação)
6. [Tab: Médicos e Agendas](#tab-médicos-e-agendas)
7. [Tab: Medicações](#tab-medicações)
8. [Tab: Satisfação](#tab-satisfação)
9. [Tab: Base de Conhecimento](#tab-base-de-conhecimento)
10. [Tab: Editar Textos do Bot](#tab-editar-textos-do-bot)
11. [Tab: Usuários](#tab-usuários)
12. [Bot WhatsApp — Fluxos de Atendimento](#bot-whatsapp)
13. [Lembretes Automáticos](#lembretes-automáticos)
14. [Pesquisa de Satisfação Automática](#pesquisa-de-satisfação-automática)
15. [Exportação de Dados para Excel](#exportação-de-dados)
16. [Perguntas Frequentes](#perguntas-frequentes)

---

## 🏥 Visão Geral

O sistema da Atos Saúde Integrada é composto por:

1. **Bot WhatsApp** — Atende pacientes automaticamente 24/7
2. **Painel Web** — Interface para secretaria, faturamento e administração
3. **Integração Google Calendar** — Consultas salvas automaticamente na agenda dos médicos
4. **IA de Convênios** — Responde dúvidas sobre planos automaticamente
5. **Lembretes Automáticos** — Mensagens enviadas 24h e 2h antes das consultas
6. **Pesquisa de Satisfação** — Enviada 3 horas após cada consulta

---

## 🔐 Acesso ao Painel

**Endereço:** `http://IP_DO_SERVIDOR:3000/painel`

### Fazer Login:
1. Digite seu **usuário** e **senha**
2. Clique em **Entrar**

### Primeiro acesso (senhas padrão):
Na primeira vez que cada usuário entrar, o sistema **obriga** a troca de senha por segurança.

> ⚠️ Nunca compartilhe sua senha com outras pessoas. Cada funcionário deve ter seu próprio login.

---

## 👥 Níveis de Acesso

O sistema possui 3 níveis de acesso com permissões diferentes:

### 🔴 Administrador (`admin`)
Acesso total ao sistema:
- Ver agenda, medicações, satisfação
- Marcar e cancelar consultas
- Bloquear agenda de médicos
- Exportar dados para Excel
- Cadastrar e configurar médicos
- Editar textos do bot
- Gerenciar usuários
- Acessar base de conhecimento

### 🔵 Secretaria (`secretaria`)
- Ver agenda completa
- Fazer marcações manuais
- Cancelar consultas
- Bloquear agenda de médicos
- Ver medicações e pesquisas de satisfação
- **Não pode** exportar dados ou gerenciar usuários

### 🟢 Faturamento (`faturamento`)
- Ver agenda (consulta somente)
- Ver medicações
- Ver pesquisas de satisfação
- **Pode** exportar dados para Excel
- **Não pode** cancelar, bloquear ou fazer marcações

---

## 📋 Tab: Agenda

Esta é a tela principal. Exibe todos os agendamentos registrados no sistema.

### Filtros disponíveis:
| Filtro | O que faz |
|---|---|
| **Tipo** | Filtra por CONSULTA, INFUSÃO ou MEDICAÇÃO |
| **Especialidade** | Filtra por especialidade médica |
| **Data** | Mostra só agendamentos de uma data específica |
| **Status** | Filtra por PENDENTE, CONFIRMADO ou CANCELADO |

### Cores das linhas:
- **Laranja claro** → Atendimento particular (sem convênio)
- **Roxo claro** → Infusão
- **Verde claro** → Medicação
- **Branco** → Consulta normal com convênio

### Colunas da tabela:
- **#** → Número do agendamento no sistema
- **Tipo** → CONSULTA, INFUSÃO ou MEDICAÇÃO
- **Especialidade** → Ex: Infectologia, Reumatologia
- **Médico** → Nome do médico responsável
- **Data/Hora** → Data e horário da consulta
- **Plano/Tipo** → CONVENIO ou PARTICULAR
- **Convênio** → Nome do plano informado pelo paciente
- **Nome** → Nome do paciente
- **Nascimento** → Data de nascimento
- **Telefone** → Número de contato
- **Status** → Estado atual do agendamento
- **Cadastrado** → Quando o agendamento foi criado
- **Ação** → Botão para cancelar (se permitido para seu perfil)

### Cancelar uma consulta:
1. Localize a linha do paciente
2. Clique no botão vermelho **✕ Cancelar**
3. Confirme na janela de diálogo
4. O sistema automaticamente:
   - Muda o status para CANCELADO no banco
   - Remove o evento do Google Calendar
   - Envia mensagem de cancelamento ao paciente pelo WhatsApp

### Bloquear Agenda (botão 🚫 Bloquear Agenda):
Permite cancelar **todas** as consultas de um médico em um período e bloquear novas marcações.

**Quando usar:** Férias do médico, congresso, doença, emergência.

**Como usar:**
1. Clique em **🚫 Bloquear Agenda**
2. Selecione o médico
3. Informe data/hora de início e fim do período
4. Informe o motivo (ex: "Congresso Médico", "Férias")
5. Clique em **Confirmar Bloqueio**

O sistema irá:
- Cancelar todas as consultas do médico naquele período
- Notificar cada paciente pelo WhatsApp com o motivo
- Criar um evento de bloqueio no Google Calendar (impede novos agendamentos)

### Exportar dados (botão 📥 Exportar):
- **Exportar Pendentes:** Baixa planilha Excel com agendamentos ainda não exportados
- **Exportar Todos:** Baixa planilha com todos os agendamentos

> A exportação fica disponível apenas para Administrador e Faturamento.

---

## 📝 Tab: Nova Marcação

Permite à secretaria registrar um agendamento manualmente (por telefone, presencialmente ou indicação).

### Passo a passo:

**1. Selecionar o Médico**
- Escolha o médico na lista suspensa

**2. Selecionar a Data**
- Informe a data desejada e clique em 🔍 para buscar horários disponíveis
- O sistema consulta o Google Calendar em tempo real e mostra apenas os horários livres

**3. Escolher o Horário**
- Clique no botão com o horário desejado (ex: `08h00`, `09h30`)
- O horário selecionado fica destacado em azul escuro

**4. Tipo de Atendimento** *(obrigatório)*
- Clique em **🏥 Convênio** ou **💳 Particular**
- Se for Convênio, informe o nome do plano (ex: `CAIXA SAÚDE`, `GEAP`)

**5. Dados do Paciente** *(todos obrigatórios)*
- Nome completo
- Data de nascimento (formato DD/MM/AAAA)
- Telefone de contato com DDD (ex: `61999999999`)

**6. WhatsApp para lembretes** *(opcional)*
- Se preenchido, o paciente receberá automaticamente:
  - Lembrete 24 horas antes da consulta
  - Lembrete 2 horas antes
  - Pesquisa de satisfação 3 horas após

**7. Confirmar Agendamento**
- Clique em **✅ Confirmar Agendamento**
- Se tudo estiver correto, aparece a mensagem de sucesso com o número do agendamento

> 💡 Todo agendamento manual cria automaticamente um evento no Google Calendar do médico.

---

## 👨‍⚕️ Tab: Médicos e Agendas

*Disponível apenas para Administrador.*

Esta tela centraliza o cadastro e configuração de todos os médicos da clínica.

### Cadastrar Novo Médico:

Preencha o formulário à esquerda:
- **Nome completo** → Ex: `Dr. João da Silva`
- **CRM** → Ex: `CRM 12.345-DF`
- **Especialidade** → Ex: `Infectologia`
- **Celular/WhatsApp (com DDI)** → Ex: `5561999999999`
  - O DDI do Brasil é `55`
  - Inclua DDD + número (ex: `61` para Brasília)
  - Formato completo: `5561999999999`
- **Duração da consulta** → 15, 20, 30, 40, 45 ou 60 minutos
- **Google Calendar ID** → O ID do calendário do médico (obtido nas configurações do Google Calendar)
  - Parece com: `nomeDoMedico@group.calendar.google.com`

Clique em **✅ Cadastrar Médico**.

### Horário Padrão da Clínica:

No formulário à direita, configure o horário que vale para todos os médicos que **não têm agenda individual**:
- **Dias da semana** → marque quais dias a clínica atende
- **Horário início / fim** → ex: `07:00` a `19:00`
- **Sábados** → ative se a clínica atende aos sábados e configure o horário

Clique em **💾 Salvar Horário Padrão**.

### Editar um Médico:

Na tabela de médicos, clique em **✏️ Editar** na linha do médico.
Modifique os dados que precisar e clique em **💾 Salvar**.

### Configurar Agenda Individual de um Médico:

Se um médico tem horários diferentes da clínica (ex: só atende 3 dias por semana), configure sua agenda individual:

1. Na linha do médico, clique em **📅 Agenda**
2. Marque os **dias da semana** que ele atende
3. Informe o **horário de início e fim**
4. Selecione a **duração de cada consulta**
5. Marque a opção **"Usar esta agenda individual"**
6. Clique em **💾 Salvar Agenda**

> Se a opção "Usar esta agenda individual" estiver desmarcada, o sistema usa o horário padrão da clínica.

### Desativar/Ativar um Médico:
- Clique em **🔒 Desativar** para retirar o médico de novas marcações (ele não aparece mais nas opções do bot)
- Clique em **🔓 Ativar** para reativar

> Desativar um médico não cancela as consultas já agendadas.

---

## 💊 Tab: Medicações

Exibe todas as **solicitações de medicação** recebidas pelo bot.

Quando um paciente escolhe a opção de medicação no WhatsApp, o sistema registra aqui as informações para a equipe entrar em contato.

**Dados exibidos:**
- # → Número da solicitação
- Nome do paciente
- Telefone de contato
- Convênio ou Particular
- Status (sempre PENDENTE — é para acompanhamento interno)
- Data da solicitação

> Não há ação automática nessa tela — é apenas para visualização e contato manual pela equipe.

---

## ⭐ Tab: Satisfação

Exibe os resultados da pesquisa de satisfação enviada automaticamente aos pacientes após as consultas.

### Resumo no topo:
- **Média geral** → Nota média de 1 a 5 (com emoji)
- **Total de respostas** → Quantas pesquisas foram respondidas
- **Excelente (5⭐)**, **Bom (4⭐)**, **Ruim/Péssimo (1-2⭐)**

### Escala de notas:
| Nota | Emoji | Classificação |
|---|---|---|
| 5 | 🌟 | Excelente |
| 4 | 😊 | Bom |
| 3 | 😐 | Regular |
| 2 | 😕 | Ruim |
| 1 | 😞 | Péssimo |

### Tabela de respostas:
Exibe cada avaliação com:
- Nota dada pelo paciente
- Médico avaliado
- Especialidade
- Comentário deixado (se houver)
- Data da avaliação

### Cores das linhas:
- **Verde** → Notas 4 e 5 (bom e excelente)
- **Vermelho** → Notas 1 e 2 (ruim e péssimo)
- **Branco** → Nota 3 (regular)

---

## 📚 Tab: Base de Conhecimento

A **IA de convênios** do bot usa documentos cadastrados aqui para responder dúvidas dos pacientes (como: "Meu convênio é aceito?", "Precisa de autorização prévia?").

### Documentos iniciais do sistema (já cadastrados automaticamente):
- **convenios_aceitos.txt** → Lista de convênios aceitos pela clínica
- **documentos_autorizacao.txt** → Documentos necessários para autorização
- **prazos_ans.txt** → Prazos máximos conforme a ANS
- **sem_autorizacao.txt** → Procedimentos que precisam ou não de autorização prévia
- **valores_particular.txt** → Tabela de valores para atendimento particular

### Adicionar um novo documento:

Você pode adicionar documentos com informações sobre:
- Novos convênios aceitos
- Procedimentos específicos
- Tabelas de valores atualizadas
- Protocolos da clínica
- Qualquer outra informação relevante

**Como fazer:**
1. Prepare seu documento (formatos aceitos: `.pdf`, `.docx`, `.txt` — máx. 10MB)
2. Arraste o arquivo para a área pontilhada **OU** clique na área e selecione o arquivo
3. Aguarde a mensagem de confirmação: `✅ "nome_arquivo" indexado com sucesso!`

### Desativar um documento:
1. Localize o documento na tabela
2. Clique em **Desativar**
3. O documento deixa de ser usado pela IA nas respostas

> A IA busca nos documentos ativos para responder as perguntas. Mantenha os documentos atualizados para respostas mais precisas.

---

## ✏️ Tab: Editar Textos do Bot

*Disponível apenas para Administrador.*

Permite editar **todas as mensagens que o bot envia** pelo WhatsApp, sem precisar de programador ou reiniciar o sistema. As alterações entram em vigor em até 5 segundos.

### Mensagens disponíveis para edição:

| Chave | Quando é enviada |
|---|---|
| `menu_boas_vindas` | Menu inicial quando paciente envia "oi" |
| `lembrete_24h` | Lembrete 24 horas antes da consulta |
| `lembrete_2h` | Lembrete 2 horas antes da consulta |
| `agenda_medico_cabecalho` | Início da agenda diária enviada ao médico |
| `agenda_medico_rodape` | Rodapé da agenda diária do médico |
| `agenda_medico_vazia` | Quando o médico não tem consultas no dia seguinte |
| `pesquisa_pergunta` | Pergunta da pesquisa de satisfação |
| `pesquisa_positiva_comentario` | Após nota 4 ou 5 — pede comentário |
| `pesquisa_negativa_comentario` | Após nota 1, 2 ou 3 — pede comentário |
| `pesquisa_agradecimento_positivo` | Mensagem final para avaliações positivas |
| `pesquisa_agradecimento_negativo` | Mensagem final para avaliações negativas |
| `cancelamento_individual` | Notificação de cancelamento individual |
| `cancelamento_bloqueio` | Notificação de cancelamento em bloqueio de agenda |
| `confirmacao_marcacao_manual` | Confirmação de agendamento feito pela secretaria |

### Variáveis disponíveis:
Dentro dos textos, você pode usar essas variáveis que são substituídas automaticamente:

| Variável | O que ela coloca no texto |
|---|---|
| `{nome}` | Nome do paciente |
| `{medico}` | Nome do médico |
| `{especialidade}` | Especialidade médica |
| `{data}` | Data no formato DD/MM/AAAA |
| `{hora}` | Horário no formato HHhMM (ex: 14h30) |
| `{diaSemana}` | Nome do dia da semana (ex: Segunda-feira) |

### Exemplo de texto com variáveis:
```
Olá, {nome}! 👋

Lembramos que você tem consulta amanhã:
👨‍⚕️ {medico}
📅 {diaSemana}, {data} às {hora}

Em caso de dúvidas: (61) 4042-7188
```

### Como editar:
1. Encontre a mensagem que quer alterar (identificada pela chave em cinza)
2. Edite o texto diretamente na caixa
3. As caixas com **fundo laranja** indicam que o texto foi modificado mas ainda não salvo
4. Clique em **💾 Salvar Alterações** (no topo ou no rodapé da página)
5. Aparece **✅ Salvo!** quando a alteração for aplicada

---

## 👥 Tab: Usuários

*Disponível apenas para Administrador.*

Gerencia os usuários que têm acesso ao painel.

### Adicionar Novo Usuário:

Preencha o formulário:
- **Nome completo** → Nome para exibição (ex: `Maria da Silva`)
- **Usuário (login)** → Nome de acesso (sem espaços, ex: `maria.silva`)
- **Senha inicial** → Mínimo 6 caracteres. O usuário será obrigado a trocar no primeiro acesso
- **Perfil** → Secretaria, Faturamento ou Admin

Clique em **✅ Criar Usuário**.

### Lista de Usuários:

A tabela mostra todos os usuários com:
- ID, Nome, Login, Perfil e Status (Ativo/Inativo)

### Ações por usuário:

**🔒 Desativar:** Bloqueia o acesso do usuário sem excluí-lo.
Útil quando um funcionário sai da clínica — ele não consegue mais entrar.

**🔓 Ativar:** Reativa um usuário que estava inativo.

**🔑 Resetar senha:** Define uma nova senha temporária para o usuário.
O usuário precisará trocar a senha no próximo login.

> Você não pode desativar sua própria conta.

---

## 🤖 Bot WhatsApp — Fluxos de Atendimento

Quando um paciente envia qualquer mensagem (como "oi", "olá", "bom dia"), o bot apresenta o menu principal:

```
🏥 Olá! Bem-vindo à Atos Saúde Integrada.
Como posso ajudar?

1️⃣ Agendar consulta
2️⃣ Solicitar infusão/medicação
3️⃣ Informações sobre convênios
4️⃣ Falar com atendente
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
Paciente escolhe um dos 3 horários disponíveis
       ↓
Informa tipo de atendimento: Convênio ou Particular
       ↓
Se Convênio: informa o nome do plano
Se Particular: bot informa os valores
       ↓
Informa nome completo, data de nascimento, telefone
       ↓
Bot confirma o agendamento com resumo completo
       ↓
Evento criado automaticamente no Google Calendar
Agendamento salvo no banco de dados
```

### Fluxo 2 — Infusão/Medicação:

```
Paciente escolhe "2"
       ↓
Escolhe tipo: Infusão ou Medicação
       ↓
Informa convênio ou particular
       ↓
Informa nome, nascimento, telefone
       ↓
Solicitação registrada no painel (tab Medicações)
Bot informa que a equipe entrará em contato
```

### Fluxo 3 — FAQ de Convênios (IA):

```
Paciente escolhe "3"
       ↓
Digita a dúvida em linguagem natural
Ex: "Meu convênio GEAP é aceito?"
Ex: "Preciso de autorização para infusão?"
       ↓
IA (Claude) busca nos documentos cadastrados
       ↓
Responde com base nas informações da base de conhecimento
       ↓
Pergunta se a resposta ajudou (S/N)
       ↓
Se não ajudou: transfere para atendimento humano
```

### Fluxo 4 — Atendente:

```
Paciente escolhe "4"
       ↓
Bot envia mensagem de aguardo
Sessão é encerrada (paciente fica livre para falar normalmente)
```

### Palavras de reinício:

A qualquer momento, o paciente pode digitar uma das palavras abaixo para voltar ao menu principal:
- `oi`, `olá`, `ola`, `menu`, `início`, `inicio`, `cancelar`, `restart`, `voltar`

---

## ⏰ Lembretes Automáticos

O sistema envia lembretes automáticos para pacientes que tiverem um número de WhatsApp cadastrado.

### Lembrete 24 horas antes:

**Quando é enviado:** Entre 10 minutos antes e 10 minutos depois da marca de 24h antes da consulta.

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

**Quando é enviado:** 2 horas antes da consulta (com janela de ±10 minutos).

**Exemplo de mensagem:**
```
⏰ Sua consulta é em breve!

👨‍⚕️ Dr. Werciley Júnior — Infectologia
📅 Hoje às 09h30

Já confirme seu deslocamento. Até logo! 🏥
```

### Como funciona tecnicamente:
O sistema verifica os agendamentos a cada 15 minutos. Cada lembrete só é enviado uma vez (o sistema registra que já enviou).

---

## 📊 Pesquisa de Satisfação Automática

**3 horas após** o horário de uma consulta, o bot envia automaticamente uma pesquisa de satisfação ao paciente.

### Como funciona:

**Passo 1 — Pergunta da nota:**
```
Olá, Maria! 😊

Gostaríamos de saber como foi sua consulta hoje na Atos Saúde.
De 1 a 5, qual nota você daria?

1️⃣ 😞 Péssimo
2️⃣ 😕 Ruim
3️⃣ 😐 Regular
4️⃣ 😊 Bom
5️⃣ 🌟 Excelente
```

**Passo 2 — Pedido de comentário:**
- Se nota ≥ 4: "Que ótimo! Quer deixar um comentário sobre o que foi bom?"
- Se nota ≤ 3: "Sentimos muito. Pode nos contar o que podemos melhorar?"
- O paciente pode responder ou digitar `0` para pular

**Passo 3 — Agradecimento:**
- A resposta é salva na tab Satisfação do painel
- O bot agradece e encerra a pesquisa

> A pesquisa só é disparada para agendamentos do tipo CONSULTA com WhatsApp cadastrado.

---

## 📤 Exportação de Dados para Excel

Disponível para Administrador e Faturamento.

### Como exportar:

Na tab **Agenda**, no canto superior direito:
- **📥 Exportar Pendentes** → Exporta somente os agendamentos que nunca foram exportados antes. Após a exportação, eles são marcados como "exportados".
- **📋 Exportar Todos** → Exporta todo o histórico, independente de já ter sido exportado.

### Conteúdo da planilha Excel:
A planilha gerada contém colunas coloridas com:
- ID, Tipo, Especialidade, Médico
- Data/Hora da Consulta
- Nome do Paciente, Nascimento, Telefone
- Tipo de Atendimento, Convênio
- Status, Data de Cadastro

> O arquivo é baixado automaticamente no seu computador com o nome `agendamentos.xlsx`.

---

## ❓ Perguntas Frequentes

### Por que o bot não está respondendo?
Verifique:
1. Se o servidor está ligado (`pm2 status` deve mostrar `online`)
2. Se o WhatsApp ainda está conectado na Evolution API
3. Se o webhook está configurado corretamente

### O Google Calendar não está sendo atualizado. O que fazer?
1. Verifique se o ID do Calendar do médico está correto no cadastro
2. Verifique se o calendário foi compartilhado com o e-mail da conta de serviço
3. Verifique se o arquivo `google-service-account.json` existe no caminho configurado

### O lembrete não foi enviado. O que aconteceu?
Possíveis causas:
- O agendamento não tem número de WhatsApp cadastrado
- O agendamento foi marcado como CANCELADO
- O WhatsApp do paciente está desconectado ou bloqueou o número da clínica
- O bot estava fora do ar no momento do envio (janela de ±10 minutos)

### Como atualizar um texto do bot?
Vá na tab **✏️ Editar Textos**, edite a mensagem e clique em **💾 Salvar**. A alteração vale em menos de 5 segundos, sem precisar reiniciar nada.

### Como adicionar um novo médico?
Vá na tab **👨‍⚕️ Médicos**, preencha o formulário e clique em **✅ Cadastrar Médico**. Lembre-se de colocar o ID do Google Calendar correto para as funcionalidades de agenda funcionarem.

### Um paciente reclamou que recebeu o lembrete duplicado. Por quê?
Isso não deve ocorrer — o sistema tem controle de envio único por lembrete. Se ocorreu, pode ser que o agendamento foi recriado com um novo ID após cancelamento.

### Como ver os logs do sistema?
No servidor, execute:
```bash
pm2 logs atos-saude-bot
```

### Como fazer backup do banco de dados?
```bash
cp /opt/atos-saude-bot/atos-saude.db /backup/atos-saude-$(date +%Y%m%d).db
```

### O que fazer se o servidor reiniciar?
O PM2 reinicia o bot automaticamente. A Evolution API precisa que o Docker seja iniciado:
```bash
cd /opt/evolution && docker compose up -d
```
Se configurou `pm2 startup` e `pm2 save` na instalação, o bot volta sozinho.

---

## 📞 Contatos e Suporte

Para dúvidas técnicas sobre o sistema, tenha em mãos:
- Logs do sistema: `pm2 logs atos-saude-bot --lines 100`
- Versão do Node.js: `node --version`
- Status dos serviços: `pm2 status` e `docker ps`
