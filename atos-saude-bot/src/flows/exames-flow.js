import { sendText } from '../services/whatsapp.js'
import { upsertSession, clearSession, insertExamSubmission } from '../services/db.js'
import { isValidName } from '../utils/validators.js'
import { logger } from '../utils/logger.js'
import axios from 'axios'
import { writeFile, mkdir } from 'fs/promises'
import { fileURLToPath } from 'url'
import { dirname, join, extname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const UPLOADS_DIR = join(__dirname, '../../../uploads/exames')

const MIME_EXT = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp',
  'application/pdf': '.pdf', 'application/octet-stream': '.bin'
}

export async function run(phone, text, session) {
  const step = session?.step || 'START'

  switch (step) {
    case 'START': {
      await upsertSession(phone, { flow: 'EXAMES', step: 'AGUARDANDO_NOME', tentativas: 0 })
      await sendText(phone,
        '🩺 *Envio de Exame para Análise Médica*\n\n' +
        'Vou registrar seu exame para que o médico possa analisá-lo.\n\n' +
        'Por favor, informe seu *nome completo*:'
      )
      break
    }

    case 'AGUARDANDO_NOME': {
      if (!isValidName(text)) {
        const tentativas = (session?.tentativas || 0) + 1
        if (tentativas >= 3) {
          await sendText(phone, 'Não consegui identificar seu nome. Por favor, entre em contato pelo número da clínica. 😊')
          await clearSession(phone)
          return
        }
        await upsertSession(phone, { tentativas })
        await sendText(phone, 'Por favor, informe seu *nome completo* (nome e sobrenome):')
        return
      }
      await upsertSession(phone, { nome: text.trim(), step: 'AGUARDANDO_MEDICO', tentativas: 0 })
      await sendText(phone,
        `Olá, *${text.trim().split(' ')[0]}*! 😊\n\n` +
        'Qual é o nome do *médico* que irá analisar seu exame?'
      )
      break
    }

    case 'AGUARDANDO_MEDICO': {
      if (!text || text.trim().length < 3) {
        const tentativas = (session?.tentativas || 0) + 1
        if (tentativas >= 3) {
          await sendText(phone, 'Não consegui identificar o médico. Por favor, entre em contato pelo número da clínica. 😊')
          await clearSession(phone)
          return
        }
        await upsertSession(phone, { tentativas })
        await sendText(phone, 'Por favor, informe o *nome do médico* responsável pela análise:')
        return
      }
      await upsertSession(phone, { medico_nome: text.trim(), step: 'AGUARDANDO_EXAME', tentativas: 0 })
      await sendText(phone,
        `✅ Anotado! Exame para análise do *${text.trim()}*.\n\n` +
        '📎 Agora envie o(s) exame(s) neste chat como *imagem ou PDF*.\n\n' +
        '_Após o envio, nossa equipe encaminhará ao médico e você receberá um retorno em breve._'
      )
      break
    }

    default: {
      await upsertSession(phone, { flow: 'EXAMES', step: 'START' })
      await run(phone, text, { ...session, step: 'START' })
    }
  }
}

export async function runMedia(phone, msg, session) {
  const { EVOLUTION_URL, EVOLUTION_API_KEY, INSTANCE_NAME } = process.env
  let filePath = null
  let mediaType = null

  try {
    await mkdir(UPLOADS_DIR, { recursive: true })

    // Determina tipo de mídia
    const msgTypes = ['imageMessage', 'documentMessage', 'documentWithCaptionMessage']
    const foundType = msgTypes.find(t => msg.message?.[t])
    const mediaMsg = foundType ? msg.message[foundType] : null
    mediaType = foundType || 'unknown'

    if (mediaMsg) {
      // Baixa base64 via Evolution API
      const response = await axios.post(
        `${EVOLUTION_URL}/chat/getBase64FromMediaMessage/${INSTANCE_NAME}`,
        { message: { key: msg.key } },
        { headers: { apikey: EVOLUTION_API_KEY }, timeout: 30000 }
      )
      const base64 = response.data?.base64 || response.data?.data
      if (base64) {
        const mime = mediaMsg.mimetype || 'application/octet-stream'
        const ext = MIME_EXT[mime] || extname(mediaMsg.fileName || '') || '.bin'
        const filename = `${phone}_${Date.now()}${ext}`
        filePath = join(UPLOADS_DIR, filename)
        await writeFile(filePath, Buffer.from(base64, 'base64'))
        logger.info({ phone, filePath }, 'Exame salvo em disco')
      }
    }
  } catch (err) {
    logger.error({ phone, err: err.message }, 'Erro ao baixar exame — registrando sem arquivo')
  }

  // Salva registro independente de ter baixado o arquivo
  try {
    insertExamSubmission({
      phone,
      nome: session?.nome || null,
      medico_nome: session?.medico_nome || null,
      file_path: filePath || null,
      media_type: mediaType || null
    })
  } catch (err) {
    logger.error({ phone, err: err.message }, 'Erro ao salvar exam_submission')
  }

  await sendText(phone,
    '✅ *Exame recebido com sucesso!*\n\n' +
    `Obrigado, *${session?.nome?.split(' ')[0] || 'paciente'}*! 😊\n\n` +
    `Seu exame foi encaminhado para análise do *${session?.medico_nome || 'médico responsável'}*.\n\n` +
    '_Em breve nossa equipe entrará em contato com o retorno da avaliação._\n\n' +
    '*Atos Saúde Integrada* 🏥'
  )

  await clearSession(phone)
}
