export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { PDFParse } from 'pdf-parse'

const openai = new OpenAI()
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(req: Request) {
  // 1. Parsear form data
  const formData = await req.formData()
  const cardId = formData.get('cardId') as string | null
  const file = formData.get('file') as File | null

  if (!cardId || !file) {
    return NextResponse.json({ error: 'Faltan campos requeridos: cardId y file' }, { status: 400 })
  }

  // 2. Validar que la tarjeta existe
  const card = await prisma.card.findUnique({ where: { id: cardId } })
  if (!card) {
    return NextResponse.json({ error: 'Tarjeta no encontrada' }, { status: 400 })
  }

  // 3. Validar tamaño del archivo
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'El archivo no puede superar 10MB' }, { status: 400 })
  }

  // 4. Extraer texto del PDF
  const buffer = Buffer.from(await file.arrayBuffer())
  let pdfText: string
  try {
    const parser = new PDFParse({ data: buffer })
    const result = await parser.getText()
    pdfText = result.text?.trim() ?? ''
  } catch {
    return NextResponse.json({ error: 'No se pudo leer el PDF. Asegurate de subir un archivo PDF válido.' }, { status: 400 })
  }

  if (!pdfText) {
    return NextResponse.json({ error: 'Este PDF no tiene texto extraíble. Asegurate de subir un PDF digital, no escaneado.' }, { status: 400 })
  }

  // 5. Fetch categorías de gasto activas
  const categories = await prisma.category.findMany({
    where: { isActive: true, type: 'gasto' },
    select: { id: true, name: true },
  })
  const otrosCategory = categories.find(c => c.name.toLowerCase().includes('otros'))
  const otrosCategoryId = otrosCategory?.id ?? categories[0]?.id
  const categoryList = categories.map(c => `${c.id}: ${c.name}`).join('\n')
  const validCategoryIds = new Set(categories.map(c => c.id))

  // 6. Llamar a GPT
  const systemPrompt = `Eres un asistente que extrae transacciones de extractos bancarios del banco Itaú Uruguay.

El extracto tiene una tabla con columnas: Fecha | Tarjeta | Detalle | Importe origen | Importe $ | Importe U$S

Formato de fecha en el extracto: DD MM YY (ejemplo: "02 03 26" = 2 de marzo de 2026)
Los montos usan coma como separador decimal (ejemplo: "3.675,00" = 3675.00)
Si la fila tiene valor en "Importe $" la moneda es UYU; si tiene valor en "Importe U$S" la moneda es USD.

Extrae SOLO las filas que representan gastos reales del usuario y devuelve un JSON array con este formato exacto:
[
  {
    "date": "YYYY-MM-DD",
    "amount": 1234.56,
    "currency": "UYU",
    "description": "descripción de la transacción",
    "categoryId": "<id de la categoría más apropiada>"
  }
]

EXCLUIR completamente estas filas (no son gastos):
- PAGOS (pagos realizados a la tarjeta)
- SALDO DEL ESTADO DE CUENTA ANTERIOR
- SALDO CONTADO
- INTERESES COMPENSATORIOS
- INTERESES MORATORIOS
- SEGURO DE VIDA SOBRE SALDO
- Cualquier fila de resumen, millas, o texto informativo

Reglas adicionales:
- amount: número positivo mayor a 0, sin comas (usar punto decimal)
- categoryId: elegir el más apropiado de esta lista:
${categoryList}
- Si no hay categoría clara, usar el categoryId de "Otros"
- Responde SOLO con el JSON array, sin texto adicional, sin markdown, sin explicaciones`

  let rawContent: string
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Texto del extracto:\n${pdfText}` },
      ],
    })
    rawContent = completion.choices[0]?.message?.content ?? ''
  } catch (err) {
    console.error('OpenAI error:', err)
    return NextResponse.json({ error: 'Error al conectar con OpenAI. Intentá de nuevo.' }, { status: 500 })
  }

  // 7. Parsear JSON (con retry)
  let transactions: Array<{ date: string; amount: number; currency: string; description: string; categoryId: string }>
  try {
    transactions = JSON.parse(rawContent)
  } catch {
    // Retry: segunda llamada pidiendo solo JSON
    try {
      const retryCompletion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Responde ÚNICAMENTE con un JSON array válido, sin texto, sin markdown, sin explicaciones. El formato debe ser exactamente: [{"date":"YYYY-MM-DD","amount":0.0,"currency":"UYU","description":"...","categoryId":"..."}]. Si no hay transacciones, responde: []',
          },
          { role: 'user', content: rawContent },
        ],
      })
      const retryContent = retryCompletion.choices[0]?.message?.content ?? ''
      transactions = JSON.parse(retryContent)
    } catch {
      return NextResponse.json({ error: 'No se pudo procesar el extracto. Intentá de nuevo.' }, { status: 500 })
    }
  }

  if (!Array.isArray(transactions)) {
    return NextResponse.json({ error: 'No se pudo procesar el extracto. Intentá de nuevo.' }, { status: 500 })
  }

  // 8. Insertar transacciones (con detección de duplicados)
  let saved = 0
  let skipped = 0

  for (const tx of transactions) {
    // Validar campos básicos
    if (!tx.date || !tx.amount || typeof tx.amount !== 'number' || tx.amount <= 0) {
      skipped++
      continue
    }

    // Sanitizar currency
    const currency = ['UYU', 'USD'].includes(tx.currency) ? tx.currency : 'UYU'

    // Validar categoryId
    const categoryId = validCategoryIds.has(tx.categoryId) ? tx.categoryId : otrosCategoryId
    if (!categoryId) {
      skipped++
      continue
    }

    // Parsear fecha
    const txDate = new Date(tx.date)
    if (isNaN(txDate.getTime())) {
      skipped++
      continue
    }

    // Detectar duplicados
    const duplicate = await prisma.transaction.findFirst({
      where: {
        cardId,
        amount: tx.amount,
        date: {
          gte: new Date(txDate.getTime() - 86400000),
          lte: new Date(txDate.getTime() + 86400000),
        },
      },
    })

    if (duplicate) {
      skipped++
      continue
    }

    // Insertar
    await prisma.transaction.create({
      data: {
        amount: tx.amount,
        currency,
        type: 'gasto',
        categoryId,
        cardId,
        description: tx.description ?? null,
        source: 'extracto',
        date: txDate,
      },
    })
    saved++
  }

  return NextResponse.json({ saved, skipped })
}
