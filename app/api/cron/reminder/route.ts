export const dynamic = 'force-dynamic'
import { sendMessage } from '@/lib/telegram'
import { NextResponse } from 'next/server'

const MESSAGES = [
  '📝 Recordatorio: ¿anotaste tus gastos de las últimas horas?',
  '💸 ¿Compraste algo recién? No te olvides de registrarlo en la app.',
  '💰 Chequeo rápido: ¿hay gastos pendientes de anotar?',
  '🧾 Acordate de registrar tus gastos antes de que se te olviden.',
  '📱 Momento de revisar: ¿todo anotado en finanzas?',
]

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')?.replace('Bearer ', '')
  const querySecret = new URL(req.url).searchParams.get('secret')
  const secret = authHeader ?? querySecret
  if (secret !== process.env.CRON_SECRET) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)]
  await sendMessage(msg)

  return NextResponse.json({ ok: true })
}
