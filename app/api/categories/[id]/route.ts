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
  const category = await prisma.category.update({
    where: { id, userId },
    data: body,
  })
  return NextResponse.json(category, { headers: corsHeaders(req.headers.get('origin')) })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await resolveUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await prisma.category.update({
    where: { id, userId },
    data: { isActive: false },
  })
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) })
}
