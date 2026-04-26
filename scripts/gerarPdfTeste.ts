import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

// Simula variáveis de ambiente para o teste
process.env.APP_URL = 'https://facilitaprep.com.br'
process.env.MEDICO_NOME = 'Dr. Werciley Saraiva Vieira Junior'
process.env.MEDICO_CRM = '12345/DF'
process.env.NODE_ENV = 'development'

const { gerarPrescricaoPdf, gerarFormularioPdf } = await import('../server/pdfSigner.ts')
const { gerarPedidosExames } = await import('../server/pdfExameRequest.ts')

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

const pacienteCompleto = {
  nome: 'João da Silva Santos',
  cpf: '123.456.789-00',
  dataNascimento: '1990-05-15',
  sexo: 'Masculino',
  nomeSocial: null,
  corRaca: 'Parda',
  escolaridade: 'Superior completo',
  situacaoConjugal: 'Solteiro',
  email: 'joao@email.com',
  telefone: '(61) 99999-0000',
  cep: '70040-010',
  logradouro: 'SQN 310 Bloco A',
  numero: 'Ap 101',
  complemento: null,
  bairro: 'Asa Norte',
  cidade: 'Brasília',
  estado: 'DF',
  tipoAtendimento: 'Particular',
  convenio: null,
  condutaJson: {
    relacoesSexuais: { tipos: ['Anal receptivo', 'Anal insertivo'], frequencia: 'Semanal', parceirosUltimos6Meses: 3, usaPreservativo: 'Às vezes' },
    historicoDst: false,
    prepAnterior: false,
    usoDrogas: false,
  },
  prescricaoJson: {
    medicamento: 'tenofovir_emtricitabina',
    posologia: '1 comprimido ao dia, por via oral',
    duracao: '180 dias (renovável)',
    observacoes: 'Tomar preferencialmente com alimentos.',
  },
}

console.log('Gerando PDFs de teste...')

const [prescricao, formulario, pedidos] = await Promise.all([
  gerarPrescricaoPdf(paciente as never),
  gerarFormularioPdf(pacienteCompleto),
  gerarPedidosExames('primeiro_atendimento', 'João da Silva Santos'),
])

await Promise.all([
  writeFile(path.join(saida, '1-prescricao.pdf'), prescricao),
  writeFile(path.join(saida, '2-formulario.pdf'), formulario),
  writeFile(path.join(saida, '3-pedido-completo.pdf'), pedidos.completo),
  writeFile(path.join(saida, '4-pedido-ist.pdf'), pedidos.ist),
  writeFile(path.join(saida, '5-pedido-hiv.pdf'), pedidos.hiv),
  writeFile(path.join(saida, '6-pedido-densitometria.pdf'), pedidos.densitometria),
])

console.log(`\nPDFs gerados em: ${saida}`)
console.log('  1-prescricao.pdf         — Receita médica')
console.log('  2-formulario.pdf         — Formulário clínico PrEP')
console.log('  3-pedido-completo.pdf    — Pedido de exames (49 exames)')
console.log('  4-pedido-ist.pdf         — Sorológicos de IST (26 exames)')
console.log('  5-pedido-hiv.pdf         — Anti-HIV isolado')
console.log('  6-pedido-densitometria.pdf — Densitometria óssea')
