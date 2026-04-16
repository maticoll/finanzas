'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const DEFAULT_CATEGORIES = [
  { name: 'Alimentación / Supermercado', type: 'gasto', emoji: '🛒' },
  { name: 'Restaurantes / Delivery', type: 'gasto', emoji: '🍔' },
  { name: 'Transporte', type: 'gasto', emoji: '🚗' },
  { name: 'Salud / Farmacia', type: 'gasto', emoji: '💊' },
  { name: 'Entretenimiento / Salidas', type: 'gasto', emoji: '🎉' },
  { name: 'Ropa / Indumentaria', type: 'gasto', emoji: '👕' },
  { name: 'Servicios', type: 'gasto', emoji: '💡' },
  { name: 'Suscripciones', type: 'gasto', emoji: '📱' },
  { name: 'Otros', type: 'gasto', emoji: '📦' },
  { name: 'Sueldo', type: 'ingreso', emoji: '💼' },
  { name: 'Freelance', type: 'ingreso', emoji: '💻' },
  { name: 'Otros', type: 'ingreso', emoji: '💵' },
]

const CARD_TYPES = [
  { value: 'debito', label: 'Débito' },
  { value: 'credito', label: 'Crédito' },
  { value: 'efectivo', label: 'Efectivo' },
]

type CatRow = { name: string; type: string; emoji: string; checked: boolean }
type CardRow = { name: string; type: string; bank: string; currency: string }

