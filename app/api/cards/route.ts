export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { resolveUserId, corsHeaders } from '@/lib/api-auth'

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) })
}

export async function GET(req: Request) {
  const userId = await resolveUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const cards = await prisma.card.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(cards, { headers: corsHeaders(req.headers.get('origin')) })
}

export async function POST(req: Request) {
  const userId = await resolveUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const card = await prisma.card.create({
    data: { ...body, userId },
  })
  return NextResponse.json(card, { status: 201, headers: corsHeaders(req.headers.get('origin')) })
}
