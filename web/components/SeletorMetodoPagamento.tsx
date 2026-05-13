'use client'

import React from 'react'
import { trpc } from '../lib/trpc'

export type MetodoPagamento = 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD'

interface Props {
  precadastroId: number
  loading: boolean
  onSelect: (metodo: MetodoPagamento) => void
}

const CardIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
  </svg>
)

const PixIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
)

const METODOS: Array<{
  id: MetodoPagamento
  titulo: string
  descricao: string
  badge?: string
  Icone: () => React.ReactElement
}> = [
  { id: 'PIX', titulo: 'PIX', descricao: 'Aprovação imediata · QR Code na tela', badge: 'Recomendado', Icone: PixIcon },
  { id: 'CREDIT_CARD', titulo: 'Cartão de Crédito', descricao: 'Aprovação em segundos', Icone: CardIcon },
  { id: 'DEBIT_CARD', titulo: 'Cartão de Débito', descricao: 'Pagamento à vista', Icone: CardIcon },
]

export default function SeletorMetodoPagamento({ loading, onSelect }: Props) {
  const { data: valorData } = trpc.intake.consultarValor.useQuery()
  const valorFormatado = valorData?.valorFormatado ?? 'R$ 150,00'
  const metodosVisiveis = METODOS.filter(m => m.id !== 'DEBIT_CARD' || (valorData?.debitCardEnabled ?? false))

  return (
    <div className="min-h-screen bg-warm-bg flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <span className="inline-block bg-brand-pale text-brand text-xs font-semibold px-3 py-1 rounded-full mb-3">Pagamento</span>
          <h2 className="text-xl font-bold text-slate-800">Como deseja pagar?</h2>
          <div className="mt-3">
            <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Valor da consulta</p>
            <p className="text-3xl font-bold text-brand mt-0.5">{valorFormatado}</p>
          </div>
        </div>

        <div className="space-y-3">
          {metodosVisiveis.map(({ id, titulo, descricao, badge, Icone }) => (
            <button
              key={id}
              type="button"
              disabled={loading}
              onClick={() => onSelect(id)}
              className="w-full bg-brand-pale border-2 border-brand-light hover:border-brand rounded-2xl p-4 text-left transition-all group hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand-light rounded-xl flex items-center justify-center text-brand shrink-0 group-hover:bg-brand group-hover:text-white transition-colors">
                    <Icone />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 text-sm">{titulo}</div>
                    <div className="text-xs text-slate-500">{descricao}</div>
                  </div>
                </div>
                {badge && (
                  <span className="text-xs bg-sage-light text-sage px-2 py-0.5 rounded-full font-medium shrink-0">
                    {badge}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>

        {loading && (
          <p className="text-center text-sm text-slate-500 mt-5 flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-slate-200 border-t-brand rounded-full animate-spin inline-block" />
            Gerando pagamento…
          </p>
        )}
      </div>
    </div>
  )
}
