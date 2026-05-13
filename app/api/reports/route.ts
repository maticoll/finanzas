export const dynamic = 'force-dynamic'
import { getMonthlyReport, getLast6MonthsSummary } from '@/lib/reports'
import { NextResponse } from 'next/server'
import { resolveUserId, corsHeaders } from '@/lib/api-auth'

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) })
}

export async function GET(req: Request) {
  const userId = await resolveUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))

  const [monthly, last6] = await Promise.all([
    getMonthlyReport(month, year, userId),
    getLast6MonthsSummary(userId),
  ])

  return NextResponse.json({ monthly, last6 }, { headers: corsHeaders(req.headers.get('origin')) })
}
