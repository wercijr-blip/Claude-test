import { sendText } from '../services/whatsapp.js'
import { upsertSession, clearSession } from '../services/db.js'
import { answerAuthorizationQuestion } from '../services/claude.js'

async function processar(phone, text) {
  const { answer, confidence } = await answerAuthorizationQuestion(phone, text)

  if (confidence === 'HIGH' && answer) {
    await sendText(phone, answer)
    await sendText(phone,
      '❓ Isso respondeu sua dúvida?\n' +
      '1️⃣ Sim, obrigado!\n' +
      '2️⃣ Não, preciso falar com atendente\n' +
      '3️⃣ Tenho outra dúvida'
    )
    await upsertSession(phone, { flow: 'FAQ', step: 'AGUARDANDO_FEEDBACK_FAQ' })
  } else {
    await sendText(phone, 'Não encontrei essa informação. 🔍\nVou te conectar com nossa equipe! 👩‍⚕️')
    await clearSession(phone)
  }
}

export async function run(phone, text, session) {
  const step = session?.step || 'START'

  switch (step) {
    case 'START': {
      if (text && text.trim().length > 0) {
        await upsertSession(phone, { flow: 'FAQ', step: 'PROCESSANDO_FAQ' })
        await processar(phone, text)
      } else {
        await sendText(phone, 'Qual é a sua dúvida sobre autorização? 😊')
        await upsertSession(phone, { flow: 'FAQ', step: 'AGUARDANDO_PERGUNTA' })
      }
      break
    }

    case 'AGUARDANDO_PERGUNTA': {
      await upsertSession(phone, { step: 'PROCESSANDO_FAQ' })
      await processar(phone, text)
      break
    }

    case 'AGUARDANDO_FEEDBACK_FAQ': {
      const opt = text.trim()
      if (opt === '1') {
        await sendText(phone, 'Fico feliz em ajudar! 😊 Envie *oi* se precisar.')
        await clearSession(phone)
      } else if (opt === '2') {
        await sendText(phone, '👩‍⚕️ Transferindo para nossa equipe!')
        await clearSession(phone)
      } else if (opt === '3') {
        await sendText(phone, 'Qual é a sua outra dúvida? 😊')
        await upsertSession(phone, { step: 'AGUARDANDO_PERGUNTA' })
      } else {
        await sendText(phone, 'Escolha 1, 2 ou 3.')
      }
      break
    }

    default:
      await run(phone, text, { ...session, step: 'START' })
  }
}
