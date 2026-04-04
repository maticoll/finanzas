'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import CardCarousel from '@/components/CardCarousel'
import TransactionList from '@/components/TransactionList'
import ReconciliationModal from '@/components/ReconciliationModal'

export default function DashboardClient({ cards, transactions, totalExpenses, totalIncome, monthExpenses, balanceItems, month, year }: any) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [showReconciliation, setShowReconciliation] = useState(
    balanceItems?.some((b: any) => !b.existing) ?? false
  )
  const router = useRouter()

  const handleRefresh = async () => {
    setRefreshing(true)
    router.refresh()
    setTimeout(() => setRefreshing(false), 800)
  }

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
        <div className="flex items-start justify-between">
          <div className="text-sm text-gray-400 capitalize">{monthName}</div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-gray-500 hover:text-gray-300 transition-colors p-1 -mt-1"
            aria-label="Recargar"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18" height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={refreshing ? 'animate-spin' : ''}
            >
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
          </button>
        </div>
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
      <CardCarousel
        cards={cards}
        selectedCardId={selectedCardId}
        onSelect={setSelectedCardId}
        monthExpenses={monthExpenses}
        debitBalances={Object.fromEntries(
          (balanceItems ?? [])
            .filter((b: any) => b.card.type !== 'credito')
            .map((b: any) => [b.card.id, b.expectedBalance])
        )}
      />
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
