import { sendText } from '../services/whatsapp.js'
import { upsertSession, clearSession, getSession, insertAgendamento } from '../services/db.js'
import { isValidName, isValidDate, isValidPhone, checkConvenio } from '../utils/validators.js'
import { getEarliestSlots, getDoctorSlots, createEvent, formatSlots } from '../services/calendar.js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const doctorsConfig = JSON.parse(
  readFileSync(join(__dirname, '../config/doctors.json'), 'utf-8')
)

const ESPECIALIDADES = [
  'Infectologia', 'Reumatologia', 'Nutrologia',
  'Fisioterapia', 'Vacinas', 'Medicina do Viajante', 'Outra'
]

async function transferir(phone, msg = '👩‍⚕️ Transferindo para nossa equipe! Um momento.') {
  await sendText(phone, msg)
  await clearSession(phone)
}

function formatSlotDatetime(slotStr) {
  try {
    const slot = JSON.parse(slotStr)
    const dt = new Date(slot.datetime)
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
    const day = String(dt.getDate()).padStart(2, '0')
    const month = String(dt.getMonth() + 1).padStart(2, '0')
    const year = dt.getFullYear()
    const h = String(dt.getHours()).padStart(2, '0')
    const m = String(dt.getMinutes()).padStart(2, '0')
    return `${days[dt.getDay()]}, ${day}/${month}/${year} às ${h}h${m}`
  } catch {
    return slotStr
  }
}

