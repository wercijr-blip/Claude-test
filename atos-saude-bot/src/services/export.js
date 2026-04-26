import ExcelJS from 'exceljs'
import { mkdirSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { getAgendamentos, markExported } from './db.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const EXPORTS_DIR = join(__dirname, '../../exports')

if (!existsSync(EXPORTS_DIR)) mkdirSync(EXPORTS_DIR, { recursive: true })

export async function generateExcel(exportAll = false) {
  const filters = exportAll ? {} : { exported: 0 }
  const rows = exportAll
    ? getAgendamentos({})
    : getAgendamentos({}).filter(r => r.exported === 0)

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Atos Saúde Bot'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Agendamentos Atos Saúde')

  sheet.columns = [
    { header: '#', key: 'id', width: 6 },
    { header: 'Tipo', key: 'tipo', width: 12 },
    { header: 'Especialidade', key: 'especialidade', width: 20 },
    { header: 'Médico', key: 'medico_nome', width: 22 },
    { header: 'Data/Hora Agendada', key: 'slot_datetime', width: 20 },
    { header: 'Convênio/Particular', key: 'tipo_atendimento', width: 18 },
    { header: 'Convênio', key: 'convenio_informado', width: 20 },
    { header: 'Nome Completo', key: 'nome', width: 28 },
    { header: 'Nascimento', key: 'nascimento', width: 13 },
    { header: 'Telefone', key: 'telefone_contato', width: 15 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Registrado em', key: 'created_at', width: 18 }
  ]

  // Style header row
  const headerRow = sheet.getRow(1)
  headerRow.height = 25
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } }
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.border = {
      bottom: { style: 'medium', color: { argb: 'FFFFFFFF' } }
    }
  })

  const typeColors = {
    PARTICULAR: 'FFFFF3E0',
    INFUSAO: 'FFF3E5F5',
    MEDICACAO: 'FFE8F5E9'
  }

  rows.forEach((row, idx) => {
    const dataRow = sheet.addRow({
      id: row.id,
      tipo: row.tipo,
      especialidade: row.especialidade || '',
      medico_nome: row.medico_nome || '',
      slot_datetime: row.slot_datetime ? formatDatetime(row.slot_datetime) : '',
      tipo_atendimento: row.tipo_atendimento || '',
      convenio_informado: row.convenio_informado || '',
      nome: row.nome,
      nascimento: row.nascimento,
      telefone_contato: row.telefone_contato,
      status: row.status,
      created_at: formatDatetime(row.created_at)
    })

    const bg = typeColors[row.tipo_atendimento] ||
      (idx % 2 === 0 ? 'FFFFFFFF' : 'FFF0F4FF')

    dataRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
      cell.alignment = { vertical: 'middle' }
    })
  })

  const now = new Date()
  const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`
  const filePath = join(EXPORTS_DIR, `agendamentos_${ts}.xlsx`)

  await workbook.xlsx.writeFile(filePath)

  if (!exportAll && rows.length > 0) {
    markExported(rows.map(r => r.id))
  }

  return filePath
}

function pad(n) { return String(n).padStart(2, '0') }

function formatDatetime(str) {
  if (!str) return ''
  try {
    const d = new Date(str)
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return str
  }
}
