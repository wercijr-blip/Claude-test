import 'dotenv/config'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { getAvailableSlots, formatSlots } from '../services/calendar.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const doctorsConfig = JSON.parse(
  readFileSync(join(__dirname, '../config/doctors.json'), 'utf-8')
)

console.log('=== Teste Google Calendar — Atos Saúde ===\n')

for (const doctor of doctorsConfig.doctors) {
  if (!doctor.active) {
    console.log(`⏭ ${doctor.nome} — inativo, pulando.`)
    continue
  }
  try {
    const slots = await getAvailableSlots(doctor.id, 7, 5)
    if (slots.length === 0) {
      console.log(`⚠️  ${doctor.nome} — nenhuma vaga nos próximos 7 dias.`)
    } else {
      console.log(`✅ ${doctor.nome} — ${slots.length} vagas encontradas.`)
      console.log(`   Próxima: ${slots[0].datetime.toLocaleString('pt-BR')}`)
    }
  } catch (err) {
    console.error(`❌ ${doctor.nome} — erro: ${err.message}`)
  }
}

console.log('\nTeste concluído.')
