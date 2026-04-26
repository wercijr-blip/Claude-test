import { createInterface } from 'readline'
import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CONFIG_PATH = join(__dirname, '../config/doctors.json')

const rl = createInterface({ input: process.stdin, output: process.stdout })
const ask = q => new Promise(r => rl.question(q, r))

console.log('=== Adicionar Novo Médico — Atos Saúde ===\n')

const nome = await ask('Nome completo do médico: ')
const crm = await ask('CRM (ex: CRM 12345-DF): ')
const especialidade = await ask('Especialidade: ')
const calendarId = await ask('ID do Google Calendar: ')
const slotStr = await ask('Duração da consulta em minutos [30]: ')
const slotDurationMinutes = parseInt(slotStr) || 30

rl.close()

const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'))
const id = 'dr_' + nome.split(' ')[1]?.toLowerCase().replace(/[^a-z]/g, '') || `dr_${Date.now()}`

config.doctors.push({
  id,
  nome: nome.trim(),
  crm: crm.trim(),
  especialidade: especialidade.trim(),
  calendarId: calendarId.trim(),
  slotDurationMinutes,
  active: true
})

writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
console.log(`\n✅ Médico ${nome.trim()} adicionado com sucesso!`)