export default function OnboardingClient() {
  const router = useRouter()
  const [step, setStep] = useState<'categorias' | 'tarjetas' | 'saving'>('categorias')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Categorías
  const [cats, setCats] = useState<CatRow[]>(
    DEFAULT_CATEGORIES.map(c => ({ ...c, checked: true }))
  )
  const [newCat, setNewCat] = useState({ name: '', type: 'gasto', emoji: '' })
  const [addingCat, setAddingCat] = useState(false)

  // Tarjetas
  const [cards, setCards] = useState<CardRow[]>([
    { name: '', type: 'debito', bank: '', currency: 'UYU' },
  ])

  const toggleCat = (i: number) =>
    setCats(prev => prev.map((c, idx) => idx === i ? { ...c, checked: !c.checked } : c))

  const addCustomCat = () => {
    if (!newCat.name.trim()) return
    setCats(prev => [...prev, { ...newCat, checked: true }])
    setNewCat({ name: '', type: 'gasto', emoji: '' })
    setAddingCat(false)
  }

  const updateCard = (i: number, field: keyof CardRow, val: string) =>
    setCards(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: val } : c))

  const addCard = () =>
    setCards(prev => [...prev, { name: '', type: 'debito', bank: '', currency: 'UYU' }])

  const removeCard = (i: number) =>
    setCards(prev => prev.filter((_, idx) => idx !== i))

  const handleFinish = async () => {
    setSaving(true)
    setError('')

    const selectedCats = cats.filter(c => c.checked && c.name.trim())
    const validCards = cards.filter(c => c.name.trim())

    if (validCards.length === 0) {
      setError('Agregá al menos una tarjeta o cuenta para continuar.')
      setSaving(false)
      return
    }

    try {
      // Crear categorías
      await Promise.all(
        selectedCats.map(cat =>
          fetch('/api/categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: cat.name, type: cat.type, emoji: cat.emoji || null }),
          })
        )
      )

      // Crear tarjetas
      await Promise.all(
        validCards.map(card =>
          fetch('/api/cards', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: card.name,
              type: card.type,
              bank: card.bank || null,
              currency: card.currency,
              isOwner: true,
            }),
          })
        )
      )

      router.push('/')
      router.refresh()
    } catch {
      setError('Error al guardar. Intentá de nuevo.')
      setSaving(false)
    }
  }

  if (step === 'categorias') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">🏷️</div>
            <h1 className="text-2xl font-bold text-white">Paso 1 de 2 — Categorías</h1>
            <p className="text-gray-400 text-sm mt-1">Elegí las categorías que vas a usar. Podés agregar más después.</p>
          </div>

          <div className="bg-gray-900 rounded-2xl p-4 space-y-2 mb-4 max-h-80 overflow-y-auto">
            {cats.map((cat, i) => (
              <label key={i} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cat.checked}
                  onChange={() => toggleCat(i)}
                  className="w-4 h-4 accent-indigo-500"
                />
                <span className="text-lg">{cat.emoji}</span>
                <span className="flex-1 text-sm">{cat.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${cat.type === 'gasto' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                  {cat.type}
                </span>
              </label>
            ))}
          </div>

          {addingCat ? (
            <div className="bg-gray-800 rounded-2xl p-4 mb-4 space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Emoji"
                  value={newCat.emoji}
                  onChange={e => setNewCat(f => ({ ...f, emoji: e.target.value }))}
                  className="w-14 bg-gray-700 rounded-xl px-2 py-2 text-white text-center"
                />
                <input
                  type="text"
                  placeholder="Nombre de la categoría"
                  value={newCat.name}
                  onChange={e => setNewCat(f => ({ ...f, name: e.target.value }))}
                  className="flex-1 bg-gray-700 rounded-xl px-3 py-2 text-white"
                />
                <select
                  value={newCat.type}
                  onChange={e => setNewCat(f => ({ ...f, type: e.target.value }))}
                  className="bg-gray-700 rounded-xl px-2 py-2 text-white text-sm"
                >
                  <option value="gasto">Gasto</option>
                  <option value="ingreso">Ingreso</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={addCustomCat} className="flex-1 bg-indigo-600 hover:bg-indigo-500 rounded-xl py-2 text-sm font-semibold">Agregar</button>
                <button onClick={() => setAddingCat(false)} className="px-4 py-2 rounded-xl text-sm text-gray-400 bg-gray-700">Cancelar</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingCat(true)}
              className="w-full mb-4 border border-dashed border-gray-700 rounded-xl py-2 text-sm text-gray-500 hover:text-gray-300 hover:border-gray-500"
            >
              + Agregar categoría personalizada
            </button>
          )}

          <button
            onClick={() => setStep('tarjetas')}
            className="w-full bg-indigo-600 hover:bg-indigo-500 rounded-xl py-3 font-semibold text-white"
          >
            Siguiente — Tarjetas →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">💳</div>
          <h1 className="text-2xl font-bold text-white">Paso 2 de 2 — Tarjetas</h1>
          <p className="text-gray-400 text-sm mt-1">Agregá tus tarjetas y cuentas. Podés editarlas después.</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm mb-4">
            {error}
          </div>
        )}

        <div className="space-y-3 mb-4">
          {cards.map((card, i) => (
            <div key={i} className="bg-gray-900 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-400">Tarjeta {i + 1}</span>
                {cards.length > 1 && (
                  <button onClick={() => removeCard(i)} className="text-xs text-gray-600 hover:text-red-400">Eliminar</button>
                )}
              </div>
              <input
                type="text"
                placeholder="Nombre (ej: Itaú Débito)"
                value={card.name}
                onChange={e => updateCard(i, 'name', e.target.value)}
                className="w-full bg-gray-800 rounded-xl px-3 py-2 text-white placeholder-gray-500"
              />
              <div className="flex gap-2">
                <select
                  value={card.type}
                  onChange={e => updateCard(i, 'type', e.target.value)}
                  className="flex-1 bg-gray-800 rounded-xl px-3 py-2 text-white"
                >
                  {CARD_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <select
                  value={card.currency}
                  onChange={e => updateCard(i, 'currency', e.target.value)}
                  className="w-24 bg-gray-800 rounded-xl px-3 py-2 text-white"
                >
                  <option value="UYU">UYU</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <input
                type="text"
                placeholder="Banco (opcional)"
                value={card.bank}
                onChange={e => updateCard(i, 'bank', e.target.value)}
                className="w-full bg-gray-800 rounded-xl px-3 py-2 text-white placeholder-gray-500"
              />
            </div>
          ))}
        </div>

        <button
          onClick={addCard}
          className="w-full mb-4 border border-dashed border-gray-700 rounded-xl py-2 text-sm text-gray-500 hover:text-gray-300 hover:border-gray-500"
        >
          + Agregar otra tarjeta
        </button>

        <div className="flex gap-3">
          <button
            onClick={() => setStep('categorias')}
            className="px-5 py-3 rounded-xl text-gray-400 bg-gray-800 hover:bg-gray-700 font-semibold"
          >
            ← Atrás
          </button>
          <button
            onClick={handleFinish}
            disabled={saving}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl py-3 font-semibold text-white"
          >
            {saving ? 'Guardando...' : '¡Listo! Ir al dashboard →'}
          </button>
        </div>
      </div>
    </div>
  )
}
