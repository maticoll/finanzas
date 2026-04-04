'use client'
import { useState } from 'react'
import TransactionEditModal from './TransactionEditModal'

type Transaction = {
  id: string
  amount: number
  currency: string
  type: string
  date: string
  description?: string | null
  cardId: string
  categoryId: string
  category: { name: string; emoji?: string | null }
  card: { name: string }
}

type Props = {
  transactions: Transaction[]
  selectedCardId: string | null
}

export default function TransactionList({ transactions, selectedCardId }: Props) {
  const [editing, setEditing] = useState<Transaction | null>(null)

  const filtered = selectedCardId
    ? transactions.filter(t => t.cardId === selectedCardId)
    : transactions

  if (filtered.length === 0) {
    return (
      <div className="text-center text-gray-500 py-12">
        Sin transacciones este mes
      </div>
    )
  }

  return (
    <>
      {editing && (
        <TransactionEditModal
          transaction={editing}
          onClose={() => setEditing(null)}
        />
      )}
      <div className="divide-y divide-gray-800">
        {filtered.map(t => {
          const isGasto = t.type === 'gasto'
          const date = new Date(t.date)
          const dateStr = date.toLocaleDateString('es-UY', { day: 'numeric', month: 'short' })
          return (
            <button
              key={t.id}
              onClick={() => setEditing(t)}
              className="w-full flex items-center gap-3 py-3 px-4 hover:bg-gray-800/50 active:bg-gray-800 transition-colors text-left"
            >
              <div className="text-2xl">{t.category.emoji ?? '💸'}</div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">
                  {t.description ?? t.category.name}
                </div>
                <div className="text-xs text-gray-500">
                  {t.category.name} · {t.card.name}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <div className={`font-semibold text-sm ${isGasto ? 'text-red-400' : 'text-green-400'}`}>
                  {isGasto ? '-' : '+'}${t.amount.toLocaleString('es-UY')} {t.currency}
                </div>
                <div className="text-xs text-gray-400">{dateStr}</div>
              </div>
            </button>
          )
        })}
      </div>
    </>
  )
}
