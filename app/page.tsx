import { prisma } from '@/lib/db'
import { auth } from '@/auth'
import DashboardClient from './DashboardClient'

export const revalidate = 0

export default async function DashboardPage() {
  const session = await auth()
  const userId = session!.user.id

  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0, 23, 59, 59)

  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year

  const [cards, transactions] = await Promise.all([
    prisma.card.findMany({ where: { isActive: true, userId }, orderBy: { createdAt: 'asc' } }),
    prisma.transaction.findMany({
      where: { date: { gte: start, lte: end }, card: { userId } },
      include: { category: true, card: true },
      orderBy: { date: 'desc' },
      take: 50,
    }),
  ])

  const debitCards = cards.filter(c => c.isOwner && c.type !== 'credito')
  const balances = await Promise.all(
    debitCards.map(async (card) => {
      const existing = await prisma.monthlyBalance.findUnique({
        where: { cardId_month_year: { cardId: card.id, month, year } },
      })
      const prevBalance = await prisma.monthlyBalance.findUnique({
        where: { cardId_month_year: { cardId: card.id, month: prevMonth, year: prevYear } },
      })
      const agg = await prisma.transaction.groupBy({
        by: ['type'],
        where: { cardId: card.id, currency: card.currency, date: { gte: start, lte: end } },
        _sum: { amount: true },
      })
      const monthExpensesCard = agg.find(a => a.type === 'gasto')?._sum.amount ?? 0
      const monthIncomeCard = agg.find(a => a.type === 'ingreso')?._sum.amount ?? 0
      const expectedBalance = (prevBalance?.openingBalance ?? 0) + monthIncomeCard - monthExpensesCard
      return { card, existing, expectedBalance }
    })
  )

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
