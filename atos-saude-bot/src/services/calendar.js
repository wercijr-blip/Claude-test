import { google } from 'googleapis'
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { logger } from '../utils/logger.js'
import { withRetry } from '../utils/retry.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DOCTORS_PATH = join(__dirname, '../config/doctors.json')

function getDoctorsConfig() {
  return JSON.parse(readFileSync(DOCTORS_PATH, 'utf-8'))
}

let calendar = null

function getCalendarClient() {
  if (calendar) return calendar
  const saPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH || './src/config/google-service-account.json'
  if (!existsSync(saPath)) {
    logger.warn('Google Service Account JSON não encontrado. Calendário desativado.')
    return null
  }
  const sa = JSON.parse(readFileSync(saPath, 'utf-8'))
  const auth = new google.auth.GoogleAuth({
    credentials: sa,
    scopes: ['https://www.googleapis.com/auth/calendar']
  })
  calendar = google.calendar({ version: 'v3', auth })
  return calendar
}

function parseTime(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  return { h, m }
}

function generateSlots(date, startTime, endTime, durationMin) {
  const slots = []
  const start = parseTime(startTime)
  const end = parseTime(endTime)
  let current = new Date(date)
  current.setHours(start.h, start.m, 0, 0)
  const endDt = new Date(date)
  endDt.setHours(end.h, end.m, 0, 0)

  while (current < endDt) {
    slots.push(new Date(current))
    current = new Date(current.getTime() + durationMin * 60 * 1000)
  }
  return slots
}

export async function getAvailableSlots(doctorId, daysAhead = 14, count = 3) {
  const cal = getCalendarClient()
  const cfg = getDoctorsConfig()
  const doctor = cfg.doctors.find(d => d.id === doctorId)
  if (!doctor || !doctor.active) return []

  const now = new Date()
  const minStart = new Date(now.getTime() + 2 * 60 * 60 * 1000)
  const timeMax = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000)

  let busyPeriods = []
  if (cal && doctor.calendarId !== 'PREENCHER') {
    try {
      const fb = await withRetry(() => cal.freebusy.query({
        requestBody: {
          timeMin: now.toISOString(),
          timeMax: timeMax.toISOString(),
          items: [{ id: doctor.calendarId }]
        }
      }))
      busyPeriods = fb.data.calendars?.[doctor.calendarId]?.busy || []
    } catch (err) {
      logger.warn({ doctorId, err: err.message }, 'Erro ao buscar freebusy')
    }
  }

  // Per-doctor schedule takes priority over global working hours
  const sched = doctor.schedule
  const duration = sched?.duracaoConsulta || doctor.slotDurationMinutes || 30

  const allSlots = []
  for (let d = 0; d < daysAhead; d++) {
    const date = new Date(now)
    date.setDate(date.getDate() + d)
    date.setHours(0, 0, 0, 0)
    const dow = date.getDay()

    let startTime, endTime
    if (sched) {
      if (!sched.diasSemana?.includes(dow)) continue
      startTime = sched.horarioInicio
      endTime = sched.horarioFim
    } else {
      if (cfg.workingHours.weekdays.includes(dow)) {
        startTime = cfg.workingHours.start
        endTime = cfg.workingHours.end
      } else if (dow === 6 && cfg.workingHours.saturday?.active) {
        startTime = cfg.workingHours.saturday.start
        endTime = cfg.workingHours.saturday.end
      } else {
        continue
      }
    }

    const daySlots = generateSlots(date, startTime, endTime, duration)
    for (const slot of daySlots) {
      if (slot < minStart) continue
      const slotEnd = new Date(slot.getTime() + duration * 60 * 1000)
      const isBusy = busyPeriods.some(b => {
        const bs = new Date(b.start)
        const be = new Date(b.end)
        return slot < be && slotEnd > bs
      })
      if (!isBusy) {
        allSlots.push({
          datetime: slot,
          doctorId: doctor.id,
          doctorNome: doctor.nome,
          especialidade: doctor.especialidade
        })
      }
      if (allSlots.length >= count) break
    }
    if (allSlots.length >= count) break
  }

  return allSlots.slice(0, count)
}

export async function getEarliestSlots(especialidade, daysAhead = 14, count = 3) {
  const doctors = getDoctorsConfig().doctors.filter(d => {
    if (!d.active) return false
    if (especialidade && especialidade !== 'Outra') {
      return d.especialidade.toLowerCase().includes(especialidade.toLowerCase())
    }
    return true
  })

  const allSlots = []
  for (const doc of doctors) {
    const slots = await getAvailableSlots(doc.id, daysAhead, count)
    allSlots.push(...slots)
  }

  allSlots.sort((a, b) => a.datetime - b.datetime)
  return allSlots.slice(0, count)
}

export async function getDoctorSlots(doctorId, daysAhead = 14, count = 5) {
  return getAvailableSlots(doctorId, daysAhead, count)
}

