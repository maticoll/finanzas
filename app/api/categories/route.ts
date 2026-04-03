export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const categories = await prisma.category.findMany({
    where: { isActive: true, ...(type ? { type: type as any } : {}) },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(categories)
}

export async function POST(req: Request) {
  const body = await req.json()
  const category = await prisma.category.create({ data: body })
  return NextResponse.json(category, { status: 201 })
}
