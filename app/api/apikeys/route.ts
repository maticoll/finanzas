export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { randomBytes } from 'crypto'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const keys = await prisma.apiKey.findMany({
    where: { userId: session.user.id },
    select: { id: true, name: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(keys)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name } = await req.json()
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const key = `fin_${randomBytes(32).toString('hex')}`
  const apiKey = await prisma.apiKey.create({
    data: { userId: session.user.id, name, key },
  })

  // Only time the full key is returned
  return NextResponse.json({ id: apiKey.id, name: apiKey.name, key, createdAt: apiKey.createdAt }, { status: 201 })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  await prisma.apiKey.deleteMany({ where: { id, userId: session.user.id } })
  return new NextResponse(null, { status: 204 })
}
