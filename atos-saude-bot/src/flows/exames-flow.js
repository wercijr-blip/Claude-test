import { sendText } from '../services/whatsapp.js'
import { upsertSession } from '../services/db.js'

export async function run(phone, text, session) {
  await sendText(phone,
    '🔬 *Dúvidas e Envio de Exames*\n\n' +
    'Esta área é destinada a:\n' +
    '• Envio de exames conforme orientação do seu *médico assistente*\n' +
    '• Dúvidas sobre resultados e condutas médicas\n\n' +
    '📋 Nossa equipe de secretaria irá encaminhar seus exames e dúvidas diretamente ao médico responsável.\n\n' +
    '⚠️ *Atenção:* O atendimento a partir daqui é realizado pela nossa *equipe humana*.\n\n' +
    'Você já pode:\n' +
    '📎 Enviar seus exames como *imagem ou PDF* neste chat\n' +
    '💬 Digitar sua dúvida diretamente\n\n' +
    '_Nossa equipe responderá em breve. Obrigado pela paciência! 😊_\n\n' +
    '*Atos Saúde Integrada* 🏥'
  )
  await upsertSession(phone, {
    flow: 'HUMANO',
    step: 'AGUARDANDO_HUMANO',
    human_transfer_at: new Date().toISOString()
  })
}
