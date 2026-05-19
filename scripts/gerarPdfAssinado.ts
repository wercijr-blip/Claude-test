import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

// Simula variáveis de ambiente
process.env.APP_URL = 'https://cis.atos.med.br'
process.env.MEDICO_NOME = 'Dr. Werciley Saraiva Vieira Junior'
process.env.MEDICO_CRM = '12345/DF'
process.env.NODE_ENV = 'development'

const { gerarPrescricaoPdf, assinarPdf } = await import('../server/pdfSigner.ts')

const saida = path.join(import.meta.dirname, '../pdf-preview')
await mkdir(saida, { recursive: true })

const paciente = {
  nome: 'João da Silva Santos',
  dataNascimento: '1990-05-15',
  sexo: 'Masculino',
  prescricaoJson: {
    medicamento: 'tenofovir_emtricitabina',
    posologia: '1 comprimido ao dia, por via oral',
    duracao: '180 dias (renovável)',
    observacoes: 'Tomar preferencialmente com alimentos.',
  },
}

console.log('Gerando PDF com assinatura digital...')

const pdfBuffer = await gerarPrescricaoPdf(paciente as never)
const { buffer, certificadoSerial, assinadoEm } = await assinarPdf(pdfBuffer, 'Prescrição com Assinatura — Teste')

await writeFile(path.join(saida, '0-prescricao-assinada.pdf'), buffer)

console.log(`\n✅ PDF assinado gerado: 0-prescricao-assinada.pdf`)
console.log(`   Serial do certificado: ${certificadoSerial}`)
console.log(`   Assinado em: ${assinadoEm.toLocaleString('pt-BR')}`)
console.log(`\n📌 OBSERVAÇÃO:`)
console.log(`   - Em modo desenvolvimento (sem certificado ICP-Brasil):`)
console.log(`     → Aparece banner amarelo "DEMO LOCAL" no topo`)
console.log(`     → PDF ainda contém metadados de assinatura`)
console.log(`   - Em produção (com certificado ICP-Brasil):`)
console.log(`     → Assinatura criptográfica válida legalmente`)
console.log(`     → PDF pode ser aberto em Adobe Reader e mostrar certificado`)
