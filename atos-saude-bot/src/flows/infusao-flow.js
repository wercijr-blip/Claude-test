import { sendText } from '../services/whatsapp.js'
import { upsertSession, clearSession, getSession, insertAgendamento } from '../services/db.js'
import { isValidName, isValidDate, isValidPhone, checkConvenio } from '../utils/validators.js'

async function transferirHumano(phone, msg) {
  if (msg) await sendText(phone, msg)
  await upsertSession(phone, {
    flow: 'HUMANO',
    step: 'AGUARDANDO_HUMANO',
    human_transfer_at: new Date().toISOString()
  })
}

export async function run(phone, text, session) {
  const step = session?.step || 'START'

  switch (step) {
    case 'START': {
      await sendText(phone,
        '🏥 *Infusão — Hospital Dia Atos Saúde*\n\n' +
        'Você possui convênio que cobre o procedimento?\n\n' +
        '1️⃣ Sim, tenho convênio\n' +
        '2️⃣ Atendimento particular'
      )
      await upsertSession(phone, { flow: 'INFUSAO', step: 'AGUARDANDO_TIPO' })
      break
    }

    case 'AGUARDANDO_TIPO': {
      if (text.trim() === '1') {
        await sendText(phone, 'Qual o nome do seu convênio?')
        await upsertSession(phone, { step: 'RECEBENDO_CONVENIO_INF' })
      } else if (text.trim() === '2') {
        await transferirHumano(phone,
          '💛 *Infusão Particular — Hospital Dia*\n\n' +
          'Temos disponibilidade para procedimentos particulares!\n\n' +
          'Nossa equipe informará valores e disponibilidade com *prioridade*. 🌟\n\n' +
          '👩‍⚕️ Transferindo para atendimento prioritário…'
        )
      } else {
        await sendText(phone, 'Escolha *1* (convênio) ou *2* (particular).')
      }
      break
    }

    case 'RECEBENDO_CONVENIO_INF': {
      if (checkConvenio(text)) {
        await sendText(phone,
          `✅ Atendemos o *${text.trim()}*!\n\n` +
          'Para infusão via convênio, tenha em mãos:\n' +
          '📋 Pedido médico com nome do medicamento e CID\n' +
          '💳 Carteirinha do plano\n' +
          '📄 Guia de autorização (se já tiver)\n\n' +
          'Vou registrar sua solicitação. 😊'
        )
        await upsertSession(phone, { tipo_atendimento: 'CONVENIO', convenio_informado: text.trim(), step: 'RECEBENDO_NOME_INF', tentativas: 0 })
        await sendText(phone, 'Por favor, seu *nome completo*:')
      } else {
        await transferirHumano(phone,
          `Infelizmente não trabalhamos com o *${text.trim()}* para infusões. 😕\n\n` +
          '💛 Mas temos *atendimento particular* disponível!\n\n' +
          'Nossa equipe informará os valores com *prioridade*. 🌟\n\n' +
          '👩‍⚕️ Transferindo para atendimento prioritário…'
        )
      }
      break
    }

    case 'RECEBENDO_NOME_INF': {
      const fresh = await getSession(phone)
      if (isValidName(text)) {
        await upsertSession(phone, { nome: text.trim(), step: 'RECEBENDO_NASCIMENTO_INF', tentativas: 0 })
        await sendText(phone, 'Sua *data de nascimento*:\n_(Formato: DD/MM/AAAA)_')
      } else {
        const tentativas = (fresh?.tentativas || 0) + 1
        if (tentativas >= 3) { await transferirHumano(phone, '👩‍⚕️ Encaminhando para nossa equipe!'); return }
        await upsertSession(phone, { tentativas })
        await sendText(phone, 'Por favor, informe nome e sobrenome completos.')
      }
      break
    }

    case 'RECEBENDO_NASCIMENTO_INF': {
      const fresh = await getSession(phone)
      if (isValidDate(text)) {
        await upsertSession(phone, { nascimento: text.trim(), step: 'RECEBENDO_TELEFONE_INF', tentativas: 0 })
        await sendText(phone, 'Seu *telefone de contato* com DDD:\n_(Ex: 61999999999)_')
      } else {
        const tentativas = (fresh?.tentativas || 0) + 1
        if (tentativas >= 3) { await transferirHumano(phone, '👩‍⚕️ Encaminhando para nossa equipe!'); return }
        await upsertSession(phone, { tentativas })
        await sendText(phone, 'Data inválida. Use *DD/MM/AAAA*. Ex: 15/03/1985')
      }
      break
    }

    case 'RECEBENDO_TELEFONE_INF': {
      const fresh = await getSession(phone)
      if (isValidPhone(text)) {
        await upsertSession(phone, { telefone_contato: text.trim(), step: 'CONFIRMACAO_INFUSAO', tentativas: 0 })
        await run(phone, '', { ...fresh, telefone_contato: text.trim(), step: 'CONFIRMACAO_INFUSAO' })
      } else {
        const tentativas = (fresh?.tentativas || 0) + 1
        if (tentativas >= 3) { await transferirHumano(phone, '👩‍⚕️ Encaminhando para nossa equipe!'); return }
        await upsertSession(phone, { tentativas })
        await sendText(phone, 'Telefone inválido. Ex: *61999999999*')
      }
      break
    }

    case 'CONFIRMACAO_INFUSAO': {
      const fresh = await getSession(phone)
      insertAgendamento({
        phone,
        tipo: 'INFUSAO',
        especialidade: 'Infusão/Medicação',
        tipo_atendimento: fresh?.tipo_atendimento,
        convenio_informado: fresh?.convenio_informado,
        nome: fresh?.nome,
        nascimento: fresh?.nascimento,
        telefone_contato: fresh?.telefone_contato
      })

      const tipoStr = fresh?.tipo_atendimento === 'CONVENIO'
        ? `💳 Convênio: *${fresh?.convenio_informado}*`
        : '💳 *Particular*'

      await sendText(phone,
        '✅ *Solicitação de Infusão registrada!*\n\n' +
        '📋 *Resumo:*\n' +
        '🏥 Tipo: *Infusão / Hospital Dia*\n' +
        `👤 Nome: *${fresh?.nome}*\n` +
        `🎂 Nascimento: *${fresh?.nascimento}*\n` +
        `📱 Telefone: *${fresh?.telefone_contato}*\n` +
        `${tipoStr}\n\n` +
        '📄 *Próximo passo importante:*\n' +
        'Envie agora, neste mesmo chat, a *solicitação médica* (pedido do seu médico) como imagem ou PDF.\n' +
        'Nossa equipe irá analisá-la e dar andamento ao processo. 😊\n\n' +
        '⏰ Nossa equipe entrará em contato para confirmar data, horário e valores.\n' +
        '*Atos Saúde Hospital Dia* 🏥'
      )

      // Mantém em HUMANO para receber o documento do paciente
      await upsertSession(phone, {
        flow: 'HUMANO',
        step: 'AGUARDANDO_HUMANO',
        human_transfer_at: new Date().toISOString()
      })
      break
    }

    default:
      await run(phone, text, { ...session, step: 'START' })
  }
}
