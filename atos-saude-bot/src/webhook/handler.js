import { sendText } from '../services/whatsapp.js'
import { checkLimit } from '../utils/rate-limiter.js'
import { logger } from '../utils/logger.js'
import { router } from '../handlers/router.js'

export async function handleWebhook(req, res) {
  res.sendStatus(200)

  try {
    const body = req.body
    if (body?.event !== 'messages.upsert') return

    const msg = body?.data?.messages?.[0] || body?.data
    if (!msg) return

    const fromMe = msg.key?.fromMe
    const isGroup = msg.key?.remoteJid?.endsWith('@g.us')
    if (fromMe || isGroup) return

    const rawPhone = msg.key?.remoteJid || ''
    const phone = rawPhone.replace('@s.whatsapp.net', '')

    const msgType = msg.message ? Object.keys(msg.message)[0] : null
    const isText = msgType === 'conversation' || msgType === 'extendedTextMessage'

    if (!isText) {
      await sendText(phone, 'Por favor, envie apenas mensagens de texto. 😊')
      return
    }

    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
    if (!text.trim()) return

    if (!checkLimit(phone)) {
      await sendText(phone, 'Muitas mensagens! Aguarde um momento. ⏳')
      return
    }

    logger.info({ phone, text }, 'Mensagem recebida')
    await router(phone, text)
  } catch (err) {
    logger.error({ err: err.message }, 'Erro no webhook')
    const rawPhone = req.body?.data?.messages?.[0]?.key?.remoteJid || ''
    const phone = rawPhone.replace('@s.whatsapp.net', '')
    if (phone) {
      await sendText(phone, 'Ocorreu um problema. Envie *oi* para recomeçar.')
    }
  }
}
