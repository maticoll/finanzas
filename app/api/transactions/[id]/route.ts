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
  const transaction = await prisma.transaction.update({
    where: { id, card: { userId } },
    data: { ...body, ...(body.date ? { date: new Date(body.date) } : {}) },
    include: { category: true, card: true },
  })
  return NextResponse.json(transaction, { headers: corsHeaders(req.headers.get('origin')) })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await resolveUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await prisma.transaction.delete({ where: { id, card: { userId } } })
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) })
}
