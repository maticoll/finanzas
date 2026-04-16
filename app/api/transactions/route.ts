export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const cardId = searchParams.get('cardId')
  const month = searchParams.get('month')
  const year = searchParams.get('year')
  const limit = parseInt(searchParams.get('limit') ?? '50')

  const where: any = { card: { userId: session.user.id } }
  if (cardId) where.cardId = cardId
  if (month && year) {
    const start = new Date(parseInt(year), parseInt(month) - 1, 1)
    const end = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59)
    where.date = { gte: start, lte: end }
  }

  const transactions = await prisma.transaction.findMany({
    where,
    include: { category: true, card: true },
    orderBy: { date: 'desc' },
    take: limit,
  })
  return NextResponse.json(transactions)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const transaction = await prisma.transaction.create({
    data: { ...body, date: new Date(body.date) },
    include: { category: true, card: true },
  })
  return NextResponse.json(transaction, { status: 201 })
}
