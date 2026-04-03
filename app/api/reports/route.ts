export const dynamic = 'force-dynamic'
import { getMonthlyReport, getLast6MonthsSummary } from '@/lib/reports'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))

  const [monthly, last6] = await Promise.all([
    getMonthlyReport(month, year),
    getLast6MonthsSummary(),
  ])

  return NextResponse.json({ monthly, last6 })
}
