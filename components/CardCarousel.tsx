'use client'
import { useState } from 'react'

type Card = {
  id: string
  name: string
  type: string
  bank?: string | null
  closingDay?: number | null
  limitAmount?: number | null
}

type Props = {
  cards: Card[]
  selectedCardId: string | null
  onSelect: (cardId: string | null) => void
  monthExpenses: Record<string, number>
}

const CARD_COLORS: Record<string, string> = {
  'itau-debito': 'from-blue-600 to-blue-800',
  'itau-credito': 'from-indigo-600 to-indigo-900',
  'santander-credito': 'from-red-600 to-red-900',
  'efectivo': 'from-green-600 to-green-900',
}

export default function CardCarousel({ cards, selectedCardId, onSelect, monthExpenses }: Props) {
  const [current, setCurrent] = useState(0)

  const ownerCards = cards.filter(c => c.id !== 'itau-infinite' && !c.name.includes('mamá'))

  const handlePrev = () => setCurrent(i => Math.max(0, i - 1))
  const handleNext = () => setCurrent(i => Math.min(ownerCards.length - 1, i + 1))

  const CardItem = ({ card, active }: { card: Card; active: boolean }) => {
    const spent = monthExpenses[card.id] ?? 0
    const gradient = CARD_COLORS[card.id] ?? 'from-gray-600 to-gray-800'
    const isSelected = selectedCardId === card.id
    return (
      <div
        onClick={() => onSelect(isSelected ? null : card.id)}
        className={`bg-gradient-to-br ${gradient} rounded-2xl p-4 cursor-pointer transition-all ${
          isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-950' : ''
        } ${active ? 'scale-100 opacity-100' : 'scale-95 opacity-60'}`}
      >
        <div className="text-xs text-white/70 mb-1">{card.bank ?? card.type}</div>
        <div className="font-semibold text-white">{card.name}</div>
        <div className="mt-3 text-white/80 text-sm">Gastado este mes</div>
        <div className="text-xl font-bold text-white">${spent.toLocaleString('es-UY')} UYU</div>
        {card.closingDay && (
          <div className="text-xs text-white/60 mt-1">Cierre: día {card.closingDay}</div>
        )}
      </div>
    )
  }

  return (
    <div>
      {/* Mobile: carousel */}
      <div className="md:hidden relative">
        <div className="overflow-hidden">
          <div
            className="flex transition-transform duration-300"
            style={{ transform: `translateX(-${current * 100}%)` }}
          >
            {ownerCards.map((card, i) => (
              <div key={card.id} className="w-full flex-shrink-0 px-4">
                <CardItem card={card} active={i === current} />
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-center gap-2 mt-3">
          {ownerCards.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`w-2 h-2 rounded-full transition-colors ${i === current ? 'bg-indigo-400' : 'bg-gray-600'}`}
            />
          ))}
        </div>
      </div>
      {/* Desktop: fila horizontal */}
      <div className="hidden md:grid grid-cols-3 xl:grid-cols-4 gap-3 px-4">
        {ownerCards.map(card => (
          <CardItem key={card.id} card={card} active={true} />
        ))}
      </div>
    </div>
  )
}
