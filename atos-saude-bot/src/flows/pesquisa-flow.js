import { sendText } from '../services/whatsapp.js'
import { upsertSession, clearSession, getSession, insertSatisfactionResponse } from '../services/db.js'
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

      if (opt === '5' || opt === '4') {
        await sendText(phone,
          `${nota.emoji} Que ótimo! Ficamos muito felizes com sua avaliação *${nota.label}*!\n\n` +
          `Gostaria de deixar algum comentário? (opcional)\n\n` +
          `Envie seu comentário ou *0* para encerrar.`
        )
      } else {
        await sendText(phone,
          `${nota.emoji} Obrigado pelo retorno. Lamentamos que sua experiência tenha sido *${nota.label}*.\n\n` +
          `Poderia nos contar o que aconteceu? Seu feedback é muito importante para melhorarmos! 🙏\n\n` +
          `Envie seu comentário ou *0* para encerrar.`
        )
      }
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

      if (notaNum >= 4) {
        await sendText(phone,
          `${notaInfo.emoji} *Muito obrigado pela sua avaliação!*\n\n` +
          `É um prazer cuidar da sua saúde!\n\n` +
          `Se precisar de algo, estamos sempre aqui. 😊\n` +
          `*Atos Saúde Integrada* 🏥`
        )
      } else {
        await sendText(phone,
          `${notaInfo.emoji} *Obrigado pelo seu feedback!*\n\n` +
          `Vamos analisar sua avaliação para melhorar nosso atendimento.\n\n` +
          `Se quiser falar com nossa equipe, envie *oi*. 😊\n` +
          `*Atos Saúde Integrada* | (61) 4042-7188 🏥`
        )
      }
      break
    }

    default:
      await run(phone, text, { ...session, step: 'AGUARDANDO_NOTA' })
  }
}
