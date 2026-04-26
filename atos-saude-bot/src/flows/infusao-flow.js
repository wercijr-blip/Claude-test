import { sendText } from '../services/whatsapp.js'
import { upsertSession, clearSession, getSession, insertAgendamento } from '../services/db.js'
import { isValidName, isValidDate, isValidPhone, checkConvenio } from '../utils/validators.js'

async function transferir(phone) {
  await sendText(phone, '👩‍⚕️ Encaminhando para nossa equipe!')
  await clearSession(phone)
}

export async function run(phone, text, session) {
  const step = session?.step || 'START'

  switch (step) {
    case 'START': {
      await sendText(phone,
        '🏥 *Infusão / Medicação — Hospital Dia Atos Saúde*\n\n' +
        'Você possui convênio que cobre o procedimento?\n\n' +
        '1️⃣ Sim, tenho convênio\n' +
        '2️⃣ Prefiro atendimento particular'
      )
      await upsertSession(phone, { flow: 'INFUSAO', step: 'AGUARDANDO_TIPO' })
      break
    }

    case 'AGUARDANDO_TIPO': {
      if (text.trim() === '1') {
        await sendText(phone, 'Qual o nome do seu convênio?')
        await upsertSession(phone, { step: 'RECEBENDO_CONVENIO_INF' })
      } else if (text.trim() === '2') {
        await upsertSession(phone, { step: 'INFUSAO_PARTICULAR_INFO' })
        await run(phone, '', { ...session, step: 'INFUSAO_PARTICULAR_INFO' })
      } else {
        await sendText(phone, 'Escolha *1* ou *2*.')
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
        await upsertSession(phone, { tipo_atendimento: 'CONVENIO', convenio_informado: text.trim(), step: 'AGUARDANDO_NOME_INF', tentativas: 0 })
        await sendText(phone, 'Por favor, seu *nome completo*:')
      } else {
        await sendText(phone,
          `Infelizmente não trabalhamos com o *${text.trim()}*\npara infusões. 😕\n\n` +
          'Posso encaminhar para nossa equipe que\napresentará as opções particulares. 👩‍⚕️\n\n' +
          'Deseja ser atendido?\n1️⃣ Sim\n2️⃣ Não, obrigado'
        )
        await upsertSession(phone, { convenio_informado: text.trim(), step: 'INFUSAO_ENCAMINHAR' })
      }
      break
    }

    case 'INFUSAO_ENCAMINHAR': {
      if (text.trim() === '1') {
        await transferir(phone)
      } else {
        await sendText(phone, 'Tudo bem! 😊')
        await clearSession(phone)
      }
      break
    }

    case 'INFUSAO_PARTICULAR_INFO': {
      await sendText(phone,
        '💊 *Infusão Particular — Hospital Dia*\n\n' +
        'Os valores variam conforme o medicamento\ne duração do procedimento.\n\n' +
        'Nossa equipe informará o valor exato após\nanálise do pedido médico. 📋\n\n' +
        'Posso pegar seus dados de contato?\n1️⃣ Sim\n2️⃣ Não, obrigado'
      )
      await upsertSession(phone, { step: 'INFUSAO_PARTICULAR_CONFIRMAR' })
      break
    }

    case 'INFUSAO_PARTICULAR_CONFIRMAR': {
      if (text.trim() === '1') {
        await upsertSession(phone, { tipo_atendimento: 'PARTICULAR', step: 'AGUARDANDO_NOME_INF', tentativas: 0 })
        await sendText(phone, 'Por favor, seu *nome completo*:')
      } else {
        await sendText(phone, 'Tudo bem! 😊')
        await clearSession(phone)
      }
      break
    }

    case 'AGUARDANDO_NOME_INF': {
      await sendText(phone, 'Por favor, seu *nome completo*:')
      await upsertSession(phone, { step: 'RECEBENDO_NOME_INF' })
      break
    }

    case 'RECEBENDO_NOME_INF': {
      const fresh = await getSession(phone)
      if (isValidName(text)) {
        await upsertSession(phone, { nome: text.trim(), step: 'AGUARDANDO_NASCIMENTO_INF', tentativas: 0 })
        await sendText(phone, 'Sua *data de nascimento*:\n_(Formato: DD/MM/AAAA)_')
      } else {
        const tentativas = (fresh?.tentativas || 0) + 1
        if (tentativas >= 3) { await transferir(phone); return }
        await upsertSession(phone, { tentativas })
        await sendText(phone, 'Por favor, informe nome e sobrenome completos.')
      }
      break
    }

    case 'AGUARDANDO_NASCIMENTO_INF': {
      await sendText(phone, 'Sua *data de nascimento*:\n_(Formato: DD/MM/AAAA)_')
      await upsertSession(phone, { step: 'RECEBENDO_NASCIMENTO_INF' })
      break
    }

    case 'RECEBENDO_NASCIMENTO_INF': {
      const fresh = await getSession(phone)
      if (isValidDate(text)) {
        await upsertSession(phone, { nascimento: text.trim(), step: 'AGUARDANDO_TELEFONE_INF', tentativas: 0 })
        await sendText(phone, 'Seu *telefone de contato* com DDD:\n_(Ex: 61999999999)_')
      } else {
        const tentativas = (fresh?.tentativas || 0) + 1
        if (tentativas >= 3) { await transferir(phone); return }
        await upsertSession(phone, { tentativas })
        await sendText(phone, 'Data inválida. Use *DD/MM/AAAA*. Ex: 15/03/1985')
      }
      break
    }

    case 'AGUARDANDO_TELEFONE_INF': {
      await sendText(phone, 'Seu *telefone de contato* com DDD:\n_(Ex: 61999999999)_')
      await upsertSession(phone, { step: 'RECEBENDO_TELEFONE_INF' })
      break
    }

    case 'RECEBENDO_TELEFONE_INF': {
      const fresh = await getSession(phone)
      if (isValidPhone(text)) {
        await upsertSession(phone, { telefone_contato: text.trim(), step: 'CONFIRMACAO_INFUSAO', tentativas: 0 })
        await run(phone, '', { ...fresh, telefone_contato: text.trim(), step: 'CONFIRMACAO_INFUSAO' })
      } else {
        const tentativas = (fresh?.tentativas || 0) + 1
        if (tentativas >= 3) { await transferir(phone); return }
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
      await clearSession(phone)

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
        '⚠️ Tenha o pedido médico em mãos.\n' +
        'Nossa equipe entrará em contato para confirmar\ndata, horário e valores. ⏰\n\n' +
        '*Atos Saúde Hospital Dia* 🏥'
      )
      break
    }

    default:
      await run(phone, text, { ...session, step: 'START' })
  }
}
