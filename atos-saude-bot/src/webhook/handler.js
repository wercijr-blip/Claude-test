import { timingSafeEqual } from 'crypto'
import { sendText } from '../services/whatsapp.js'
import { checkLimit } from '../utils/rate-limiter.js'
import { getSession, insertMessageLog } from '../services/db.js'
import { logger } from '../utils/logger.js'
import { router } from '../handlers/router.js'
import { broadcastSSE } from '../utils/sse.js'

const MEDIA_TYPES = new Set(['imageMessage','documentMessage','audioMessage','videoMessage','stickerMessage','documentWithCaptionMessage'])

export async function handleWebhook(req, res) {
  const secret = process.env.EVOLUTION_WEBHOOK_SECRET
  if (secret) {
    const incoming = req.headers['apikey'] || ''
    const secretBuf = Buffer.from(secret)
    const incomingBuf = Buffer.from(incoming)
    if (incomingBuf.length !== secretBuf.length || !timingSafeEqual(incomingBuf, secretBuf)) {
      return res.sendStatus(401)
    }
  }
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

    const pushName = msg.pushName || msg.verifiedBizName || ''

    const msgType = msg.message ? Object.keys(msg.message)[0] : null
    const isText = msgType === 'conversation' || msgType === 'extendedTextMessage'
    const isMedia = MEDIA_TYPES.has(msgType)

    if (!isText) {
      if (isMedia) {
        const session = await getSession(phone)
        if (session?.flow === 'HUMANO') {
          logger.info({ phone, msgType }, 'Mídia recebida em atendimento humano — aguardando operador')
          return
        }
        if (session?.flow === 'EXAMES' && session?.step === 'AGUARDANDO_EXAME') {
          logger.info({ phone, msgType }, 'Exame recebido — processando')
          const { runMedia } = await import('../flows/exames-flow.js')
          await runMedia(phone, msg, session)
          return
        }
      }
      await sendText(phone, 'Por favor, envie apenas mensagens de texto. 😊')
      return
    }

    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
    if (!text.trim()) return

    if (!checkLimit(phone)) {
      await sendText(phone, 'Muitas mensagens! Aguarde um momento. ⏳')
      return
    }

    const session = await getSession(phone)
    try { insertMessageLog({ phone, direction: 'IN', text, flow: session?.flow || null, step: session?.step || null }) } catch {}

    logger.info({ phone, text }, 'Mensagem recebida')
    const flowAntes = session?.flow
    await router(phone, text, pushName)
    if (flowAntes !== 'HUMANO') {
      const sessaoAtual = await getSession(phone)
      if (sessaoAtual?.flow === 'HUMANO') broadcastSSE('session_update')
    }
  } catch (err) {
    logger.error({ err: err.message }, 'Erro no webhook')
    const rawPhone = req.body?.data?.messages?.[0]?.key?.remoteJid || ''
    const phone = rawPhone.replace('@s.whatsapp.net', '')
    if (phone) {
      await sendText(phone, 'Ocorreu um problema. Envie *oi* para recomeçar.')
    }
  }
}
