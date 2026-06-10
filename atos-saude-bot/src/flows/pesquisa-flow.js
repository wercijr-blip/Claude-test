import { sendText } from '../services/whatsapp.js'
import { upsertSession, clearSession, getSession, insertSatisfactionResponse } from '../services/db.js'
import { msg } from '../utils/messages.js'
import { logger } from '../utils/logger.js'

const NOTAS = {
  '1': { emoji: '😞', label: 'Péssimo' },
  '2': { emoji: '😕', label: 'Ruim' },
  '3': { emoji: '😐', label: 'Regular' },
  '4': { emoji: '😊', label: 'Bom' },
  '5': { emoji: '🌟', label: 'Excelente' }
}

export async function run(phone, text, session) {
  const step = session?.step || 'AGUARDANDO_NOTA'

  switch (step) {
    case 'AGUARDANDO_NOTA': {
      const opt = text.trim()
      const nota = NOTAS[opt]

      if (!nota) {
        await sendText(phone,
          'Por favor, responda com um número de *1 a 5*:\n\n' +
          '1️⃣ Péssimo | 2️⃣ Ruim | 3️⃣ Regular | 4️⃣ Bom | 5️⃣ Excelente'
        )
        return
      }

      await upsertSession(phone, { step: 'AGUARDANDO_COMENTARIO', slots_json: opt })

      const chave = (opt === '4' || opt === '5') ? 'pesquisa_positiva_comentario' : 'pesquisa_negativa_comentario'
      await sendText(phone, msg(chave, { emoji: nota.emoji, label: nota.label }))
      break
    }

    case 'AGUARDANDO_COMENTARIO': {
      const fresh = await getSession(phone)
      const notaStr = fresh?.slots_json || '0'
      const notaNum = parseInt(notaStr)
      const comentario = text.trim() === '0' ? null : text.trim()
      const notaInfo = NOTAS[notaStr] || { emoji: '⭐', label: 'Sem nota' }

      insertSatisfactionResponse({
        phone,
        agendamento_id: fresh?.agendamento_id ? parseInt(fresh.agendamento_id) : null,
        medico_nome: fresh?.medico_nome || null,
        especialidade: fresh?.especialidade || null,
        nota: notaNum,
        comentario
      })

      logger.info({ phone, nota: notaNum, agendamentoId: fresh?.agendamento_id }, 'Pesquisa de satisfação salva')
      await clearSession(phone)

      const chaveAgrad = notaNum >= 4 ? 'pesquisa_agradecimento_positivo' : 'pesquisa_agradecimento_negativo'
      await sendText(phone, msg(chaveAgrad, { emoji: notaInfo.emoji }))
      break
    }

    default:
      await run(phone, text, { ...session, step: 'AGUARDANDO_NOTA' })
  }
}
