import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function transcribeAudio(audioBuffer: Buffer, filename: string): Promise<string> {
  const file = new File([new Uint8Array(audioBuffer)], filename, { type: 'audio/ogg' })
  const transcription = await openai.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    language: 'es',
  })
  return transcription.text
}

export interface ExtractedTransaction {
  type: 'gasto' | 'ingreso'
  amount: number
  currency: 'UYU' | 'USD'
  categoryHint: string
  cardHint: string
  description: string
  confidence: 'high' | 'low'
}

export async function extractTransaction(text: string, categoryNames?: { gasto: string[]; ingreso: string[] }): Promise<ExtractedTransaction> {
  const catHint = categoryNames
    ? `\nCategorías de gastos disponibles: ${categoryNames.gasto.join(', ')}\nCategorías de ingresos disponibles: ${categoryNames.ingreso.join(', ')}\nUsa EXACTAMENTE uno de esos nombres en categoryHint.`
    : ''

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `Eres un asistente que extrae información de transacciones financieras de mensajes en español (Uruguay).
        Devuelve SOLO un JSON con esta estructura:
        {
          "type": "gasto" | "ingreso",
          "amount": number,
          "currency": "UYU" | "USD",
          "categoryHint": string (nombre exacto de la categoría de la lista),
          "cardHint": string (nombre aproximado de la tarjeta o medio de pago, vacío si no se menciona),
          "description": string (descripción breve),
          "confidence": "high" | "low"
        }
        Si el monto no está claro, pon confidence: "low". Moneda por defecto: UYU.${catHint}`,
      },
      { role: 'user', content: text },
    ],
    response_format: { type: 'json_object' },
  })

  return JSON.parse(completion.choices[0].message.content!) as ExtractedTransaction
}
