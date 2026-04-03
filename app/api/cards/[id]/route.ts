import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const card = await prisma.card.update({ where: { id }, data: body })
  return NextResponse.json(card)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.card.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
