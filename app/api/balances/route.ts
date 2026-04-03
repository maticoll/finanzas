import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))

  // Solo tarjetas propias que no son crédito
  const cards = await prisma.card.findMany({
    where: { isOwner: true, isActive: true, type: { not: 'credito' } },
  })

  const balances = await Promise.all(
    cards.map(async (card) => {
      const existing = await prisma.monthlyBalance.findUnique({
        where: { cardId_month_year: { cardId: card.id, month, year } },
      })

      // Calcular saldo esperado
      const prevMonth = month === 1 ? 12 : month - 1
      const prevYear = month === 1 ? year - 1 : year
      const prevBalance = await prisma.monthlyBalance.findUnique({
        where: { cardId_month_year: { cardId: card.id, month: prevMonth, year: prevYear } },
      })

      const start = new Date(year, month - 1, 1)
      const end = new Date(year, month, 0, 23, 59, 59)
      const agg = await prisma.transaction.groupBy({
        by: ['type'],
        where: { cardId: card.id, date: { gte: start, lte: end } },
        _sum: { amount: true },
      })
      const monthExpenses = agg.find(a => a.type === 'gasto')?._sum.amount ?? 0
      const monthIncome = agg.find(a => a.type === 'ingreso')?._sum.amount ?? 0
      const prevOpeningBalance = prevBalance?.openingBalance ?? 0
      const expectedBalance = prevOpeningBalance + monthIncome - monthExpenses

      return { card, existing, expectedBalance }
    })
  )

  return NextResponse.json(balances)
}

export async function POST(req: Request) {
  const body = await req.json()
  // body: { cardId, month, year, openingBalance, status }
  const { cardId, month, year, openingBalance, status } = body
  const expectedBalance = body.expectedBalance ?? 0
  const difference = openingBalance - expectedBalance

  const balance = await prisma.monthlyBalance.upsert({
    where: { cardId_month_year: { cardId, month, year } },
    update: { openingBalance, expectedBalance, difference, status },
    create: { cardId, month, year, openingBalance, expectedBalance, difference, status },
  })
  return NextResponse.json(balance, { status: 201 })
}
