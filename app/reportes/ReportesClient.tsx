'use client'
import { useState, useEffect } from 'react'
import MonthSelector from '@/components/MonthSelector'
import ExpensePieChart from '@/components/charts/ExpensePieChart'
import MonthlyBarChart from '@/components/charts/MonthlyBarChart'
import BalanceLine from '@/components/charts/BalanceLine'
import CardSummary from '@/components/charts/CardSummary'
import TopCategories from '@/components/charts/TopCategories'

export default function ReportesClient({ initialMonth, initialYear }: { initialMonth: number; initialYear: number }) {
  const [month, setMonth] = useState(initialMonth)
  const [year, setYear] = useState(initialYear)
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    fetch(`/api/reports?month=${month}&year=${year}`)
      .then(r => r.json())
      .then(setData)
  }, [month, year])

  const section = (title: string, children: React.ReactNode) => (
    <div className="bg-gray-900 rounded-2xl p-4 mb-4">
      <h3 className="font-semibold text-gray-300 mb-3">{title}</h3>
      {children}
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto">
      <MonthSelector month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y) }} />
      {!data ? (
        <div className="text-center text-gray-500 py-12">Cargando...</div>
      ) : (
        <div className="px-4 pb-6">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-gray-900 rounded-2xl p-4">
              <div className="text-xs text-gray-500">Gastos</div>
              <div className="text-xl font-bold text-red-400">${data.monthly.totalExpenses.toLocaleString('es-UY')}</div>
            </div>
            <div className="bg-gray-900 rounded-2xl p-4">
              <div className="text-xs text-gray-500">Ingresos</div>
              <div className="text-xl font-bold text-green-400">${data.monthly.totalIncome.toLocaleString('es-UY')}</div>
            </div>
          </div>
          {section('Gastos por categoría', <ExpensePieChart data={data.monthly.expenseByCategory} />)}
          {section('Evolución del saldo', <BalanceLine data={data.monthly.dailyBalance} openingBalance={data.monthly.openingBalance} />)}
          {section('Top 5 categorías', <TopCategories data={data.monthly.topCategories} />)}
          {section('Por tarjeta', <CardSummary data={data.monthly.expenseByCard} />)}
          {section('Últimos 6 meses', <MonthlyBarChart data={data.last6} />)}
        </div>
      )}
    </div>
  )
}
