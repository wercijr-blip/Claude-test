import { sendText } from '../services/whatsapp.js'
import { upsertSession, clearSession } from '../services/db.js'
import { isQuestion } from '../utils/validators.js'

export async function run(phone, text, session) {
  if (session?.step === 'AGUARDANDO_MENU_PRINCIPAL') {
    const opt = text.trim()
    switch (opt) {
      case '1': {
        await upsertSession(phone, { flow: 'CONHECER', step: 'START' })
        const { run: conhecerRun } = await import('./conhecer-flow.js')
        await conhecerRun(phone, '', { flow: 'CONHECER', step: 'START' })
        return
      }
      case '2': {
        await upsertSession(phone, { flow: 'CONSULTA', step: 'START' })
        const { run: consultaRun } = await import('./consulta-flow.js')
        await consultaRun(phone, '', { flow: 'CONSULTA', step: 'START' })
        return
      }
      case '3': {
        await upsertSession(phone, { flow: 'INFUSAO', step: 'START' })
        const { run: infusaoRun } = await import('./infusao-flow.js')
        await infusaoRun(phone, '', { flow: 'INFUSAO', step: 'START' })
        return
      }
      case '4': {
        await upsertSession(phone, { flow: 'MEDICACAO', step: 'START' })
        const { run: medicacaoRun } = await import('./medicacao-flow.js')
        await medicacaoRun(phone, '', { flow: 'MEDICACAO', step: 'START' })
        return
      }
      case '5': {
        await sendText(phone, '👩‍⚕️ Transferindo para nossa equipe! Um momento.')
        await clearSession(phone)
        return
      }
      default: {
        if (isQuestion(text)) {
          await upsertSession(phone, { flow: 'FAQ', step: 'START' })
          const { run: faqRun } = await import('./autorizacao-faq.js')
          await faqRun(phone, text, { flow: 'FAQ', step: 'START' })
          return
        }
        await sendMenu(phone)
        return
      }
    }
  }

  await sendMenu(phone)
}

async function sendMenu(phone) {
  await sendText(phone,
    'Olá! 👋 Bem-vindo(a) à *Atos Saúde Integrada*!\n\n' +
    'O que você precisa hoje?\n\n' +
    '1️⃣ Conhecer a Atos Saúde\n' +
    '2️⃣ Marcar consulta\n' +
    '3️⃣ Marcar infusão\n' +
    '4️⃣ Solicitar medicação\n' +
    '5️⃣ Falar com atendente'
  )
  await upsertSession(phone, { flow: 'MENU', step: 'AGUARDANDO_MENU_PRINCIPAL' })
}
