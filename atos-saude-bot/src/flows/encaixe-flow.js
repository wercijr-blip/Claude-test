import { sendText } from '../services/whatsapp.js'
import { upsertSession, clearSession, insertAgendamento, getAgendamentoById, updateAgendamentoStatus } from '../services/db.js'
import { createEvent } from '../services/calendar.js'
import { msg } from '../utils/messages.js'
import { fmtHora, fmtData } from '../services/scheduler.js'

export async function run(phone, text, session) {
  const step = session?.step || 'AGUARDANDO_ENCAIXE'

  switch (step) {
    case 'AGUARDANDO_ENCAIXE': {
      const resp = text.trim()

      if (resp === '1') {
        // Paciente aceita o encaixe — cancela consulta anterior se houver, cria nova
        const slotDatetime = session.slot_escolhido
        const medicoId = session.medico_id
        const medicoNome = session.medico_nome
        const especialidade = session.especialidade

        if (!slotDatetime || !medicoId) {
          await sendText(phone, 'Desculpe, não encontrei os dados da vaga. Envie *oi* para recomeçar.')
          await clearSession(phone)
          return
        }

        // Se o paciente tem agendamento anterior registrado, cancela
        const agAnteriorId = session.agendamento_id
        if (agAnteriorId) {
          const agAnterior = getAgendamentoById(Number(agAnteriorId))
          if (agAnterior && agAnterior.status !== 'CANCELADO') {
            updateAgendamentoStatus(agAnterior.id, 'CANCELADO')
          }
        }

        // Cria novo agendamento no encaixe
        const patientData = {
          nome: session.nome || 'Paciente',
          nascimento: session.nascimento || '',
          telefone_contato: session.telefone_contato || phone,
          convenio_informado: session.convenio_informado || null,
          especialidade
        }

        let googleEventId = null
        try {
          googleEventId = await createEvent(medicoId, new Date(slotDatetime), patientData)
        } catch {}

        const agId = insertAgendamento({
          phone,
          tipo: 'CONSULTA',
          especialidade,
          medico_nome: medicoNome,
          medico_id: medicoId,
          slot_datetime: new Date(slotDatetime).toISOString(),
          tipo_atendimento: session.tipo_atendimento || 'CONVENIO',
          convenio_informado: session.convenio_informado || null,
          nome: session.nome || 'Paciente',
          nascimento: session.nascimento || '',
          telefone_contato: session.telefone_contato || phone,
          google_event_id: googleEventId,
          status: 'CONFIRMADO'
        })

        const { diaSemana, data } = fmtData(slotDatetime)
        const hora = fmtHora(slotDatetime)
        await sendText(phone, msg('encaixe_confirmado', {
          especialidade, medico: medicoNome, diaSemana, data, hora
        }))
        await clearSession(phone)
      } else if (resp === '2') {
        await sendText(phone, msg('encaixe_recusado'))
        await clearSession(phone)
      } else {
        await sendText(phone, 'Responda *1* para aceitar o horário ou *2* para manter sua consulta atual.')
      }
      break
    }

    default:
      await clearSession(phone)
  }
}
