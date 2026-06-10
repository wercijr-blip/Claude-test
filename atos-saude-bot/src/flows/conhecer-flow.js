import { sendText, sendDelay } from '../services/whatsapp.js'
import { upsertSession, clearSession } from '../services/db.js'

export async function run(phone, text, session) {
  if (session?.step === 'CONHECER_FEEDBACK') {
    const opt = text.trim()
    if (opt === '1') {
      await upsertSession(phone, { flow: 'CONSULTA', step: 'START' })
      const { run: consultaRun } = await import('./consulta-flow.js')
      await consultaRun(phone, '', { flow: 'CONSULTA', step: 'START' })
    } else {
      await clearSession(phone)
      const { run: menuRun } = await import('./menu-flow.js')
      await menuRun(phone, '', null)
    }
    return
  }

  // START
  await sendText(phone,
    '🏥 *Atos Saúde Integrada*\n' +
    'Setor Hospitalar Sul 716, Conj. A, Salas 603/605 - OHB\n' +
    'Asa Sul, Brasília-DF\n' +
    '📞 (61) 4042-7188\n\n' +
    '🕐 *Horários:*\n' +
    'Seg–Sex: 7h às 19h | Sáb: 7h às 13h\n\n' +
    '🗺️ https://g.page/atossaudeintegrada'
  )

  await sendDelay(phone,
    '🩺 *Nossas Especialidades:*\n' +
    '• Infectologia\n• Reumatologia\n• Nutrologia\n' +
    '• Fisioterapia\n• Vacinas\n• Medicina do Viajante\n• Hospital Dia (Infusões)\n\n' +
    '💳 *Convênios aceitos:*\n' +
    'AFEB BRASAL, AFFEGO, ASTE, ASSEDF/VIDA CARD, BACEN,\n' +
    'BOMBEIROS DF, BRB SAÚDE, CAEME-GO, CAESAN, CAIXA SAÚDE,\n' +
    'CAMED, CARE PLUS, CASEC, CNTI, CONAB, E-VIDA, FACEB,\n' +
    'FAPES/BNDES, FASCAL, FUSEX, GAMA SAÚDE, GRAVIA, INFRAERO,\n' +
    'LIFE EMPRESARIAL, MEDSENIOR, NOTRE DAME, OMINT, PETROBRÁS,\n' +
    'PLAN ASSISTE, PLAS/JMU, PMDF, POSTAL SAÚDE, PROASA,\n' +
    'PRÓ-SAÚDE, PRÓ-SOCIAL, REAL GRANDEZA, SERPRO, STF-MED,\n' +
    'SULAMÉRICA, TRE SAÚDE, TRT SAÚDE, TST SAÚDE, UNAFISCO.\n\n' +
    'Posso te ajudar com mais alguma coisa?\n' +
    '1️⃣ Marcar consulta\n' +
    '2️⃣ Voltar ao menu',
    1000
  )

  await upsertSession(phone, { flow: 'CONHECER', step: 'CONHECER_FEEDBACK' })
}
