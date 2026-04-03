'use client'
import { useState } from 'react'

type Card = { id: string; name: string }
type BalanceItem = { card: Card; expectedBalance: number; existing: any }

type Props = {
  items: BalanceItem[]
  month: number
  year: number
  onClose: () => void
}

export default function ReconciliationModal({ items, month, year, onClose }: Props) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const pending = items.filter(item => !item.existing)
  if (pending.length === 0) return null

  const handleSave = async (item: BalanceItem, status: 'confirmed' | 'cancelled') => {
    setSaving(true)
    const openingBalance = status === 'confirmed' ? parseFloat(values[item.card.id] || '0') : item.expectedBalance
    await fetch('/api/balances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardId: item.card.id, month, year, openingBalance, expectedBalance: item.expectedBalance, status }),
    })
    setSaving(false)
    onClose()
  }

  const item = pending[0]
  const inputValue = values[item.card.id] ?? ''
  const diff = inputValue ? parseFloat(inputValue) - item.expectedBalance : null

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center p-4 pb-24 md:pb-4">
      <div className="bg-gray-900 rounded-2xl w-full max-w-md p-6 overflow-y-auto max-h-[80vh]">
        <h2 className="text-lg font-bold mb-1">Reconciliación mensual</h2>
        <p className="text-gray-400 text-sm mb-4">{item.card.name}</p>
        <div className="bg-gray-800 rounded-xl p-4 mb-4">
          <div className="text-sm text-gray-400">Saldo esperado</div>
          <div className="text-xl font-bold">${item.expectedBalance.toLocaleString('es-UY')} UYU</div>
        </div>
        <label className="block text-sm text-gray-400 mb-1">¿Con cuánto arrancás?</label>
        <input
          type="number"
          value={inputValue}
          onChange={e => setValues(v => ({ ...v, [item.card.id]: e.target.value }))}
          className="w-full bg-gray-800 rounded-xl px-4 py-3 text-white text-lg font-bold mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="0"
        />
        {diff !== null && diff !== 0 && (
          <div className={`text-sm mb-4 ${diff < 0 ? 'text-red-400' : 'text-green-400'}`}>
            Diferencia: {diff > 0 ? '+' : ''}${diff.toLocaleString('es-UY')} UYU
          </div>
        )}
        <div className="flex gap-3">
          <button
            onClick={() => handleSave(item, 'confirmed')}
            disabled={saving}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl py-3 font-semibold"
          >
            ✅ Usar mi monto
          </button>
          <button
            onClick={() => handleSave(item, 'cancelled')}
            disabled={saving}
            className="flex-1 bg-gray-700 hover:bg-gray-600 rounded-xl py-3 font-semibold"
          >
            ❌ Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
