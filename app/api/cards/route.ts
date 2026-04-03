export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const cards = await prisma.card.findMany({ orderBy: { createdAt: 'asc' } })
  return NextResponse.json(cards)
}

export async function POST(req: Request) {
  const body = await req.json()
  const card = await prisma.card.create({ data: body })
  return NextResponse.json(card, { status: 201 })
}
