import { prisma } from '@/lib/db'
import { sendMessage } from '@/lib/telegram'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  // Verificar secret (acepta header o query param para compatibilidad con plan Hobby de Vercel)
  const authHeader = req.headers.get('authorization')?.replace('Bearer ', '')
  const querySecret = new URL(req.url).searchParams.get('secret')
  const secret = authHeader ?? querySecret
  if (secret !== process.env.CRON_SECRET) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowDay = tomorrow.getDate()

  const month = now.getMonth() + 1
  const year = now.getFullYear()

  // 1. Cierre de tarjeta mañana
  const closingCards = await prisma.card.findMany({
    where: { closingDay: tomorrowDay, isActive: true, isOwner: true },
  })
  for (const card of closingCards) {
    // Evitar duplicados: verificar si ya se envió hoy
    const alreadySent = await prisma.notificationLog.findFirst({
      where: {
        type: 'cierre',
        cardId: card.id,
        sentAt: { gte: new Date(now.setHours(0, 0, 0, 0)) },
      },
    })
    if (alreadySent) continue

    const agg = await prisma.transaction.aggregate({
      where: { cardId: card.id, type: 'gasto', date: { gte: new Date(year, month - 1, 1), lte: new Date(year, month, 0, 23, 59, 59) } },
      _sum: { amount: true },
    })
    const total = agg._sum.amount ?? 0
    const msg = `🔔 *Cierre mañana: ${card.name}*\nTotal gastado este mes: $${total.toLocaleString('es-UY')} UYU`
    await sendMessage(msg)
    await prisma.notificationLog.create({ data: { type: 'cierre', cardId: card.id, message: msg } })
  }

  // 2. Límites superados (chequeo diario)
  const creditCards = await prisma.card.findMany({
    where: { type: 'credito', isActive: true, isOwner: true, limitAmount: { not: null } },
  })
  for (const card of creditCards) {
    const agg = await prisma.transaction.aggregate({
      where: { cardId: card.id, type: 'gasto', date: { gte: new Date(year, month - 1, 1), lte: new Date(year, month, 0, 23, 59, 59) } },
      _sum: { amount: true },
    })
    const total = agg._sum.amount ?? 0
    if (total > card.limitAmount!) {
      const alreadySent = await prisma.notificationLog.findFirst({
        where: { type: 'limite', cardId: card.id, sentAt: { gte: new Date(now.setHours(0, 0, 0, 0)) } },
      })
      if (alreadySent) continue
      const msg = `⚠️ *Límite superado: ${card.name}*\n$${total.toLocaleString('es-UY')} / $${card.limitAmount!.toLocaleString('es-UY')} UYU`
      await sendMessage(msg)
      await prisma.notificationLog.create({ data: { type: 'limite', cardId: card.id, message: msg } })
    }
  }

  // 3. Recordatorio reconciliación (día 1 de cada mes)
  if (now.getDate() === 1) {
    const alreadySent = await prisma.notificationLog.findFirst({
      where: { type: 'reconciliacion', sentAt: { gte: new Date(now.setHours(0, 0, 0, 0)) } },
    })
    if (!alreadySent) {
      const msg = `📅 Mes nuevo, ¿anotaste tu reconciliación mensual?`
      await sendMessage(msg)
      await prisma.notificationLog.create({ data: { type: 'reconciliacion', message: msg } })
    }
  }

  return NextResponse.json({ ok: true, processed: { closingCards: closingCards.length } })
}
