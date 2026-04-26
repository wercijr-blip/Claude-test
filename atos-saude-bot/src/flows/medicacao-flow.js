import { sendText } from '../services/whatsapp.js'
import { upsertSession, clearSession, getSession, insertMedicationRequest } from '../services/db.js'
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
        '💊 *Solicitação de Medicação — Atos Saúde*\n\n' +
        'Você possui convênio que cobre a medicação?\n\n' +
        '1️⃣ Sim, tenho convênio\n' +
        '2️⃣ Atendimento particular'
      )
      await upsertSession(phone, { flow: 'MEDICACAO', step: 'AGUARDANDO_TIPO_MED' })
      break
    }

    case 'AGUARDANDO_TIPO_MED': {
      if (text.trim() === '1') {
        await sendText(phone, 'Qual o nome do seu convênio?')
        await upsertSession(phone, { step: 'RECEBENDO_CONVENIO_MED' })
      } else if (text.trim() === '2') {
        await transferirHumano(phone,
          '💊 *Medicação Particular — Atos Saúde*\n\n' +
          'Temos disponibilidade para atendimento particular!\n\n' +
          'Nossa equipe informará valores e alternativas com *prioridade*. 🌟\n\n' +
          '👩‍⚕️ Transferindo para atendimento prioritário…'
        )
      } else {
        await sendText(phone, 'Escolha *1* (convênio) ou *2* (particular).')
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
        await upsertSession(phone, { tipo_atendimento: 'CONVENIO', convenio_informado: text.trim(), step: 'RECEBENDO_NOME_MED', tentativas: 0 })
        await sendText(phone, 'Por favor, seu *nome completo*:')
      } else {
        await transferirHumano(phone,
          `Infelizmente não trabalhamos com o *${text.trim()}* para esta medicação. 😕\n\n` +
          '💊 Mas temos *atendimento particular* disponível!\n\n' +
          'Nossa equipe orientará sobre as opções com *prioridade*. 🌟\n\n' +
          '👩‍⚕️ Transferindo para atendimento prioritário…'
        )
      }
      break
    }

    case 'RECEBENDO_NOME_MED': {
      const fresh = await getSession(phone)
      if (isValidName(text)) {
        await upsertSession(phone, { nome: text.trim(), step: 'RECEBENDO_NASCIMENTO_MED', tentativas: 0 })
        await sendText(phone, 'Sua *data de nascimento*:\n_(Formato: DD/MM/AAAA)_')
      } else {
        const tentativas = (fresh?.tentativas || 0) + 1
        if (tentativas >= 3) { await transferirHumano(phone, '👩‍⚕️ Encaminhando para nossa equipe!'); return }
        await upsertSession(phone, { tentativas })
        await sendText(phone, 'Por favor, informe nome e sobrenome completos.')
      }
      break
    }

    case 'RECEBENDO_NASCIMENTO_MED': {
      const fresh = await getSession(phone)
      if (isValidDate(text)) {
        await upsertSession(phone, { nascimento: text.trim(), step: 'RECEBENDO_TELEFONE_MED', tentativas: 0 })
        await sendText(phone, 'Seu *telefone de contato* com DDD:\n_(Ex: 61999999999)_')
      } else {
        const tentativas = (fresh?.tentativas || 0) + 1
        if (tentativas >= 3) { await transferirHumano(phone, '👩‍⚕️ Encaminhando para nossa equipe!'); return }
        await upsertSession(phone, { tentativas })
        await sendText(phone, 'Data inválida. Use *DD/MM/AAAA*. Ex: 15/03/1985')
      }
      break
    }

    case 'RECEBENDO_TELEFONE_MED': {
      const fresh = await getSession(phone)
      if (isValidPhone(text)) {
        await upsertSession(phone, { telefone_contato: text.trim(), step: 'CONFIRMACAO_MEDICACAO', tentativas: 0 })
        await run(phone, '', { ...fresh, telefone_contato: text.trim(), step: 'CONFIRMACAO_MEDICACAO' })
      } else {
        const tentativas = (fresh?.tentativas || 0) + 1
        if (tentativas >= 3) { await transferirHumano(phone, '👩‍⚕️ Encaminhando para nossa equipe!'); return }
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

      const tipoStr = fresh?.tipo_atendimento === 'CONVENIO'
        ? `💳 Convênio: *${fresh?.convenio_informado}*`
        : '💳 *Particular*'

      await sendText(phone,
        '✅ *Solicitação de Medicação registrada!*\n\n' +
        `👤 Nome: *${fresh?.nome}*\n` +
        `🎂 Nascimento: *${fresh?.nascimento}*\n` +
        `📱 Telefone: *${fresh?.telefone_contato}*\n` +
        `${tipoStr}\n\n` +
        '📄 *Próximo passo importante:*\n' +
        'Envie agora, neste mesmo chat, o *pedido médico* (com nome da medicação e CID) como imagem ou PDF.\n' +
        'Nossa equipe irá analisar e encaminhar para o médico responsável. 😊\n\n' +
        '⏰ Nossa equipe entrará em contato em breve.\n' +
        '*Atos Saúde* 🏥'
      )

      // Mantém em HUMANO para receber o pedido médico do paciente
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
