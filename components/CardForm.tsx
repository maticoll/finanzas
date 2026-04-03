'use client'
import { useState } from 'react'

type Card = {
  id?: string; name: string; type: string; bank?: string | null;
  closingDay?: number | null; dueDay?: number | null;
  limitAmount?: number | null; isOwner?: boolean
}

type Props = { card?: Card; onSave: () => void; onCancel: () => void }

export default function CardForm({ card, onSave, onCancel }: Props) {
  const [form, setForm] = useState<Card>(card ?? { name: '', type: 'debito', isOwner: true })
  const [saving, setSaving] = useState(false)

  const set = (key: keyof Card, val: any) => setForm(f => ({ ...f, [key]: val }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    if (card?.id) {
      await fetch(`/api/cards/${card.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    } else {
      await fetch('/api/cards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    }
    setSaving(false)
    onSave()
  }

  const inputClass = 'w-full bg-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm'

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input required placeholder="Nombre de la tarjeta" value={form.name} onChange={e => set('name', e.target.value)} className={inputClass} />
      <select value={form.type} onChange={e => set('type', e.target.value)} className={inputClass}>
        <option value="credito">Crédito</option>
        <option value="debito">Débito</option>
        <option value="efectivo">Efectivo</option>
      </select>
      <input placeholder="Banco" value={form.bank ?? ''} onChange={e => set('bank', e.target.value)} className={inputClass} />
      <div className="flex gap-2">
        <input type="number" placeholder="Día cierre" value={form.closingDay ?? ''} onChange={e => set('closingDay', e.target.value ? parseInt(e.target.value) : null)} className={inputClass} min="1" max="31" />
        <input type="number" placeholder="Día vencimiento" value={form.dueDay ?? ''} onChange={e => set('dueDay', e.target.value ? parseInt(e.target.value) : null)} className={inputClass} min="1" max="31" />
      </div>
      <input type="number" placeholder="Límite de alerta (UYU)" value={form.limitAmount ?? ''} onChange={e => set('limitAmount', e.target.value ? parseFloat(e.target.value) : null)} className={inputClass} />
      <label className="flex items-center gap-2 text-sm text-gray-400">
        <input type="checkbox" checked={form.isOwner} onChange={e => set('isOwner', e.target.checked)} className="rounded" />
        Es mi tarjeta (no de mamá)
      </label>
      <div className="flex gap-2 pt-2">
        <button type="submit" disabled={saving} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl py-2.5 font-semibold text-sm">
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
        <button type="button" onClick={onCancel} className="flex-1 bg-gray-700 hover:bg-gray-600 rounded-xl py-2.5 font-semibold text-sm">
          Cancelar
        </button>
      </div>
    </form>
  )
}
