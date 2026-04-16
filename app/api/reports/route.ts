export const dynamic = 'force-dynamic'
import { getMonthlyReport, getLast6MonthsSummary } from '@/lib/reports'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))

  const [monthly, last6] = await Promise.all([
    getMonthlyReport(month, year, session.user.id),
    getLast6MonthsSummary(session.user.id),
  ])

  return NextResponse.json({ monthly, last6 })
}
