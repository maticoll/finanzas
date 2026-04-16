import { prisma } from './db'

export async function getMonthlyReport(month: number, year: number, userId: string) {
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0, 23, 59, 59)

  const transactions = await prisma.transaction.findMany({
    where: { date: { gte: start, lte: end }, card: { userId } },
    include: { category: true, card: true },
  })

  // Gastos por categoría
  const expenseByCategory: Record<string, { name: string; emoji: string | null; color: string | null; total: number; currency: string }> = {}
  // Ingresos por categoría
  const incomeByCategory: Record<string, { name: string; total: number }> = {}
  // Gastos por tarjeta
  const expenseByCard: Record<string, { name: string; total: number; currency: string }> = {}
  // Total gastos e ingresos
  let totalExpenses = 0
  let totalIncome = 0
  // Evolución diaria del saldo (para línea)
  const dailyBalance: Record<string, number> = {}

  for (const t of transactions) {
    const dayKey = t.date.toISOString().split('T')[0]
    if (t.type === 'gasto') {
      totalExpenses += t.amount
      const catId = t.categoryId
      const catKey = `${catId}_${t.currency}`
      if (!expenseByCategory[catKey]) {
        expenseByCategory[catKey] = { name: t.category.name, emoji: t.category.emoji, color: t.category.color, total: 0, currency: t.currency }
      }
      expenseByCategory[catKey].total += t.amount
      const cardId = t.cardId
      const cardKey = `${cardId}_${t.currency}`
      if (!expenseByCard[cardKey]) expenseByCard[cardKey] = { name: t.card.name, total: 0, currency: t.currency }
      expenseByCard[cardKey].total += t.amount
      dailyBalance[dayKey] = (dailyBalance[dayKey] ?? 0) - t.amount
    } else {
      totalIncome += t.amount
      const catId = t.categoryId
      if (!incomeByCategory[catId]) incomeByCategory[catId] = { name: t.category.name, total: 0 }
      incomeByCategory[catId].total += t.amount
      dailyBalance[dayKey] = (dailyBalance[dayKey] ?? 0) + t.amount
    }
  }

  // Top 5 categorías de gasto
  const topCategories = Object.values(expenseByCategory)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  // Opening balance: suma de saldos de apertura del mes anterior para tarjetas de débito UYU del usuario
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const prevBalances = await prisma.monthlyBalance.findMany({
    where: { month: prevMonth, year: prevYear, card: { userId } },
    include: { card: true },
  })
  const openingBalance = prevBalances
    .filter(b => b.card.type !== 'credito' && b.card.currency === 'UYU')
    .reduce((sum, b) => sum + b.openingBalance, 0)

  return {
    totalExpenses,
    totalIncome,
    expenseByCategory: Object.values(expenseByCategory),
    incomeByCategory: Object.values(incomeByCategory),
    expenseByCard: Object.values(expenseByCard),
    topCategories,
    dailyBalance,
    openingBalance,
  }
}

export async function getLast6MonthsSummary(userId: string) {
  const results = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const month = d.getMonth() + 1
    const year = d.getFullYear()
    const start = new Date(year, month - 1, 1)
    const end = new Date(year, month, 0, 23, 59, 59)
    const agg = await prisma.transaction.groupBy({
      by: ['type'],
      where: { date: { gte: start, lte: end }, card: { userId } },
      _sum: { amount: true },
    })
    const expenses = agg.find(a => a.type === 'gasto')?._sum.amount ?? 0
    const income = agg.find(a => a.type === 'ingreso')?._sum.amount ?? 0
    results.push({ month, year, label: `${d.toLocaleString('es', { month: 'short' })} ${year}`, expenses, income })
  }
  return results
}