export async function createEvent(doctorId, slotDatetime, patientData) {
  const cal = getCalendarClient()
  const doctor = getDoctorsConfig().doctors.find(d => d.id === doctorId)
  if (!cal || !doctor || doctor.calendarId === 'PREENCHER') return null

  try {
    const start = new Date(slotDatetime)
    const end = new Date(start.getTime() + doctor.slotDurationMinutes * 60 * 1000)
    const event = await withRetry(() => cal.events.insert({
      calendarId: doctor.calendarId,
      requestBody: {
        summary: `Consulta — ${patientData.nome}`,
        description: `Nome: ${patientData.nome}\nNascimento: ${patientData.nascimento}\nTelefone: ${patientData.telefone_contato}\nConvênio: ${patientData.convenio_informado || 'Particular'}\nEspecialidade: ${patientData.especialidade}`,
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
        colorId: '5'
      }
    }))
    return event.data.id
  } catch (err) {
    logger.error({ doctorId, err: err.message }, 'Erro ao criar evento no Google Calendar')
    return null
  }
}

// Remove um evento existente do Google Calendar
export async function deleteEvent(doctorId, eventId) {
  const cal = getCalendarClient()
  const doctor = getDoctorsConfig().doctors.find(d => d.id === doctorId)
  if (!cal || !doctor || doctor.calendarId === 'PREENCHER' || !eventId) return false

  try {
    await withRetry(() => cal.events.delete({ calendarId: doctor.calendarId, eventId }),
      { attempts: 3, baseDelayMs: 1000 })
    logger.info({ doctorId, eventId }, 'Evento removido do Google Calendar')
    return true
  } catch (err) {
    if (err.code === 410) return true
    logger.error({ doctorId, eventId, err: err.message }, 'Erro ao deletar evento do Google Calendar')
    return false
  }
}

// Cria um evento de bloqueio no Google Calendar (impede novos agendamentos)
export async function createBlockEvent(doctorId, startISO, endISO, motivo = 'BLOQUEADO') {
  const cal = getCalendarClient()
  const doctor = getDoctorsConfig().doctors.find(d => d.id === doctorId)
  if (!cal || !doctor || doctor.calendarId === 'PREENCHER') return null

  try {
    const event = await withRetry(() => cal.events.insert({
      calendarId: doctor.calendarId,
      requestBody: {
        summary: `🚫 ${motivo}`,
        description: `Período bloqueado pela clínica.\nMédico: ${doctor.nome}`,
        start: { dateTime: startISO },
        end: { dateTime: endISO },
        colorId: '11',
        transparency: 'opaque'
      }
    }))
    logger.info({ doctorId, start: startISO, end: endISO, motivo }, 'Bloqueio criado no Google Calendar')
    return event.data.id
  } catch (err) {
    logger.error({ doctorId, err: err.message }, 'Erro ao criar bloqueio no Google Calendar')
    return null
  }
}

// Cria um calendário Google para o médico e compartilha com o e-mail dele (se informado)
export async function createDoctorCalendar(doctorNome, especialidade, doctorEmail) {
  const cal = getCalendarClient()
  if (!cal) return null

  try {
    const created = await cal.calendars.insert({
      requestBody: {
        summary: `${doctorNome} — ${especialidade}`,
        description: `Agenda gerada automaticamente pelo sistema Atos Saúde`,
        timeZone: 'America/Sao_Paulo'
      }
    })
    const calendarId = created.data.id
    logger.info({ doctorNome, calendarId }, 'Google Calendar criado para médico')

    // Compartilha com o e-mail do médico (role: writer) se informado
    if (doctorEmail) {
      try {
        await cal.acl.insert({
          calendarId,
          requestBody: { role: 'writer', scope: { type: 'user', value: doctorEmail } }
        })
        logger.info({ doctorNome, doctorEmail }, 'Calendário compartilhado com o médico')
      } catch (err) {
        logger.warn({ doctorEmail, err: err.message }, 'Não foi possível compartilhar o calendário')
      }
    }

    return calendarId
  } catch (err) {
    logger.error({ doctorNome, err: err.message }, 'Erro ao criar Google Calendar para médico')
    return null
  }
}

export function formatSlots(slots) {
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  const nums = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣']
  return slots.map((s, i) => {
    const dt = new Date(s.datetime)
    const dayName = days[dt.getDay()]
    const day = String(dt.getDate()).padStart(2, '0')
    const month = String(dt.getMonth() + 1).padStart(2, '0')
    const h = String(dt.getHours()).padStart(2, '0')
    const m = String(dt.getMinutes()).padStart(2, '0')
    return `${nums[i] || `${i + 1}.`} ${dayName}, ${day}/${month} às ${h}h${m} — ${s.doctorNome} (${s.especialidade})`
  }).join('\n')
}
