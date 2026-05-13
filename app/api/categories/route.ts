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

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')

  const categories = await prisma.category.findMany({
    where: {
      userId,
      isActive: true,
      ...(type ? { type: type as any } : {}),
    },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(categories, { headers: corsHeaders(req.headers.get('origin')) })
}

export async function POST(req: Request) {
  const userId = await resolveUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const category = await prisma.category.create({
    data: { ...body, userId },
  })
  return NextResponse.json(category, { status: 201, headers: corsHeaders(req.headers.get('origin')) })
}
