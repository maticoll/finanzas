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
  const [index, setIndex] = useState(0)
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  if (items.length === 0) return null

  const item = items[index]
  const inputValue = values[item.card.id] ?? (item.existing ? String(item.existing.openingBalance) : String(item.expectedBalance))
  const diff = inputValue !== '' ? parseFloat(inputValue) - item.expectedBalance : null

  const goNext = () => {
    if (index + 1 < items.length) setIndex(i => i + 1)
    else onClose()
  }

  const handleSave = async () => {
    if (!inputValue) return
    const cleaned = inputValue.replace(/\./g, '').replace(',', '.')
    const amount = parseFloat(cleaned)
    if (isNaN(amount)) return
    setSaving(true)
    await fetch('/api/balances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cardId: item.card.id,
        month,
        year,
        openingBalance: amount,
        expectedBalance: item.expectedBalance,
        status: 'confirmed',
      }),
    })
    setSaving(false)
    goNext()
  }

  const handleSkip = () => goNext()

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center p-4 pb-24 md:pb-4">
      <div className="bg-gray-900 rounded-2xl w-full max-w-md p-6 overflow-y-auto max-h-[80vh]">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold">Reconciliación mensual</h2>
          {items.length > 1 && (
            <span className="text-xs text-gray-500">{index + 1} / {items.length}</span>
          )}
        </div>
        <p className="text-gray-400 text-sm mb-4">{item.card.name}</p>
        <div className="bg-gray-800 rounded-xl p-4 mb-4">
          <div className="text-sm text-gray-400">Saldo esperado</div>
          <div className="text-xl font-bold">${item.expectedBalance.toLocaleString('es-UY')} UYU</div>
        </div>
        <label className="block text-sm text-gray-400 mb-1">¿Con cuánto arrancás este mes?</label>
        <input
          type="text"
          inputMode="decimal"
          value={inputValue}
          onChange={e => setValues(v => ({ ...v, [item.card.id]: e.target.value }))}
          className="w-full bg-gray-800 rounded-xl px-4 py-3 text-white text-lg font-bold mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="0"
          autoFocus
        />
        {diff !== null && diff !== 0 && (
          <div className={`text-sm mb-4 ${diff < 0 ? 'text-red-400' : 'text-green-400'}`}>
            Diferencia: {diff > 0 ? '+' : ''}${diff.toLocaleString('es-UY')} UYU
          </div>
        )}
        {diff === 0 && inputValue !== '' && (
          <div className="text-sm mb-4 text-green-400">¡Coincide con el esperado!</div>
        )}
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={!inputValue || saving}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl py-3 font-semibold"
          >
            ✅ Guardar
          </button>
          <button
            onClick={handleSkip}
            disabled={saving}
            className="flex-1 bg-gray-700 hover:bg-gray-600 rounded-xl py-3 font-semibold"
          >
            Saltar
          </button>
        </div>
      </div>
    </div>
  )
}
