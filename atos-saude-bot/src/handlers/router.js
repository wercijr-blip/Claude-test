import { getSession, clearSession } from '../services/db.js'
import { isRestartKeyword } from '../utils/validators.js'
import { logger } from '../utils/logger.js'

export async function router(phone, text) {
  const session = await getSession(phone)

  if (!session || session.step === 'START' || isRestartKeyword(text)) {
    await clearSession(phone)
    const { run } = await import('../flows/menu-flow.js')
    await run(phone, text, null)
    return
  }

  logger.debug({ phone, flow: session.flow, step: session.step }, 'Roteando mensagem')

  switch (session.flow) {
    case 'MENU': {
      const { run } = await import('../flows/menu-flow.js')
      await run(phone, text, session)
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
    default: {
      await clearSession(phone)
      const { run } = await import('../flows/menu-flow.js')
      await run(phone, text, null)
    }
  }
}
