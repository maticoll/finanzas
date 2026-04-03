import { prisma } from './db'

export async function getMonthlyReport(month: number, year: number) {
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0, 23, 59, 59)

  const transactions = await prisma.transaction.findMany({
    where: { date: { gte: start, lte: end } },
    include: { category: true, card: true },
  })

  // Gastos por categoría
  const expenseByCategory: Record<string, { name: string; emoji: string | null; color: string | null; total: number }> = {}
  // Ingresos por categoría
  const incomeByCategory: Record<string, { name: string; total: number }> = {}
  // Gastos por tarjeta
  const expenseByCard: Record<string, { name: string; total: number }> = {}
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
      if (!expenseByCategory[catId]) {
        expenseByCategory[catId] = { name: t.category.name, emoji: t.category.emoji, color: t.category.color, total: 0 }
      }
      expenseByCategory[catId].total += t.amount
      const cardId = t.cardId
      if (!expenseByCard[cardId]) expenseByCard[cardId] = { name: t.card.name, total: 0 }
      expenseByCard[cardId].total += t.amount
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

  return {
    totalExpenses,
    totalIncome,
    expenseByCategory: Object.values(expenseByCategory),
    incomeByCategory: Object.values(incomeByCategory),
    expenseByCard: Object.values(expenseByCard),
    topCategories,
    dailyBalance,
  }
}

export async function getLast6MonthsSummary() {
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
      where: { date: { gte: start, lte: end } },
      _sum: { amount: true },
    })
    const expenses = agg.find(a => a.type === 'gasto')?._sum.amount ?? 0
    const income = agg.find(a => a.type === 'ingreso')?._sum.amount ?? 0
    results.push({ month, year, label: `${d.toLocaleString('es', { month: 'short' })} ${year}`, expenses, income })
  }
  return results
}
