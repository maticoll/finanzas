'use client'
import { useState } from 'react'
import CardForm from '@/components/CardForm'

export default function CardsClient({ initialCards }: { initialCards: any[] }) {
  const [cards, setCards] = useState(initialCards)
  const [editing, setEditing] = useState<any | null>(null)
  const [adding, setAdding] = useState(false)

  const reload = async () => {
    const res = await fetch('/api/cards')
    setCards(await res.json())
    setEditing(null)
    setAdding(false)
  }

  const toggle = async (id: string, isActive: boolean) => {
    await fetch(`/api/cards/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive }) })
    reload()
  }

  return (
    <div className="max-w-lg mx-auto p-4">
      <div className="flex items-center justify-between mb-6 pt-2">
        <h1 className="text-xl font-bold">Tarjetas</h1>
        <button onClick={() => setAdding(true)} className="bg-indigo-600 hover:bg-indigo-500 rounded-xl px-4 py-2 text-sm font-semibold">
          + Agregar
        </button>
      </div>
      {adding && (
        <div className="bg-gray-800 rounded-2xl p-4 mb-4">
          <h3 className="font-semibold mb-3">Nueva tarjeta</h3>
          <CardForm onSave={reload} onCancel={() => setAdding(false)} />
        </div>
      )}
      <div className="space-y-3">
        {cards.map(card => (
          <div key={card.id} className={`bg-gray-900 rounded-2xl p-4 border border-gray-800 ${!card.isActive ? 'opacity-50' : ''}`}>
            {editing?.id === card.id ? (
              <CardForm card={editing} onSave={reload} onCancel={() => setEditing(null)} />
            ) : (
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold">{card.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {card.bank} · {card.type}
                    {card.closingDay && ` · Cierre día ${card.closingDay}`}
                    {card.dueDay && ` · Vence día ${card.dueDay}`}
                    {card.limitAmount && ` · Límite $${card.limitAmount.toLocaleString('es-UY')}`}
                  </div>
                  {!card.isOwner && <span className="text-xs text-yellow-500">Tarjeta de mamá</span>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEditing(card)} className="text-xs text-indigo-400 hover:text-indigo-300">Editar</button>
                  <button onClick={() => toggle(card.id, !card.isActive)} className="text-xs text-gray-500 hover:text-gray-300">
                    {card.isActive ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
