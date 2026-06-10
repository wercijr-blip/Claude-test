import { sendText } from '../services/whatsapp.js'
import { upsertSession, clearSession } from '../services/db.js'
import { isQuestion } from '../utils/validators.js'

const RESTART_TIP = '\n\n_💡 A qualquer momento: digite *menu* para voltar ao início ou *atendente* para falar com nossa equipe._'

function saudacao() {
  const h = new Date().getHours()
  if (h >= 5 && h < 12) return 'Bom dia'
  if (h >= 12 && h < 18) return 'Boa tarde'
  return 'Boa noite'
}

async function sendMenuOpcoes(phone) {
  await sendText(phone,
    '🏥 *Atos Saúde Integrada* — Como posso ajudar?\n\n' +
    '1️⃣ Agendar consulta\n' +
    '2️⃣ Solicitar infusão ou medicação\n' +
    '3️⃣ Informações sobre convênios\n' +
    '4️⃣ Enviar exame para análise médica\n' +
    '5️⃣ Falar com atendente' +
    RESTART_TIP
  )
  await upsertSession(phone, { flow: 'MENU', step: 'AGUARDANDO_MENU_PRINCIPAL' })
}

export async function run(phone, text, session, pushName = '') {
  const step = session?.step || 'START'

  // ── Confirmação do nome pelo WhatsApp ────────────────────────────────────
  if (step === 'CONFIRMANDO_NOME') {
    const nomeWa = session?.nome || pushName || ''
    const opt = text.trim()
    if (opt === '1') {
      await sendMenuOpcoes(phone)
    } else if (opt === '2') {
      await sendText(phone, 'Por favor, informe seu *nome completo* (nome e sobrenome):')
      await upsertSession(phone, { step: 'COLETANDO_NOME_MENU' })
    } else {
      await sendText(phone,
        `Confirma que seu nome é *${nomeWa}*?\n\n1️⃣ Sim, está correto ✅\n2️⃣ Não, prefiro informar outro`
      )
    }
    return
  }

  if (step === 'COLETANDO_NOME_MENU') {
    const nome = text.trim()
    if (nome.split(/\s+/).filter(w => w).length < 2) {
      await sendText(phone, 'Por favor, informe nome *e* sobrenome completos.')
      return
    }
    await upsertSession(phone, { nome, step: 'AGUARDANDO_MENU_PRINCIPAL' })
    await sendMenuOpcoes(phone)
    return
  }

  // ── Menu principal ───────────────────────────────────────────────────────
  if (step === 'AGUARDANDO_MENU_PRINCIPAL') {
    const opt = text.trim()
    switch (opt) {
      case '1': {
        await upsertSession(phone, { flow: 'CONSULTA', step: 'START' })
        const { run: consultaRun } = await import('./consulta-flow.js')
        await consultaRun(phone, '', { flow: 'CONSULTA', step: 'START' })
        return
      }
      case '2': {
        await sendText(phone,
          '🏥 *Hospital Dia Atos Saúde*\n\nQual serviço você precisa?\n\n' +
          '1️⃣ Infusão (procedimento em hospital dia)\n' +
          '2️⃣ Solicitação de medicação'
        )
        await upsertSession(phone, { step: 'AGUARDANDO_TIPO_SOLICITACAO' })
        return
      }
      case '3': {
        await upsertSession(phone, { flow: 'FAQ', step: 'START' })
        const { run: faqRun } = await import('./autorizacao-faq.js')
        await faqRun(phone, text, { flow: 'FAQ', step: 'START' })
        return
      }
      case '4': {
        await upsertSession(phone, { flow: 'EXAMES', step: 'START' })
        const { run: examesRun } = await import('./exames-flow.js')
        await examesRun(phone, '', { flow: 'EXAMES', step: 'START' })
        return
      }
      case '5': {
        const { sendText: st } = await import('../services/whatsapp.js')
        await st(phone, '👩‍⚕️ Transferindo para nossa equipe! Um momento. 😊')
        await upsertSession(phone, {
          flow: 'HUMANO',
          step: 'AGUARDANDO_HUMANO',
          human_transfer_at: new Date().toISOString()
        })
        return
      }
      default: {
        if (isQuestion(text)) {
          await upsertSession(phone, { flow: 'FAQ', step: 'START' })
          const { run: faqRun } = await import('./autorizacao-faq.js')
          await faqRun(phone, text, { flow: 'FAQ', step: 'START' })
          return
        }
        await sendMenuOpcoes(phone)
        return
      }
    }
  }

  // ── Sub-opção: Infusão ou Medicação ─────────────────────────────────────
  if (step === 'AGUARDANDO_TIPO_SOLICITACAO') {
    const opt = text.trim()
    if (opt === '1') {
      await upsertSession(phone, { flow: 'INFUSAO', step: 'START' })
      const { run: infusaoRun } = await import('./infusao-flow.js')
      await infusaoRun(phone, '', { flow: 'INFUSAO', step: 'START' })
    } else if (opt === '2') {
      await upsertSession(phone, { flow: 'MEDICACAO', step: 'START' })
      const { run: medicacaoRun } = await import('./medicacao-flow.js')
      await medicacaoRun(phone, '', { flow: 'MEDICACAO', step: 'START' })
    } else {
      await sendText(phone, 'Digite *1* para Infusão ou *2* para Medicação.')
    }
    return
  }

  // ── START: saudação inicial ──────────────────────────────────────────────
  const sauda = saudacao()
  if (pushName) {
    await sendText(phone,
      `${sauda}! 👋 Bem-vindo(a) à *Atos Saúde Integrada*!\n\n` +
      `Vi que seu nome no WhatsApp é *${pushName}*.\n` +
      `Esse é o nome para seu atendimento?\n\n` +
      `1️⃣ Sim, está correto ✅\n` +
      `2️⃣ Não, prefiro informar outro nome`
    )
    await upsertSession(phone, { flow: 'MENU', step: 'CONFIRMANDO_NOME', nome: pushName })
  } else {
    await sendText(phone, `${sauda}! 👋 Bem-vindo(a) à *Atos Saúde Integrada*!`)
    await sendMenuOpcoes(phone)
  }
}
