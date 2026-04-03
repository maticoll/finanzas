'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Card = { id: string; name: string; type: string }
type Category = { id: string; name: string; emoji?: string | null; type: string }

type Props = { cards: Card[]; categories: Category[] }

export default function TransactionForm({ cards, categories }: Props) {
  const router = useRouter()
  const [type, setType] = useState<'gasto' | 'ingreso'>('gasto')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('UYU')
  const [categoryId, setCategoryId] = useState('')
  const [cardId, setCardId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  const filteredCategories = categories.filter(c => c.type === type)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || !categoryId || !cardId) return
    setSaving(true)
    await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: parseFloat(amount), currency, type, categoryId, cardId, date, description: description || null, source: 'manual' }),
    })
    setSaving(false)
    router.push('/')
    router.refresh()
  }

  const inputClass = 'w-full bg-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500'

  return (
    <form onSubmit={handleSubmit} className="p-4 max-w-lg mx-auto space-y-4">
      <h1 className="text-xl font-bold pt-2">Nueva transacción</h1>
      {/* Tipo */}
      <div className="flex gap-2">
        {(['gasto', 'ingreso'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => { setType(t); setCategoryId('') }}
            className={`flex-1 py-3 rounded-xl font-semibold capitalize transition-colors ${
              type === t
                ? t === 'gasto' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
                : 'bg-gray-800 text-gray-400'
            }`}
          >
            {t === 'gasto' ? '📤 Gasto' : '📥 Ingreso'}
          </button>
        ))}
      </div>
      {/* Monto + moneda */}
      <div className="flex gap-2">
        <input type="number" placeholder="Monto" value={amount} onChange={e => setAmount(e.target.value)} className={`${inputClass} flex-1`} required min="0" step="0.01" />
        <select value={currency} onChange={e => setCurrency(e.target.value)} className="bg-gray-800 rounded-xl px-3 py-3 text-white focus:outline-none">
          <option value="UYU">UYU</option>
          <option value="USD">USD</option>
        </select>
      </div>
      {/* Categoría */}
      <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className={inputClass} required>
        <option value="">Seleccionar categoría</option>
        {filteredCategories.map(c => (
          <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
        ))}
      </select>
      {/* Tarjeta */}
      <select value={cardId} onChange={e => setCardId(e.target.value)} className={inputClass} required>
        <option value="">Seleccionar tarjeta</option>
        {cards.filter(c => c.id !== 'itau-infinite').map(c => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      {/* Fecha */}
      <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputClass} required />
      {/* Descripción */}
      <input type="text" placeholder="Descripción (opcional)" value={description} onChange={e => setDescription(e.target.value)} className={inputClass} />
      <button type="submit" disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl py-4 font-bold text-lg">
        {saving ? 'Guardando...' : 'Guardar'}
      </button>
    </form>
  )
}
