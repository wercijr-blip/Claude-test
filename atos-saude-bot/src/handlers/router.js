import { getSession, clearSession } from '../services/db.js'
import { isRestartKeyword } from '../utils/validators.js'
import { logger } from '../utils/logger.js'

export async function router(phone, text, pushName = '') {
  const session = await getSession(phone)

  // Pesquisa de satisfação tem prioridade — não interromper com palavras de reinício
  if (session?.flow === 'PESQUISA') {
    const { run } = await import('../flows/pesquisa-flow.js')
    await run(phone, text, session)
    return
  }

  // "atendente" força transferência humana imediata de qualquer fluxo
  if (text.trim().toLowerCase() === 'atendente') {
    const { sendText } = await import('../services/whatsapp.js')
    const { upsertSession } = await import('../services/db.js')
    await sendText(phone, '👩‍⚕️ Transferindo para nossa equipe agora! Um momento. 😊')
    await upsertSession(phone, {
      flow: 'HUMANO',
      step: 'AGUARDANDO_HUMANO',
      human_transfer_at: new Date().toISOString()
    })
    return
  }

  if (!session || session.step === 'START' || isRestartKeyword(text)) {
    await clearSession(phone)
    const { run } = await import('../flows/menu-flow.js')
    await run(phone, text, null, pushName)
    return
  }

  logger.debug({ phone, flow: session.flow, step: session.step }, 'Roteando mensagem')

  switch (session.flow) {
    case 'MENU': {
      const { run } = await import('../flows/menu-flow.js')
      await run(phone, text, session, pushName)
      break
    }
    case 'CONHECER': {
      const { run } = await import('../flows/conhecer-flow.js')
      await run(phone, text, session)
      break
    }
    case 'CONSULTA': {
      const { run } = await import('../flows/consulta-flow.js')
      await run(phone, text, session)
      break
    }
    case 'INFUSAO': {
      const { run } = await import('../flows/infusao-flow.js')
      await run(phone, text, session)
      break
    }
    case 'MEDICACAO': {
      const { run } = await import('../flows/medicacao-flow.js')
      await run(phone, text, session)
      break
    }
    case 'FAQ': {
      const { run } = await import('../flows/autorizacao-faq.js')
      await run(phone, text, session)
      break
    }
    case 'PESQUISA': {
      const { run } = await import('../flows/pesquisa-flow.js')
      await run(phone, text, session)
      break
    }
    case 'ENCAIXE': {
      const { run } = await import('../flows/encaixe-flow.js')
      await run(phone, text, session)
      break
    }
    case 'EXAMES': {
      const { run } = await import('../flows/exames-flow.js')
      await run(phone, text, session)
      break
    }
    case 'HUMANO': {
      logger.info({ phone }, 'Mensagem recebida em atendimento humano — aguardando operador')
      break
    }
    default: {
      await clearSession(phone)
      const { run } = await import('../flows/menu-flow.js')
      await run(phone, text, null, pushName)
    }
  }
}
