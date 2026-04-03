import { prisma } from './db'
import { sendMessage, sendWithConfirmButtons, answerCallbackQuery, editMessageText } from './telegram'
import { transcribeAudio, extractTransaction } from './openai'

// Almacenamiento de transacciones pendientes de confirmación
// DISEÑO INTENCIONAL: En Vercel serverless cada request es una función nueva (stateless).
// No podemos usar variables en memoria entre requests. Usamos NotificationLog como
// almacenamiento temporal persistente. Esto es simple y suficiente para uso personal
// (1 usuario, pocas transacciones simultáneas). Alternativa más robusta: Vercel KV/Redis.
async function savePendingTransaction(key: string, data: object) {
  // Reutilizamos NotificationLog como tabla de estado temporal
  await (prisma.notificationLog.create as any)({
    data: {
      type: 'cierre', // campo requerido por el schema, ignorar su semántica aquí
      message: JSON.stringify({ key, data }),
    },
  })
}

async function getPendingTransaction(callbackData: string) {
  const log = await prisma.notificationLog.findFirst({
    where: { message: { contains: `"key":"${callbackData}"` } },
    orderBy: { sentAt: 'desc' },
  })
  if (!log) return null
  const parsed = JSON.parse(log.message)
  return { logId: log.id, data: parsed.data }
}

async function deletePendingTransaction(logId: string) {
  await prisma.notificationLog.delete({ where: { id: logId } })
}

// Encuentra la tarjeta más probable según el hint de GPT
async function resolveCard(hint: string) {
  if (!hint) return null
  const cards = await prisma.card.findMany({ where: { isActive: true } })
  const lower = hint.toLowerCase()
  return cards.find(c =>
    c.name.toLowerCase().includes(lower) ||
    lower.includes(c.name.toLowerCase().split(' ')[0])
  ) ?? null
}

// Encuentra la categoría más probable según el hint de GPT
async function resolveCategory(hint: string, type: 'gasto' | 'ingreso') {
  const categories = await prisma.category.findMany({
    where: { type: type as any, isActive: true },
  })
  const lower = hint.toLowerCase()
  return (
    categories.find(c => c.name.toLowerCase().includes(lower)) ??
    categories.find(c => c.name === 'Otros') ??
    categories[0]
  )
}

