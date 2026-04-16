'use client'
import { useState } from 'react'

type Category = {
  id: string
  name: string
  type: 'gasto' | 'ingreso'
  emoji: string | null
  color: string | null
  isActive: boolean
}

export default function CategoriesClient({ initialCategories }: { initialCategories: Category[] }) {
  const [categories, setCategories] = useState(initialCategories)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', type: 'gasto' as 'gasto' | 'ingreso', emoji: '', color: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const reload = async () => {
    const res = await fetch('/api/categories')
    setCategories(await res.json())
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        type: form.type,
        emoji: form.emoji || null,
        color: form.color || null,
      }),
    })
    setLoading(false)
    if (!res.ok) {
      setError('Error al crear la categoría')
    } else {
      setForm({ name: '', type: 'gasto', emoji: '', color: '' })
      setAdding(false)
      reload()
    }
  }

  const toggle = async (id: string, isActive: boolean) => {
    await fetch(`/api/categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive }),
    })
    reload()
  }

  const gastos = categories.filter(c => c.type === 'gasto')
  const ingresos = categories.filter(c => c.type === 'ingreso')

  return (
    <div className="max-w-lg mx-auto p-4">
      <div className="flex items-center justify-between mb-6 pt-2">
        <h1 className="text-xl font-bold">Categorías</h1>
        <button
          onClick={() => setAdding(true)}
          className="bg-indigo-600 hover:bg-indigo-500 rounded-xl px-4 py-2 text-sm font-semibold"
        >
          + Crear categoría
        </button>
      </div>

      {adding && (
        <form onSubmit={handleCreate} className="bg-gray-800 rounded-2xl p-4 mb-6 space-y-3">
          <h3 className="font-semibold">Nueva categoría</h3>
          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div>
            <label className="block text-sm text-gray-400 mb-1">Nombre *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full bg-gray-700 rounded-xl px-3 py-2 text-white"
              placeholder="Ej: Alimentación"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Tipo *</label>
            <select
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))}
              className="w-full bg-gray-700 rounded-xl px-3 py-2 text-white"
            >
              <option value="gasto">Gasto</option>
              <option value="ingreso">Ingreso</option>
            </select>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm text-gray-400 mb-1">Emoji</label>
              <input
                type="text"
                value={form.emoji}
                onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))}
                className="w-full bg-gray-700 rounded-xl px-3 py-2 text-white"
                placeholder="🛒"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm text-gray-400 mb-1">Color</label>
              <input
                type="text"
                value={form.color}
                onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                className="w-full bg-gray-700 rounded-xl px-3 py-2 text-white"
                placeholder="#6366f1"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl py-2 text-sm font-semibold"
            >
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="px-4 py-2 rounded-xl text-sm text-gray-400 hover:text-white bg-gray-700"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {[{ label: 'Gastos', items: gastos }, { label: 'Ingresos', items: ingresos }].map(({ label, items }) => (
        <div key={label} className="mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">{label}</h2>
          <div className="space-y-2">
            {items.map(cat => (
              <div
                key={cat.id}
                className={`bg-gray-900 rounded-xl p-3 border border-gray-800 flex items-center justify-between ${!cat.isActive ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center gap-2">
                  {cat.emoji && <span>{cat.emoji}</span>}
                  <span className="font-medium">{cat.name}</span>
                </div>
                <button
                  onClick={() => toggle(cat.id, !cat.isActive)}
                  className="text-xs text-gray-500 hover:text-gray-300"
                >
                  {cat.isActive ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            ))}
            {items.length === 0 && (
              <p className="text-sm text-gray-600 py-2">Sin categorías de {label.toLowerCase()}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
