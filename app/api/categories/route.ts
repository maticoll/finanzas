export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')

  const categories = await prisma.category.findMany({
    where: {
      userId: session.user.id,
      isActive: true,
      ...(type ? { type: type as any } : {}),
    },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(categories)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const category = await prisma.category.create({
    data: { ...body, userId: session.user.id },
  })
  return NextResponse.json(category, { status: 201 })
}
