'use client'
import { useState } from 'react'
import CardCarousel from '@/components/CardCarousel'
import TransactionList from '@/components/TransactionList'
import ReconciliationModal from '@/components/ReconciliationModal'

export default function DashboardClient({ cards, transactions, totalExpenses, totalIncome, monthExpenses, balanceItems, month, year }: any) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [showReconciliation, setShowReconciliation] = useState(
    balanceItems?.some((b: any) => !b.existing) ?? false
  )

  const monthName = new Date(year, month - 1).toLocaleString('es', { month: 'long', year: 'numeric' })

  return (
    <div className="max-w-2xl mx-auto">
      {showReconciliation && balanceItems?.length > 0 && (
        <ReconciliationModal
          items={balanceItems}
          month={month}
          year={year}
          onClose={() => setShowReconciliation(false)}
        />
      )}
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <div className="text-sm text-gray-400 capitalize">{monthName}</div>
        <div className="flex gap-6 mt-2">
          <div>
            <div className="text-xs text-gray-500">Gastos</div>
            <div className="text-2xl font-bold text-red-400">-${totalExpenses.toLocaleString('es-UY')}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Ingresos</div>
            <div className="text-2xl font-bold text-green-400">+${totalIncome.toLocaleString('es-UY')}</div>
          </div>
        </div>
      </div>
      {/* Cards */}
      <CardCarousel cards={cards} selectedCardId={selectedCardId} onSelect={setSelectedCardId} monthExpenses={monthExpenses} />
      {/* Transactions */}
      <div className="mt-6">
        <div className="px-4 mb-2 flex items-center justify-between">
          <h2 className="font-semibold text-gray-300">Transacciones</h2>
          {selectedCardId && (
            <button onClick={() => setSelectedCardId(null)} className="text-xs text-indigo-400">
              Ver todas
            </button>
          )}
        </div>
        <TransactionList transactions={transactions} selectedCardId={selectedCardId} />
      </div>
    </div>
  )
}
