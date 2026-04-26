import axios from 'axios'
import { logger } from '../utils/logger.js'

const { EVOLUTION_URL, EVOLUTION_API_KEY, INSTANCE_NAME } = process.env

export async function sendText(phone, text) {
  await new Promise(r => setTimeout(r, 500))
  try {
    await axios.post(
      `${EVOLUTION_URL}/message/sendText/${INSTANCE_NAME}`,
      { number: phone, text },
      { headers: { apikey: EVOLUTION_API_KEY } }
    )
    return true
  } catch (err) {
    logger.error({ phone, err: err.message }, 'Erro ao enviar mensagem WhatsApp')
    return false
  }
}

export async function sendDelay(phone, text, delayMs = 1000) {
  await new Promise(r => setTimeout(r, delayMs))
  return sendText(phone, text)
}