export async function run(phone, text, session) {
  const step = session?.step || 'START'

  switch (step) {
    case 'START': {
      await sendText(phone,
        'Qual especialidade você deseja? 🩺\n\n' +
        '1️⃣ Infectologia\n2️⃣ Reumatologia\n3️⃣ Nutrologia\n' +
        '4️⃣ Fisioterapia\n5️⃣ Vacinas\n6️⃣ Medicina do Viajante\n7️⃣ Outra / Não sei'
      )
      await upsertSession(phone, { flow: 'CONSULTA', step: 'AGUARDANDO_ESPECIALIDADE' })
      break
    }

    case 'AGUARDANDO_ESPECIALIDADE': {
      const map = { '1': 'Infectologia', '2': 'Reumatologia', '3': 'Nutrologia', '4': 'Fisioterapia', '5': 'Vacinas', '6': 'Medicina do Viajante', '7': 'Outra' }
      const esp = map[text.trim()] || text.trim()
      await upsertSession(phone, { especialidade: esp, step: 'AGUARDANDO_PREFERENCIA_HORARIO', tentativas: 0 })
      await sendText(phone,
        'Como prefere agendar?\n\n' +
        '1️⃣ Quero o horário mais cedo disponível\n' +
        '2️⃣ Quero escolher o médico'
      )
      break
    }

    case 'AGUARDANDO_PREFERENCIA_HORARIO': {
      if (text.trim() === '1') {
        await upsertSession(phone, { step: 'BUSCANDO_SLOTS_GERAIS' })
        await run(phone, '', { ...session, step: 'BUSCANDO_SLOTS_GERAIS' })
      } else if (text.trim() === '2') {
        await upsertSession(phone, { step: 'MOSTRAR_LISTA_MEDICOS' })
        await run(phone, '', { ...session, step: 'MOSTRAR_LISTA_MEDICOS' })
      } else {
        await sendText(phone, 'Escolha *1* ou *2*:')
      }
      break
    }

    case 'BUSCANDO_SLOTS_GERAIS': {
      await sendText(phone, '🔍 Verificando horários disponíveis…')
      const fresh = await getSession(phone)
      const slots = await getEarliestSlots(fresh?.especialidade)
      if (slots.length > 0) {
        await upsertSession(phone, { slots_json: JSON.stringify(slots), step: 'AGUARDANDO_ESCOLHA_SLOT' })
        await sendText(phone, formatSlots(slots) + '\n\nQual prefere? (1, 2 ou 3)')
      } else {
        await sendText(phone, 'Não encontrei vagas nos próximos 14 dias. 😕\nVou te conectar com nossa recepção! 👩‍⚕️')
        await clearSession(phone)
      }
      break
    }

    case 'MOSTRAR_LISTA_MEDICOS': {
      const fresh = await getSession(phone)
      const esp = fresh?.especialidade
      const doctors = doctorsConfig.doctors.filter(d => {
        if (!d.active) return false
        if (esp && esp !== 'Outra') return d.especialidade.toLowerCase().includes(esp.toLowerCase())
        return true
      })
      if (doctors.length === 0) {
        await sendText(phone, 'Não encontrei médicos para essa especialidade. 😕')
        await upsertSession(phone, { step: 'BUSCANDO_SLOTS_GERAIS' })
        await run(phone, '', { ...fresh, step: 'BUSCANDO_SLOTS_GERAIS' })
      } else if (doctors.length === 1) {
        await upsertSession(phone, { medico_id: doctors[0].id, medico_nome: doctors[0].nome, step: 'BUSCANDO_SLOTS_MEDICO' })
        await run(phone, '', { ...fresh, medico_id: doctors[0].id, medico_nome: doctors[0].nome, step: 'BUSCANDO_SLOTS_MEDICO' })
      } else {
        const lista = doctors.map((d, i) => `${i + 1}️⃣ ${d.nome} — ${d.especialidade}`).join('\n')
        await sendText(phone, 'Escolha o médico:\n\n' + lista)
        await upsertSession(phone, { slots_json: JSON.stringify(doctors.map(d => ({ id: d.id, nome: d.nome }))), step: 'AGUARDANDO_ESCOLHA_MEDICO' })
      }
      break
    }

    case 'AGUARDANDO_ESCOLHA_MEDICO': {
      const fresh = await getSession(phone)
      const doctors = JSON.parse(fresh?.slots_json || '[]')
      const idx = parseInt(text.trim()) - 1
      if (idx < 0 || idx >= doctors.length) {
        await sendText(phone, `Escolha um número entre 1 e ${doctors.length}.`)
        return
      }
      const chosen = doctors[idx]
      await upsertSession(phone, { medico_id: chosen.id, medico_nome: chosen.nome, step: 'BUSCANDO_SLOTS_MEDICO' })
      await run(phone, '', { ...fresh, medico_id: chosen.id, medico_nome: chosen.nome, step: 'BUSCANDO_SLOTS_MEDICO' })
      break
    }

    case 'BUSCANDO_SLOTS_MEDICO': {
      const fresh = await getSession(phone)
      await sendText(phone, `🔍 Verificando agenda de ${fresh?.medico_nome}…`)
      const slots = await getDoctorSlots(fresh?.medico_id)
      if (slots.length > 0) {
        await upsertSession(phone, { slots_json: JSON.stringify(slots), step: 'AGUARDANDO_ESCOLHA_SLOT' })
        await sendText(phone, formatSlots(slots) + '\n\nQual prefere? (1, 2 ou 3)')
      } else {
        await sendText(phone,
          `Não há vagas para ${fresh?.medico_nome} nos próximos 14 dias. 😕\n\n` +
          'Deseja ver o horário mais cedo com outro médico?\n1️⃣ Sim\n2️⃣ Não, prefiro falar com atendente'
        )
        await upsertSession(phone, { step: 'SEM_VAGA_MEDICO' })
      }
      break
    }

    case 'SEM_VAGA_MEDICO': {
      if (text.trim() === '1') {
        await upsertSession(phone, { step: 'BUSCANDO_SLOTS_GERAIS' })
        await run(phone, '', { ...session, step: 'BUSCANDO_SLOTS_GERAIS' })
      } else {
        await transferir(phone)
      }
      break
    }

    case 'AGUARDANDO_ESCOLHA_SLOT': {
      const fresh = await getSession(phone)
      const slots = JSON.parse(fresh?.slots_json || '[]')
      const idx = parseInt(text.trim()) - 1
      if (idx < 0 || idx >= slots.length) {
        await sendText(phone, `Escolha 1, 2 ou 3.`)
        return
      }
      await upsertSession(phone, { slot_escolhido: JSON.stringify(slots[idx]), step: 'VERIFICAR_CONVENIO' })
      await sendText(phone, 'Você possui convênio médico?\n\n1️⃣ Sim, tenho convênio\n2️⃣ Não, prefiro particular')
      break
    }

    case 'VERIFICAR_CONVENIO': {
      await sendText(phone, 'Você possui convênio médico?\n\n1️⃣ Sim, tenho convênio\n2️⃣ Não, prefiro particular')
      await upsertSession(phone, { step: 'AGUARDANDO_RESP_CONVENIO' })
      break
    }

    case 'AGUARDANDO_RESP_CONVENIO': {
      if (text.trim() === '1') {
        await sendText(phone, 'Qual o nome do seu convênio?')
        await upsertSession(phone, { step: 'RECEBENDO_CONVENIO' })
      } else {
        await upsertSession(phone, { step: 'INFORMAR_VALORES_PARTICULAR' })
        await run(phone, '', { ...session, step: 'INFORMAR_VALORES_PARTICULAR' })
      }
      break
    }

    case 'RECEBENDO_CONVENIO': {
      const aceito = checkConvenio(text)
      if (aceito) {
        await upsertSession(phone, { tipo_atendimento: 'CONVENIO', convenio_informado: text.trim(), step: 'AGUARDANDO_NOME', tentativas: 0 })
        await sendText(phone, 'Por favor, seu *nome completo*:')
      } else {
        await sendText(phone,
          `Infelizmente não trabalhamos com o *${text.trim()}*. 😕\n\n` +
          'Mas você pode nos consultar como *particular*!\n\n' +
          '💰 *Valores da consulta:*\n' +
          '💳 Cartão de crédito: *R$ 800,00*\n' +
          '💵 PIX ou à vista: *R$ 650,00*\n\n' +
          'Gostaria de prosseguir como particular?\n1️⃣ Sim, quero agendar\n2️⃣ Não, obrigado'
        )
        await upsertSession(phone, { convenio_informado: text.trim(), step: 'CONFIRMAR_PARTICULAR' })
      }
      break
    }

    case 'INFORMAR_VALORES_PARTICULAR': {
      await sendText(phone,
        '💰 *Valores da consulta particular:*\n' +
        '💳 Cartão de crédito: *R$ 800,00*\n' +
        '💵 PIX ou à vista: *R$ 650,00*\n\n' +
        'Deseja prosseguir?\n1️⃣ Sim, quero agendar\n2️⃣ Não, obrigado'
      )
      await upsertSession(phone, { step: 'CONFIRMAR_PARTICULAR' })
      break
    }

    case 'CONFIRMAR_PARTICULAR': {
      if (text.trim() === '1') {
        await upsertSession(phone, { tipo_atendimento: 'PARTICULAR', step: 'AGUARDANDO_NOME', tentativas: 0 })
        await sendText(phone, 'Por favor, seu *nome completo*:')
      } else {
        await sendText(phone, 'Tudo bem! Se precisar, é só chamar. 😊')
        await clearSession(phone)
      }
      break
    }

    case 'AGUARDANDO_NOME': {
      await sendText(phone, 'Por favor, seu *nome completo*:')
      await upsertSession(phone, { step: 'RECEBENDO_NOME' })
      break
    }

    case 'RECEBENDO_NOME': {
      const fresh = await getSession(phone)
      if (isValidName(text)) {
        await upsertSession(phone, { nome: text.trim(), step: 'AGUARDANDO_NASCIMENTO', tentativas: 0 })
        await sendText(phone, 'Sua *data de nascimento*:\n_(Formato: DD/MM/AAAA)_')
      } else {
        const tentativas = (fresh?.tentativas || 0) + 1
        if (tentativas >= 3) { await transferir(phone); return }
        await upsertSession(phone, { tentativas })
        await sendText(phone, 'Por favor, informe nome e sobrenome completos.')
      }
      break
    }

    case 'AGUARDANDO_NASCIMENTO': {
      await sendText(phone, 'Sua *data de nascimento*:\n_(Formato: DD/MM/AAAA)_')
      await upsertSession(phone, { step: 'RECEBENDO_NASCIMENTO' })
      break
    }

    case 'RECEBENDO_NASCIMENTO': {
      const fresh = await getSession(phone)
      if (isValidDate(text)) {
        await upsertSession(phone, { nascimento: text.trim(), step: 'AGUARDANDO_TELEFONE', tentativas: 0 })
        await sendText(phone, 'Seu *telefone de contato* com DDD:\n_(Ex: 61999999999)_')
      } else {
        const tentativas = (fresh?.tentativas || 0) + 1
        if (tentativas >= 3) { await transferir(phone); return }
        await upsertSession(phone, { tentativas })
        await sendText(phone, 'Data inválida. Use *DD/MM/AAAA*. Ex: 15/03/1985')
      }
      break
    }

    case 'AGUARDANDO_TELEFONE': {
      await sendText(phone, 'Seu *telefone de contato* com DDD:\n_(Ex: 61999999999)_')
      await upsertSession(phone, { step: 'RECEBENDO_TELEFONE' })
      break
    }

    case 'RECEBENDO_TELEFONE': {
      const fresh = await getSession(phone)
      if (isValidPhone(text)) {
        await upsertSession(phone, { telefone_contato: text.trim(), step: 'CONFIRMACAO_FINAL', tentativas: 0 })
        await run(phone, '', { ...fresh, telefone_contato: text.trim(), step: 'CONFIRMACAO_FINAL' })
      } else {
        const tentativas = (fresh?.tentativas || 0) + 1
        if (tentativas >= 3) { await transferir(phone); return }
        await upsertSession(phone, { tentativas })
        await sendText(phone, 'Telefone inválido. Ex: *61999999999*')
      }
      break
    }

    case 'CONFIRMACAO_FINAL': {
      const fresh = await getSession(phone)
      let slotObj = null
      try { slotObj = JSON.parse(fresh?.slot_escolhido || '{}') } catch {}

      const agId = insertAgendamento({
        phone,
        tipo: 'CONSULTA',
        especialidade: fresh?.especialidade,
        medico_nome: fresh?.medico_nome || slotObj?.doctorNome,
        medico_id: fresh?.medico_id || slotObj?.doctorId,
        slot_datetime: slotObj?.datetime ? new Date(slotObj.datetime).toISOString() : null,
        tipo_atendimento: fresh?.tipo_atendimento,
        convenio_informado: fresh?.convenio_informado,
        nome: fresh?.nome,
        nascimento: fresh?.nascimento,
        telefone_contato: fresh?.telefone_contato
      })

      let googleEventId = null
      if (slotObj?.datetime && (fresh?.medico_id || slotObj?.doctorId)) {
        googleEventId = await createEvent(
          fresh?.medico_id || slotObj?.doctorId,
          new Date(slotObj.datetime),
          { nome: fresh?.nome, nascimento: fresh?.nascimento, telefone_contato: fresh?.telefone_contato, convenio_informado: fresh?.convenio_informado, especialidade: fresh?.especialidade }
        )
      }

      await clearSession(phone)

      const slotFormatado = formatSlotDatetime(fresh?.slot_escolhido)
      const medicoNome = fresh?.medico_nome || slotObj?.doctorNome || 'A definir'
      const isConvenio = fresh?.tipo_atendimento === 'CONVENIO'

      let msg = `✅ *Consulta agendada com sucesso!*\n\n📋 *Resumo:*\n`
      msg += `🩺 Especialidade: *${fresh?.especialidade}*\n`
      msg += `👨‍⚕️ Médico: *${medicoNome}*\n`
      msg += `📅 Data/Hora: *${slotFormatado}*\n`
      msg += `👤 Nome: *${fresh?.nome}*\n`
      msg += `🎂 Nascimento: *${fresh?.nascimento}*\n`
      msg += `📱 Telefone: *${fresh?.telefone_contato}*\n`

      if (isConvenio) {
        msg += `💳 Convênio: *${fresh?.convenio_informado}*\n`
      } else {
        msg += `💳 Tipo: *Particular*\n\n`
        msg += `💰 *Pagamento no dia:*\n💳 Crédito: R$ 800,00\n💵 PIX / À vista: R$ 650,00\n`
      }

      msg += `\nNossa recepção confirmará em breve. ⏰\n*Atos Saúde* — Cuidando de você! 🏥`
      await sendText(phone, msg)
      break
    }

    default:
      await run(phone, text, { ...session, step: 'START' })
  }
}
