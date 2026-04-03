import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const category = await prisma.category.update({ where: { id }, data: body })
  return NextResponse.json(category)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // Soft delete
  await prisma.category.update({ where: { id }, data: { isActive: false } })
  return new NextResponse(null, { status: 204 })
}