export async function handleMessage(update: any) {
  const message = update.message
  if (!message) return

  // Ignorar mensajes de otros usuarios
  if (String(message.chat.id) !== process.env.TELEGRAM_CHAT_ID) return

  const text: string | null = message.text ?? null
  const voice = message.voice ?? null
  const audio = message.audio ?? null

  // Comandos
  if (text?.startsWith('/start')) {
    await sendMessage(
      `👋 ¡Hola! Soy tu bot de finanzas.\n\n` +
      `Podés enviarme:\n` +
      `• Un *audio* o *texto* describiendo un gasto o ingreso\n` +
      `• /comovenimos — resumen del mes actual\n` +
      `• /tarjetas — gastos por tarjeta este mes`
    )
    return
  }

  if (text?.startsWith('/comovenimos')) {
    await handleComoVenimos()
    return
  }

  if (text?.startsWith('/tarjetas')) {
    await handleTarjetas()
    return
  }

  // Mensaje de texto libre o audio
  let transcript: string

  if (voice || audio) {
    const fileId = voice?.file_id ?? audio?.file_id
    // Descargar el archivo de audio
    const fileRes = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`
    )
    const fileData = await fileRes.json()
    const filePath = fileData.result.file_path
    const audioRes = await fetch(
      `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${filePath}`
    )
    const audioBuffer = Buffer.from(await audioRes.arrayBuffer())
    transcript = await transcribeAudio(audioBuffer, 'audio.ogg')
  } else if (text) {
    transcript = text
  } else {
    return
  }

  const allCategories = await prisma.category.findMany({ where: { isActive: true } })
  const categoryNames = {
    gasto: allCategories.filter(c => c.type === 'gasto').map(c => c.name),
    ingreso: allCategories.filter(c => c.type === 'ingreso').map(c => c.name),
  }
  const extracted = await extractTransaction(transcript, categoryNames)

  if (extracted.confidence === 'low') {
    await sendMessage(
      `⚠️ No pude entender bien el monto o tipo de transacción.\nTranscripción: _"${transcript}"_\n\nIntentá de nuevo con más detalle.`
    )
    return
  }

  const card = await resolveCard(extracted.cardHint)
  const category = await resolveCategory(extracted.categoryHint, extracted.type)

  const montoStr = `$${extracted.amount.toLocaleString('es-UY')} ${extracted.currency}`
  const confirmKey = `${Date.now()}`

  const txDate = extracted.date ? new Date(extracted.date) : new Date()
  const pendingData = {
    amount: extracted.amount,
    currency: extracted.currency,
    type: extracted.type,
    categoryId: category?.id,
    cardId: card?.id,
    description: extracted.description,
    date: txDate.toISOString(),
    source: 'telegram',
  }

  // Guardar pendiente
  await savePendingTransaction(confirmKey, pendingData)

  const cardStr = card ? card.name : '❓ tarjeta no detectada'
  const catStr = category ? `${category.emoji ?? ''} ${category.name}` : '❓ categoría no detectada'
  const typeStr = extracted.type === 'gasto' ? '📤 Gasto' : '📥 Ingreso'
  const dateStr = txDate.toLocaleDateString('es-UY', { day: 'numeric', month: 'long', year: 'numeric' })

  await sendWithConfirmButtons(
    `${typeStr}: *${montoStr}*\nFecha: ${dateStr}\nCategoría: ${catStr}\nTarjeta: ${cardStr}\nDescripción: _${extracted.description}_\n\n¿Confirmo este registro?`,
    confirmKey
  )
}

export async function handleCallbackQuery(update: any) {
  const cbq = update.callback_query
  if (!cbq) return
  if (String(cbq.from.id) !== process.env.TELEGRAM_CHAT_ID) return

  const [action, key] = cbq.data.split(':')
  const pending = await getPendingTransaction(key)

  if (!pending) {
    await answerCallbackQuery(cbq.id, 'Transacción expirada')
    return
  }

  if (action === 'confirm') {
    await prisma.transaction.create({
      data: {
        ...pending.data,
        date: new Date(pending.data.date),
      },
    })

    // Verificar límite de tarjeta de crédito
    await checkAndNotifyLimit(pending.data.cardId)

    await answerCallbackQuery(cbq.id, '✅ Registrado')
    await editMessageText(cbq.message.chat.id, cbq.message.message_id, '✅ *Transacción registrada*')
  } else {
    await answerCallbackQuery(cbq.id, '❌ Cancelado')
    await editMessageText(cbq.message.chat.id, cbq.message.message_id, '❌ *Transacción cancelada*')
  }

  await deletePendingTransaction(pending.logId)
}

async function checkAndNotifyLimit(cardId: string) {
  if (!cardId) return
  const card = await prisma.card.findUnique({ where: { id: cardId } })
  if (!card?.limitAmount || card.type !== 'credito') return

  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0, 23, 59, 59)

  const agg = await prisma.transaction.aggregate({
    where: { cardId, type: 'gasto', date: { gte: start, lte: end } },
    _sum: { amount: true },
  })
  const total = agg._sum.amount ?? 0

  if (total > card.limitAmount) {
    await sendMessage(
      `⚠️ *Límite superado en ${card.name}*\nGastaste $${total.toLocaleString('es-UY')} UYU de un límite de $${card.limitAmount.toLocaleString('es-UY')} UYU.`
    )
  }
}

async function handleComoVenimos() {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0, 23, 59, 59)

  const transactions = await prisma.transaction.findMany({
    where: { date: { gte: start, lte: end } },
    include: { category: true },
  })

  const expenseMap: Record<string, { name: string; emoji: string | null; total: number }> = {}
  const incomeMap: Record<string, { name: string; emoji: string | null; total: number }> = {}

  for (const t of transactions) {
    const map = t.type === 'gasto' ? expenseMap : incomeMap
    if (!map[t.categoryId]) map[t.categoryId] = { name: t.category.name, emoji: t.category.emoji, total: 0 }
    map[t.categoryId].total += t.amount
  }

  const formatMap = (map: typeof expenseMap) =>
    Object.values(map)
      .sort((a, b) => b.total - a.total)
      .map(c => `${c.emoji ?? ''} ${c.name}: $${c.total.toLocaleString('es-UY')}`)
      .join('\n')

  const expenseLines = formatMap(expenseMap) || 'Sin gastos aún'
  const incomeLines = formatMap(incomeMap) || 'Sin ingresos aún'

  const monthName = new Date(year, month - 1).toLocaleString('es', { month: 'long', year: 'numeric' })
  await sendMessage(`📊 *¿Cómo venimos? — ${monthName}*\n\n*Gastos:*\n${expenseLines}\n\n*Ingresos:*\n${incomeLines}`)
}

async function handleTarjetas() {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0, 23, 59, 59)

  const cards = await prisma.card.findMany({ where: { isActive: true } })
  const lines: string[] = []

  for (const card of cards) {
    const agg = await prisma.transaction.aggregate({
      where: { cardId: card.id, type: 'gasto', date: { gte: start, lte: end } },
      _sum: { amount: true },
    })
    const total = agg._sum.amount ?? 0
    if (total > 0) {
      const limitStr = card.limitAmount ? ` / límite $${card.limitAmount.toLocaleString('es-UY')}` : ''
      lines.push(`💳 ${card.name}: $${total.toLocaleString('es-UY')} UYU${limitStr}`)
    }
  }

  const monthName = new Date(year, month - 1).toLocaleString('es', { month: 'long', year: 'numeric' })
  const text = lines.length > 0 ? lines.join('\n') : 'Sin gastos registrados este mes'
  await sendMessage(`💳 *Gastos por tarjeta — ${monthName}*\n\n${text}`)
}
