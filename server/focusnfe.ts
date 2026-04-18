import { env } from './_core/env.ts'
import { db } from './db.ts'
import { nfseRegistros } from '../drizzle/schema.ts'
import { eq } from 'drizzle-orm'

const BASE_URL = env.FOCUSNFE_ENVIRONMENT === 'producao'
  ? 'https://api.focusnfe.com.br'
  : 'https://homologacao.focusnfe.com.br'

const TOKEN = env.FOCUSNFE_ENVIRONMENT === 'producao'
  ? env.FOCUSNFE_TOKEN_PRODUCAO
  : env.FOCUSNFE_TOKEN_HOMOLOGACAO

interface DadosNfse {
  pacienteId: number
  nomeCliente: string
  valorCentavos: number
  descricaoServico?: string
}

export async function emitirNfse(dados: DadosNfse): Promise<void> {
  const valorReais = dados.valorCentavos / 100
  const refNfse = `fp-${dados.pacienteId}-${Date.now()}`

  // Registrar como pendente
  const [result] = await db.insert(nfseRegistros).values({
    pacienteId: dados.pacienteId,
    status: 'enviando',
    valorCentavos: dados.valorCentavos,
    focusnfeRef: refNfse,
  })

  const registroId = (result as { insertId: number }).insertId

  try {
    const payload = {
      data_emissao: new Date().toISOString(),
      natureza_operacao: 1,
      optante_simples_nacional: 1,
      prestador: {
        cnpj: process.env.CNPJ_PRESTADOR ?? '',
        inscricao_municipal: process.env.INSCRICAO_MUNICIPAL ?? '',
        codigo_municipio: process.env.CODIGO_MUNICIPIO ?? '3550308',
      },
      tomador: {
        razao_social: dados.nomeCliente,
        email: '',
      },
      itens: [
        {
          descricao: dados.descricaoServico ?? 'Consulta médica — PrEP',
          quantidade: 1,
          valor_unitario: valorReais,
          valor_total: valorReais,
          item_lista_servico: '0401',
          codigo_tributario_municipio: '0401',
          aliquota_iss: 0.02,
        },
      ],
    }

    const response = await fetch(`${BASE_URL}/v2/nfses?ref=${refNfse}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(TOKEN + ':').toString('base64')}`,
      },
      body: JSON.stringify(payload),
    })

    const responseData = (await response.json()) as { status?: string; numero?: string; mensagem_sefaz?: string }

    await db.update(nfseRegistros)
      .set({
        status: response.ok ? 'emitido' : 'erro',
        numeroNfse: responseData.numero,
        erroDescricao: response.ok ? null : responseData.mensagem_sefaz,
        emitidoEm: response.ok ? new Date() : null,
      })
      .where(eq(nfseRegistros.id, registroId))
  } catch (err) {
    await db.update(nfseRegistros)
      .set({ status: 'erro', erroDescricao: (err as Error).message })
      .where(eq(nfseRegistros.id, registroId))
    throw err
  }
}
