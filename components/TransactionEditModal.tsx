'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

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
  transaction: Transaction
  onClose: () => void
}

export default function TransactionEditModal({ transaction, onClose }: Props) {
  const router = useRouter()
  const [categories, setCategories] = useState<any[]>([])
  const [cards, setCards] = useState<any[]>([])
  const [form, setForm] = useState({
    amount: String(transaction.amount),
    type: transaction.type,
    categoryId: transaction.categoryId,
    cardId: transaction.cardId,
    description: transaction.description ?? '',
    date: transaction.date.slice(0, 10),
    currency: transaction.currency,
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/categories').then(r => r.json()),
      fetch('/api/cards').then(r => r.json()),
    ]).then(([cats, cds]) => {
      setCategories(cats)
      setCards(cds)
    })
  }, [])

  const filteredCategories = categories.filter((c: any) => c.type === form.type && c.isActive)

  const handleSave = async () => {
    setSaving(true)
    await fetch(`/api/transactions/${transaction.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: parseFloat(form.amount),
        type: form.type,
        categoryId: form.categoryId,
        cardId: form.cardId,
        description: form.description || null,
        date: form.date,
        currency: form.currency,
      }),
    })
    setSaving(false)
    onClose()
    router.refresh()
  }

  const handleDelete = async () => {
    if (!confirm('¿Eliminar esta transacción?')) return
    setDeleting(true)
    await fetch(`/api/transactions/${transaction.id}`, { method: 'DELETE' })
    setDeleting(false)
    onClose()
    router.refresh()
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end md:items-center justify-center p-4 pb-6 md:pb-4">
      <div className="bg-gray-900 rounded-2xl w-full max-w-md p-5 overflow-y-auto max-h-[85vh]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Editar transacción</h2>
          <button onClick={onClose} className="text-gray-400 text-2xl leading-none">&times;</button>
        </div>

        {/* Tipo */}
        <div className="flex gap-2 mb-4">
          {(['gasto', 'ingreso'] as const).map(t => (
            <button
              key={t}
              onClick={() => setForm(f => ({ ...f, type: t, categoryId: '' }))}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold ${form.type === t ? (t === 'gasto' ? 'bg-red-600' : 'bg-green-600') : 'bg-gray-800 text-gray-400'}`}
            >
              {t === 'gasto' ? '📤 Gasto' : '📥 Ingreso'}
            </button>
          ))}
        </div>

        {/* Monto */}
        <label className="block text-xs text-gray-400 mb-1">Monto</label>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            inputMode="decimal"
            value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
            className="flex-1 bg-gray-800 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <select
            value={form.currency}
            onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
            className="bg-gray-800 rounded-xl px-3 py-3 text-white focus:outline-none"
          >
            <option value="UYU">UYU</option>
            <option value="USD">USD</option>
          </select>
        </div>

        {/* Fecha */}
        <label className="block text-xs text-gray-400 mb-1">Fecha</label>
        <input
          type="date"
          value={form.date}
          onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
          className="w-full bg-gray-800 rounded-xl px-4 py-3 text-white mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        {/* Categoría */}
        <label className="block text-xs text-gray-400 mb-1">Categoría</label>
        <select
          value={form.categoryId}
          onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}
          className="w-full bg-gray-800 rounded-xl px-4 py-3 text-white mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {filteredCategories.map((c: any) => (
            <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
          ))}
        </select>

        {/* Tarjeta */}
        <label className="block text-xs text-gray-400 mb-1">Tarjeta / Medio de pago</label>
        <select
          value={form.cardId}
          onChange={e => setForm(f => ({ ...f, cardId: e.target.value }))}
          className="w-full bg-gray-800 rounded-xl px-4 py-3 text-white mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {cards.filter((c: any) => c.isActive).map((c: any) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* Descripción */}
        <label className="block text-xs text-gray-400 mb-1">Descripción</label>
        <input
          type="text"
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          className="w-full bg-gray-800 rounded-xl px-4 py-3 text-white mb-5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Opcional"
        />

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving || !form.amount}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl py-3 font-semibold"
          >
            {saving ? 'Guardando...' : '✅ Guardar'}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="bg-red-800 hover:bg-red-700 disabled:opacity-50 rounded-xl px-4 py-3 font-semibold"
          >
            🗑
          </button>
        </div>
      </div>
    </div>
  )
}
