import { handleMessage, handleCallbackQuery } from '@/lib/bot-handlers'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const update = await req.json()
    if (update.message) await handleMessage(update)
    if (update.callback_query) await handleCallbackQuery(update)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Bot error:', error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
