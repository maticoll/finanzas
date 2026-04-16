export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const cards = await prisma.card.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(cards)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const card = await prisma.card.create({
    data: { ...body, userId: session.user.id },
  })
  return NextResponse.json(card, { status: 201 })
}
