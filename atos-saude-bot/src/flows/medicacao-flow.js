import { sendText } from '../services/whatsapp.js'
import { upsertSession, clearSession, getSession, insertMedicationRequest } from '../services/db.js'
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
        '💊 *Solicitação de Medicação — Atos Saúde*\n\n' +
        'Você possui convênio que cobre a medicação?\n\n' +
        '1️⃣ Sim, tenho convênio\n' +
        '2️⃣ Prefiro atendimento particular'
      )
      await upsertSession(phone, { flow: 'MEDICACAO', step: 'AGUARDANDO_TIPO_MED' })
      break
    }

    case 'AGUARDANDO_TIPO_MED': {
      if (text.trim() === '1') {
        await sendText(phone, 'Qual o nome do seu convênio?')
        await upsertSession(phone, { step: 'RECEBENDO_CONVENIO_MED' })
      } else if (text.trim() === '2') {
        await upsertSession(phone, { tipo_atendimento: 'PARTICULAR', step: 'AGUARDANDO_NOME_MED', tentativas: 0 })
        await sendText(phone, 'Por favor, seu *nome completo*:')
      } else {
        await sendText(phone, 'Escolha *1* ou *2*.')
      }
      break
    }

    case 'RECEBENDO_CONVENIO_MED': {
      if (checkConvenio(text)) {
        await sendText(phone,
          `✅ Atendemos o *${text.trim()}*!\n\n` +
          'Para solicitação de medicação via convênio:\n' +
          '📋 Pedido médico com nome do medicamento e CID\n' +
          '💳 Carteirinha do plano\n\n' +
          'Vou registrar sua solicitação. 😊'
        )
        await upsertSession(phone, { tipo_atendimento: 'CONVENIO', convenio_informado: text.trim(), step: 'AGUARDANDO_NOME_MED', tentativas: 0 })
        await sendText(phone, 'Por favor, seu *nome completo*:')
      } else {
        await sendText(phone,
          `Infelizmente não trabalhamos com o *${text.trim()}*\npara esta medicação. 😕\n\n` +
          'Nossa equipe pode orientar sobre as opções\nde atendimento particular. 👩‍⚕️\n\n' +
          'Deseja ser atendido?\n1️⃣ Sim\n2️⃣ Não, obrigado'
        )
        await upsertSession(phone, { convenio_informado: text.trim(), step: 'MED_ENCAMINHAR' })
      }
      break
    }

    case 'MED_ENCAMINHAR': {
      if (text.trim() === '1') {
        await transferir(phone)
      } else {
        await sendText(phone, 'Tudo bem! 😊')
        await clearSession(phone)
      }
      break
    }

    case 'AGUARDANDO_NOME_MED': {
      await sendText(phone, 'Por favor, seu *nome completo*:')
      await upsertSession(phone, { step: 'RECEBENDO_NOME_MED' })
      break
    }

    case 'RECEBENDO_NOME_MED': {
      const fresh = await getSession(phone)
      if (isValidName(text)) {
        await upsertSession(phone, { nome: text.trim(), step: 'AGUARDANDO_NASCIMENTO_MED', tentativas: 0 })
        await sendText(phone, 'Sua *data de nascimento*:\n_(Formato: DD/MM/AAAA)_')
      } else {
        const tentativas = (fresh?.tentativas || 0) + 1
        if (tentativas >= 3) { await transferir(phone); return }
        await upsertSession(phone, { tentativas })
        await sendText(phone, 'Por favor, informe nome e sobrenome completos.')
      }
      break
    }

    case 'AGUARDANDO_NASCIMENTO_MED': {
      await sendText(phone, 'Sua *data de nascimento*:\n_(Formato: DD/MM/AAAA)_')
      await upsertSession(phone, { step: 'RECEBENDO_NASCIMENTO_MED' })
      break
    }

    case 'RECEBENDO_NASCIMENTO_MED': {
      const fresh = await getSession(phone)
      if (isValidDate(text)) {
        await upsertSession(phone, { nascimento: text.trim(), step: 'AGUARDANDO_TELEFONE_MED', tentativas: 0 })
        await sendText(phone, 'Seu *telefone de contato* com DDD:\n_(Ex: 61999999999)_')
      } else {
        const tentativas = (fresh?.tentativas || 0) + 1
        if (tentativas >= 3) { await transferir(phone); return }
        await upsertSession(phone, { tentativas })
        await sendText(phone, 'Data inválida. Use *DD/MM/AAAA*. Ex: 15/03/1985')
      }
      break
    }

    case 'AGUARDANDO_TELEFONE_MED': {
      await sendText(phone, 'Seu *telefone de contato* com DDD:\n_(Ex: 61999999999)_')
      await upsertSession(phone, { step: 'RECEBENDO_TELEFONE_MED' })
      break
    }

    case 'RECEBENDO_TELEFONE_MED': {
      const fresh = await getSession(phone)
      if (isValidPhone(text)) {
        await upsertSession(phone, { telefone_contato: text.trim(), step: 'CONFIRMACAO_MEDICACAO', tentativas: 0 })
        await run(phone, '', { ...fresh, telefone_contato: text.trim(), step: 'CONFIRMACAO_MEDICACAO' })
      } else {
        const tentativas = (fresh?.tentativas || 0) + 1
        if (tentativas >= 3) { await transferir(phone); return }
        await upsertSession(phone, { tentativas })
        await sendText(phone, 'Telefone inválido. Ex: *61999999999*')
      }
      break
    }

    case 'CONFIRMACAO_MEDICACAO': {
      const fresh = await getSession(phone)
      insertMedicationRequest({
        phone,
        nome: fresh?.nome,
        nascimento: fresh?.nascimento,
        telefone_contato: fresh?.telefone_contato,
        tipo_atendimento: fresh?.tipo_atendimento,
        convenio_informado: fresh?.convenio_informado
      })
      await clearSession(phone)

      const tipoStr = fresh?.tipo_atendimento === 'CONVENIO'
        ? `💳 Convênio: *${fresh?.convenio_informado}*`
        : '💳 *Particular*'

      await sendText(phone,
        '✅ *Solicitação de Medicação registrada!*\n\n' +
        `👤 Nome: *${fresh?.nome}*\n` +
        `🎂 Nascimento: *${fresh?.nascimento}*\n` +
        `📱 Telefone: *${fresh?.telefone_contato}*\n` +
        `${tipoStr}\n\n` +
        'Nossa equipe entrará em contato em breve. ⏰\n' +
        '*Atos Saúde* 🏥'
      )
      break
    }

    default:
      await run(phone, text, { ...session, step: 'START' })
  }
}
