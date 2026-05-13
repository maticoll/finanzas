export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { resolveUserId, corsHeaders } from '@/lib/api-auth'

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) })
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await resolveUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const card = await prisma.card.update({
    where: { id, userId },
    data: body,
  })
  return NextResponse.json(card, { headers: corsHeaders(req.headers.get('origin')) })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await resolveUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await prisma.card.delete({ where: { id, userId } })
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) })
}
