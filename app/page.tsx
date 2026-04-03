import { prisma } from '@/lib/db'
import DashboardClient from './DashboardClient'

export const revalidate = 0

export default async function DashboardPage() {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0, 23, 59, 59)

  const [cards, transactions, balances] = await Promise.all([
    prisma.card.findMany({ where: { isActive: true }, orderBy: { createdAt: 'asc' } }),
    prisma.transaction.findMany({
      where: { date: { gte: start, lte: end } },
      include: { category: true, card: true },
      orderBy: { date: 'desc' },
      take: 50,
    }),
    fetch(`${process.env.NEXT_PUBLIC_URL ?? 'http://localhost:3000'}/api/balances?month=${month}&year=${year}`, { cache: 'no-store' })
      .then(r => r.json()).catch(() => []),
  ])

  const totalExpenses = transactions.filter(t => t.type === 'gasto').reduce((s, t) => s + t.amount, 0)
  const totalIncome = transactions.filter(t => t.type === 'ingreso').reduce((s, t) => s + t.amount, 0)

  const monthExpenses: Record<string, number> = {}
  for (const t of transactions.filter(t => t.type === 'gasto')) {
    monthExpenses[t.cardId] = (monthExpenses[t.cardId] ?? 0) + t.amount
  }

  return (
    <DashboardClient
      cards={cards}
      transactions={transactions.map(t => ({ ...t, date: t.date.toISOString() }))}
      totalExpenses={totalExpenses}
      totalIncome={totalIncome}
      monthExpenses={monthExpenses}
      balanceItems={balances}
      month={month}
      year={year}
    />
  )
}
