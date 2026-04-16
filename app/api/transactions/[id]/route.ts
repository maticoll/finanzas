export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const transaction = await prisma.transaction.update({
    where: { id },
    data: { ...body, ...(body.date ? { date: new Date(body.date) } : {}) },
    include: { category: true, card: true },
  })
  return NextResponse.json(transaction)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await prisma.transaction.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
