# Finanzas App — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir una app web de finanzas personales con bot de Telegram que transcribe audios, registra gastos/ingresos, envía notificaciones de tarjetas y muestra reportes visuales mensuales.

**Architecture:** Next.js App Router con API routes como backend, Neon Postgres vía Prisma como base de datos, bot de Telegram via webhook apuntando a una API route de Vercel, y Vercel Cron Jobs para notificaciones programadas.

**Tech Stack:** Next.js 14, Prisma, Neon Postgres, Telegram Bot API, OpenAI (Whisper + GPT-4o-mini), Recharts, Tailwind CSS, Vercel

**Spec:** `docs/superpowers/specs/2026-04-02-finanzas-design.md`

---

## Mapa de Archivos

```
/app
  layout.tsx                  Root layout: bottom nav (mobile), sidebar (PC)
  page.tsx                    Dashboard: balance, card carousel, transactions
  /transacciones/nueva/page.tsx  Formulario manual de nueva transacción
  /reportes/page.tsx           Reportes mensuales con selector de mes
  /tarjetas/page.tsx           Gestión de tarjetas (CRUD)
  /api/bot/route.ts            Webhook Telegram (POST)
  /api/cron/route.ts           Cron diario: cierres, límites, recordatorio
  /api/transactions/route.ts   GET list + POST create
  /api/transactions/[id]/route.ts  PUT + DELETE
  /api/cards/route.ts          GET list + POST create
  /api/cards/[id]/route.ts     PUT + DELETE
  /api/categories/route.ts     GET list + POST create
  /api/categories/[id]/route.ts  PUT + DELETE
  /api/balances/route.ts       GET list + POST upsert reconciliación
  /api/reports/route.ts        GET datos agregados para un mes

/components
  BottomNav.tsx               Barra inferior mobile, oculta en desktop
  CardCarousel.tsx            Swipeable en mobile, fila horizontal en desktop
  TransactionList.tsx         Lista de transacciones con filtro por tarjeta
  TransactionForm.tsx         Formulario: tipo, monto, moneda, categoría, tarjeta, fecha
  CardForm.tsx                Modal para agregar/editar tarjeta
  MonthSelector.tsx           Selector mes con botones ← →
  ReconciliationModal.tsx     Modal de reconciliación al inicio de mes
  charts/ExpensePieChart.tsx  Pie chart gastos por categoría
  charts/MonthlyBarChart.tsx  Barras gastos vs ingresos últimos 6 meses
  charts/BalanceLine.tsx      Línea evolución saldo del mes
  charts/CardSummary.tsx      Tabla resumen por tarjeta
  charts/TopCategories.tsx    Top 5 categorías

/lib
  db.ts                       Prisma client singleton
  openai.ts                   transcribeAudio(buffer) + extractTransaction(text)
  telegram.ts                 sendMessage(), sendWithButtons(), sendText()
  bot-handlers.ts             handleMessage(), handleCallbackQuery()
  reports.ts                  getMonthlyReport(month, year) — lógica de agregación

/prisma
  schema.prisma               Modelos: Card, Category, Transaction, MonthlyBalance, NotificationLog
  seed.ts                     Seed tarjetas y categorías iniciales
```

---

## Task 1: Inicializar Proyecto Next.js

**Files:**
- Create: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `.env.local`, `.env.example`, `.gitignore`, `next.config.ts`

- [ ] **Paso 1: Crear app Next.js**

```bash
cd "C:/Users/Usuario/OneDrive/Desktop/CLAUDIO/Finanzas"
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*" --yes
```

- [ ] **Paso 2: Instalar dependencias**

```bash
npm install prisma @prisma/client recharts @types/recharts
npm install openai node-telegram-bot-api
npm install -D @types/node-telegram-bot-api
```

- [ ] **Paso 3: Crear `.env.local`**

```env
DATABASE_URL=postgresql://...  # completar con Neon
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
OPENAI_API_KEY=
CRON_SECRET=mi-secret-seguro-aqui
```

- [ ] **Paso 4: Crear `.env.example`**

```env
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
TELEGRAM_CHAT_ID=123456789
OPENAI_API_KEY=sk-...
CRON_SECRET=change-me
```

- [ ] **Paso 5: Actualizar `.gitignore`** — verificar que `.env.local` esté incluido (create-next-app ya lo hace)

- [ ] **Paso 6: Inicializar Prisma**

```bash
npx prisma init
```

- [ ] **Paso 7: Commit**

```bash
git init
git add -A
git commit -m "chore: inicializar proyecto Next.js con Prisma y dependencias"
```

---

## Task 2: Schema de Base de Datos

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/seed.ts`

- [ ] **Paso 1: Escribir schema Prisma**

Reemplazar `prisma/schema.prisma` con:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Card {
  id                  String    @id @default(cuid())
  name                String
  type                CardType
  bank                String?
  closingDay          Int?
  dueDay              Int?
  limitAmount         Float?
  currency            String    @default("UYU")
  isActive            Boolean   @default(true)
  isOwner             Boolean   @default(true)
  linkedPaymentCardId String?
  linkedPaymentCard   Card?     @relation("LinkedCard", fields: [linkedPaymentCardId], references: [id])
  linkedCards         Card[]    @relation("LinkedCard")
  transactions        Transaction[]
  monthlyBalances     MonthlyBalance[]
  notificationLogs    NotificationLog[]
  createdAt           DateTime  @default(now())
}

enum CardType {
  credito
  debito
  efectivo
}

model Category {
  id           String          @id @default(cuid())
  name         String
  type         TransactionType
  emoji        String?
  color        String?
  isActive     Boolean         @default(true)
  transactions Transaction[]
  createdAt    DateTime        @default(now())
}

model Transaction {
  id          String          @id @default(cuid())
  amount      Float
  currency    String          @default("UYU")
  type        TransactionType
  categoryId  String
  category    Category        @relation(fields: [categoryId], references: [id])
  cardId      String
  card        Card            @relation(fields: [cardId], references: [id])
  description String?
  source      Source          @default(manual)
  date        DateTime
  createdAt   DateTime        @default(now())
}

enum TransactionType {
  gasto
  ingreso
}

enum Source {
  manual
  telegram
}

model MonthlyBalance {
  id              String                @id @default(cuid())
  cardId          String
  card            Card                  @relation(fields: [cardId], references: [id])
  month           Int
  year            Int
  expectedBalance Float
  openingBalance  Float
  difference      Float
  status          ReconciliationStatus
  recordedAt      DateTime              @default(now())

  @@unique([cardId, month, year])
}

enum ReconciliationStatus {
  confirmed
  cancelled
}

model NotificationLog {
  id        String           @id @default(cuid())
  type      NotificationType
  cardId    String?
  card      Card?            @relation(fields: [cardId], references: [id])
  message   String
  sentAt    DateTime         @default(now())
}

enum NotificationType {
  cierre
  limite
  reconciliacion
}
```

- [ ] **Paso 2: Verificar que `DATABASE_URL` esté configurado en `.env.local`** con la URL de Neon Postgres (crear proyecto en neon.tech si no existe)

- [ ] **Paso 3: Correr migración**

```bash
npx prisma migrate dev --name init
```

Resultado esperado: "Your database is now in sync with your schema."

- [ ] **Paso 4: Crear `prisma/seed.ts`**

```typescript
import { PrismaClient, CardType, TransactionType } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Tarjetas
  const itauDebito = await prisma.card.upsert({
    where: { id: 'itau-debito' },
    update: {},
    create: {
      id: 'itau-debito',
      name: 'Itaú Débito',
      type: CardType.debito,
      bank: 'Itaú',
      isOwner: true,
    },
  })

  const santander = await prisma.card.upsert({
    where: { id: 'santander-credito' },
    update: {},
    create: {
      id: 'santander-credito',
      name: 'Santander Crédito',
      type: CardType.credito,
      bank: 'Santander',
      closingDay: 28,
      limitAmount: 10000,
      currency: 'UYU',
      isOwner: true,
      linkedPaymentCardId: itauDebito.id,
    },
  })

  const itauCredito = await prisma.card.upsert({
    where: { id: 'itau-credito' },
    update: {},
    create: {
      id: 'itau-credito',
      name: 'Itaú Crédito',
      type: CardType.credito,
      bank: 'Itaú',
      closingDay: 3,
      dueDay: 16,
      limitAmount: 10000,
      currency: 'UYU',
      isOwner: true,
      linkedPaymentCardId: itauDebito.id,
    },
  })

  await prisma.card.upsert({
    where: { id: 'itau-infinite' },
    update: {},
    create: {
      id: 'itau-infinite',
      name: 'Itaú Infinite Extension',
      type: CardType.credito,
      bank: 'Itaú',
      isOwner: false,
    },
  })

  await prisma.card.upsert({
    where: { id: 'itau-pb-debito-mama' },
    update: {},
    create: {
      id: 'itau-pb-debito-mama',
      name: 'Itaú PB Débito (mamá)',
      type: CardType.debito,
      bank: 'Itaú',
      isOwner: false,
    },
  })

  await prisma.card.upsert({
    where: { id: 'itau-pb-credito-mama' },
    update: {},
    create: {
      id: 'itau-pb-credito-mama',
      name: 'Itaú PB Crédito (mamá)',
      type: CardType.credito,
      bank: 'Itaú',
      isOwner: false,
    },
  })

  await prisma.card.upsert({
    where: { id: 'amex-mama' },
    update: {},
    create: {
      id: 'amex-mama',
      name: 'Amex (mamá)',
      type: CardType.credito,
      bank: 'Amex',
      isOwner: false,
    },
  })

  await prisma.card.upsert({
    where: { id: 'efectivo' },
    update: {},
    create: {
      id: 'efectivo',
      name: 'Efectivo',
      type: CardType.efectivo,
      isOwner: true,
    },
  })

  // Categorías de gastos
  const gastoCategories = [
    { id: 'cat-supermercado', name: 'Alimentación / Supermercado', emoji: '🛒', color: '#22c55e' },
    { id: 'cat-delivery', name: 'Restaurantes / Delivery', emoji: '🍕', color: '#f97316' },
    { id: 'cat-transporte', name: 'Transporte', emoji: '🚗', color: '#3b82f6' },
    { id: 'cat-salud', name: 'Salud / Farmacia', emoji: '💊', color: '#ec4899' },
    { id: 'cat-entretenimiento', name: 'Entretenimiento / Salidas', emoji: '🎉', color: '#a855f7' },
    { id: 'cat-ropa', name: 'Ropa / Indumentaria', emoji: '👕', color: '#14b8a6' },
    { id: 'cat-servicios', name: 'Servicios', emoji: '💡', color: '#eab308' },
    { id: 'cat-educacion', name: 'Educación', emoji: '📚', color: '#6366f1' },
    { id: 'cat-viajes', name: 'Viajes / Turismo', emoji: '✈️', color: '#0ea5e9' },
    { id: 'cat-hogar', name: 'Hogar / Muebles', emoji: '🏠', color: '#78716c' },
    { id: 'cat-suscripciones', name: 'Suscripciones', emoji: '📱', color: '#64748b' },
    { id: 'cat-stock-vapes', name: 'Stock Vapes', emoji: '💨', color: '#8b5cf6' },
    { id: 'cat-pago-itau', name: 'Pago tarjeta crédito Itaú', emoji: '💳', color: '#1d4ed8' },
    { id: 'cat-pago-santander', name: 'Pago tarjeta crédito Santander', emoji: '💳', color: '#dc2626' },
    { id: 'cat-otros-gasto', name: 'Otros', emoji: '📦', color: '#94a3b8' },
  ]

  for (const cat of gastoCategories) {
    await prisma.category.upsert({
      where: { id: cat.id },
      update: {},
      create: { ...cat, type: TransactionType.gasto },
    })
  }

  // Categorías de ingresos
  const ingresoCategories = [
    { id: 'cat-sueldo', name: 'Sueldo', emoji: '💼', color: '#22c55e' },
    { id: 'cat-freelance', name: 'Freelance', emoji: '💻', color: '#3b82f6' },
    { id: 'cat-venta', name: 'Venta', emoji: '🏷️', color: '#f97316' },
    { id: 'cat-transferencias', name: 'Transferencias', emoji: '🔄', color: '#a855f7' },
    { id: 'cat-puerto', name: 'Puerto', emoji: '⚓', color: '#0ea5e9' },
    { id: 'cat-mesada', name: 'Mesada', emoji: '💰', color: '#eab308' },
    { id: 'cat-otros-ingreso', name: 'Otros', emoji: '📦', color: '#94a3b8' },
  ]

  for (const cat of ingresoCategories) {
    await prisma.category.upsert({
      where: { id: cat.id },
      update: {},
      create: { ...cat, type: TransactionType.ingreso },
    })
  }

  console.log('Seed completado ✓')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

- [ ] **Paso 5: Agregar script de seed a `package.json`**

```json
"prisma": {
  "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
}
```

- [ ] **Paso 6: Instalar ts-node**

```bash
npm install -D ts-node
```

- [ ] **Paso 7: Correr seed**

```bash
npx prisma db seed
```

Resultado esperado: "Seed completado ✓"

- [ ] **Paso 8: Verificar en Prisma Studio**

```bash
npx prisma studio
```

Confirmar que existen 8 tarjetas y 22 categorías.

- [ ] **Paso 9: Commit**

```bash
git add prisma/ package.json
git commit -m "feat: schema Prisma con seed de tarjetas y categorías"
```

---

## Task 3: Prisma Client Singleton + Lib Base

**Files:**
- Create: `lib/db.ts`
- Create: `lib/telegram.ts`
- Create: `lib/openai.ts`

- [ ] **Paso 1: Crear `lib/db.ts`**

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

- [ ] **Paso 2: Crear `lib/telegram.ts`**

```typescript
const BASE = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`

export async function sendMessage(text: string) {
  await fetch(`${BASE}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text,
      parse_mode: 'Markdown',
    }),
  })
}

export async function sendWithConfirmButtons(
  text: string,
  callbackData: string
) {
  await fetch(`${BASE}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Confirmar', callback_data: `confirm:${callbackData}` },
            { text: '❌ Cancelar', callback_data: `cancel:${callbackData}` },
          ],
        ],
      },
    }),
  })
}

export async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  await fetch(`${BASE}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  })
}

export async function editMessageText(chatId: string | number, messageId: number, text: string) {
  await fetch(`${BASE}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'Markdown',
    }),
  })
}

export async function registerWebhook(webhookUrl: string) {
  const res = await fetch(`${BASE}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: webhookUrl }),
  })
  return res.json()
}
```

- [ ] **Paso 3: Crear `lib/openai.ts`**

```typescript
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function transcribeAudio(audioBuffer: Buffer, filename: string): Promise<string> {
  const file = new File([audioBuffer], filename, { type: 'audio/ogg' })
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

export async function extractTransaction(text: string): Promise<ExtractedTransaction> {
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
          "categoryHint": string (nombre aproximado de la categoría),
          "cardHint": string (nombre aproximado de la tarjeta o medio de pago, vacío si no se menciona),
          "description": string (descripción breve),
          "confidence": "high" | "low"
        }
        Si el monto no está claro, pon confidence: "low". Moneda por defecto: UYU.`,
      },
      { role: 'user', content: text },
    ],
    response_format: { type: 'json_object' },
  })

  return JSON.parse(completion.choices[0].message.content!) as ExtractedTransaction
}
```

- [ ] **Paso 4: Commit**

```bash
git add lib/
git commit -m "feat: lib base — db singleton, telegram helpers, openai helpers"
```

---

## Task 4: API de Tarjetas (Cards)

**Files:**
- Create: `app/api/cards/route.ts`
- Create: `app/api/cards/[id]/route.ts`

- [ ] **Paso 1: Crear `app/api/cards/route.ts`**

```typescript
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const cards = await prisma.card.findMany({ orderBy: { createdAt: 'asc' } })
  return NextResponse.json(cards)
}

export async function POST(req: Request) {
  const body = await req.json()
  const card = await prisma.card.create({ data: body })
  return NextResponse.json(card, { status: 201 })
}
```

- [ ] **Paso 2: Crear `app/api/cards/[id]/route.ts`**

```typescript
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json()
  const card = await prisma.card.update({ where: { id: params.id }, data: body })
  return NextResponse.json(card)
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await prisma.card.delete({ where: { id: params.id } })
  return new NextResponse(null, { status: 204 })
}
```

- [ ] **Paso 3: Testear manualmente**

```bash
# En otra terminal: npm run dev
curl http://localhost:3000/api/cards
# Resultado esperado: array con las 8 tarjetas del seed
```

- [ ] **Paso 4: Commit**

```bash
git add app/api/cards/
git commit -m "feat: API CRUD de tarjetas"
```

---

## Task 5: API de Categorías

**Files:**
- Create: `app/api/categories/route.ts`
- Create: `app/api/categories/[id]/route.ts`

- [ ] **Paso 1: Crear `app/api/categories/route.ts`**

```typescript
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const categories = await prisma.category.findMany({
    where: { isActive: true, ...(type ? { type: type as any } : {}) },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(categories)
}

export async function POST(req: Request) {
  const body = await req.json()
  const category = await prisma.category.create({ data: body })
  return NextResponse.json(category, { status: 201 })
}
```

- [ ] **Paso 2: Crear `app/api/categories/[id]/route.ts`**

```typescript
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json()
  const category = await prisma.category.update({ where: { id: params.id }, data: body })
  return NextResponse.json(category)
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  // Soft delete
  await prisma.category.update({ where: { id: params.id }, data: { isActive: false } })
  return new NextResponse(null, { status: 204 })
}
```

- [ ] **Paso 3: Testear**

```bash
curl "http://localhost:3000/api/categories?type=gasto"
# Resultado: 15 categorías de gasto
curl "http://localhost:3000/api/categories?type=ingreso"
# Resultado: 7 categorías de ingreso
```

- [ ] **Paso 4: Commit**

```bash
git add app/api/categories/
git commit -m "feat: API CRUD de categorías"
```

---

## Task 6: API de Transacciones

**Files:**
- Create: `app/api/transactions/route.ts`
- Create: `app/api/transactions/[id]/route.ts`

- [ ] **Paso 1: Crear `app/api/transactions/route.ts`**

```typescript
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const cardId = searchParams.get('cardId')
  const month = searchParams.get('month')
  const year = searchParams.get('year')
  const limit = parseInt(searchParams.get('limit') ?? '50')

  const where: any = {}
  if (cardId) where.cardId = cardId
  if (month && year) {
    const start = new Date(parseInt(year), parseInt(month) - 1, 1)
    const end = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59)
    where.date = { gte: start, lte: end }
  }

  const transactions = await prisma.transaction.findMany({
    where,
    include: { category: true, card: true },
    orderBy: { date: 'desc' },
    take: limit,
  })
  return NextResponse.json(transactions)
}

export async function POST(req: Request) {
  const body = await req.json()
  const transaction = await prisma.transaction.create({
    data: { ...body, date: new Date(body.date) },
    include: { category: true, card: true },
  })
  return NextResponse.json(transaction, { status: 201 })
}
```

- [ ] **Paso 2: Crear `app/api/transactions/[id]/route.ts`**

```typescript
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json()
  const transaction = await prisma.transaction.update({
    where: { id: params.id },
    data: { ...body, ...(body.date ? { date: new Date(body.date) } : {}) },
    include: { category: true, card: true },
  })
  return NextResponse.json(transaction)
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await prisma.transaction.delete({ where: { id: params.id } })
  return new NextResponse(null, { status: 204 })
}
```

- [ ] **Paso 3: Testear POST**

```bash
curl -X POST http://localhost:3000/api/transactions \
  -H "Content-Type: application/json" \
  -d '{"amount":500,"currency":"UYU","type":"gasto","categoryId":"cat-supermercado","cardId":"itau-debito","date":"2026-04-02","source":"manual"}'
# Resultado: transacción creada con id
```

- [ ] **Paso 4: Commit**

```bash
git add app/api/transactions/
git commit -m "feat: API CRUD de transacciones con filtros por tarjeta y mes"
```

---

## Task 7: API de Reportes

**Files:**
- Create: `app/api/reports/route.ts`
- Create: `lib/reports.ts`

- [ ] **Paso 1: Crear `lib/reports.ts`**

```typescript
import { prisma } from './db'

export async function getMonthlyReport(month: number, year: number) {
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0, 23, 59, 59)

  const transactions = await prisma.transaction.findMany({
    where: { date: { gte: start, lte: end } },
    include: { category: true, card: true },
  })

  // Gastos por categoría
  const expenseByCategory: Record<string, { name: string; emoji: string | null; color: string | null; total: number }> = {}
  // Ingresos por categoría
  const incomeByCategory: Record<string, { name: string; total: number }> = {}
  // Gastos por tarjeta
  const expenseByCard: Record<string, { name: string; total: number }> = {}
  // Total gastos e ingresos
  let totalExpenses = 0
  let totalIncome = 0
  // Evolución diaria del saldo (para línea)
  const dailyBalance: Record<string, number> = {}

  for (const t of transactions) {
    const dayKey = t.date.toISOString().split('T')[0]
    if (t.type === 'gasto') {
      totalExpenses += t.amount
      const catId = t.categoryId
      if (!expenseByCategory[catId]) {
        expenseByCategory[catId] = { name: t.category.name, emoji: t.category.emoji, color: t.category.color, total: 0 }
      }
      expenseByCategory[catId].total += t.amount
      const cardId = t.cardId
      if (!expenseByCard[cardId]) expenseByCard[cardId] = { name: t.card.name, total: 0 }
      expenseByCard[cardId].total += t.amount
      dailyBalance[dayKey] = (dailyBalance[dayKey] ?? 0) - t.amount
    } else {
      totalIncome += t.amount
      const catId = t.categoryId
      if (!incomeByCategory[catId]) incomeByCategory[catId] = { name: t.category.name, total: 0 }
      incomeByCategory[catId].total += t.amount
      dailyBalance[dayKey] = (dailyBalance[dayKey] ?? 0) + t.amount
    }
  }

  // Top 5 categorías de gasto
  const topCategories = Object.values(expenseByCategory)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  return {
    totalExpenses,
    totalIncome,
    expenseByCategory: Object.values(expenseByCategory),
    incomeByCategory: Object.values(incomeByCategory),
    expenseByCard: Object.values(expenseByCard),
    topCategories,
    dailyBalance,
  }
}

export async function getLast6MonthsSummary() {
  const results = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const month = d.getMonth() + 1
    const year = d.getFullYear()
    const start = new Date(year, month - 1, 1)
    const end = new Date(year, month, 0, 23, 59, 59)
    const agg = await prisma.transaction.groupBy({
      by: ['type'],
      where: { date: { gte: start, lte: end } },
      _sum: { amount: true },
    })
    const expenses = agg.find(a => a.type === 'gasto')?._sum.amount ?? 0
    const income = agg.find(a => a.type === 'ingreso')?._sum.amount ?? 0
    results.push({ month, year, label: `${d.toLocaleString('es', { month: 'short' })} ${year}`, expenses, income })
  }
  return results
}
```

- [ ] **Paso 2: Crear `app/api/reports/route.ts`**

```typescript
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
```

- [ ] **Paso 3: Testear**

```bash
curl "http://localhost:3000/api/reports?month=4&year=2026"
# Resultado: objeto con monthly y last6
```

- [ ] **Paso 4: Commit**

```bash
git add lib/reports.ts app/api/reports/
git commit -m "feat: API de reportes mensuales con agregaciones"
```

---

## Task 8: API de Reconciliación de Saldos

**Files:**
- Create: `app/api/balances/route.ts`

- [ ] **Paso 1: Crear `app/api/balances/route.ts`**

```typescript
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))

  // Solo tarjetas propias que no son crédito
  const cards = await prisma.card.findMany({
    where: { isOwner: true, isActive: true, type: { not: 'credito' } },
  })

  const balances = await Promise.all(
    cards.map(async (card) => {
      const existing = await prisma.monthlyBalance.findUnique({
        where: { cardId_month_year: { cardId: card.id, month, year } },
      })

      // Calcular saldo esperado
      const prevMonth = month === 1 ? 12 : month - 1
      const prevYear = month === 1 ? year - 1 : year
      const prevBalance = await prisma.monthlyBalance.findUnique({
        where: { cardId_month_year: { cardId: card.id, month: prevMonth, year: prevYear } },
      })

      const start = new Date(year, month - 1, 1)
      const end = new Date(year, month, 0, 23, 59, 59)
      const agg = await prisma.transaction.groupBy({
        by: ['type'],
        where: { cardId: card.id, date: { gte: start, lte: end } },
        _sum: { amount: true },
      })
      const monthExpenses = agg.find(a => a.type === 'gasto')?._sum.amount ?? 0
      const monthIncome = agg.find(a => a.type === 'ingreso')?._sum.amount ?? 0
      const prevOpeningBalance = prevBalance?.openingBalance ?? 0
      const expectedBalance = prevOpeningBalance + monthIncome - monthExpenses

      return { card, existing, expectedBalance }
    })
  )

  return NextResponse.json(balances)
}

export async function POST(req: Request) {
  const body = await req.json()
  // body: { cardId, month, year, openingBalance, status }
  const { cardId, month, year, openingBalance, status } = body
  const expectedBalance = body.expectedBalance ?? 0
  const difference = openingBalance - expectedBalance

  const balance = await prisma.monthlyBalance.upsert({
    where: { cardId_month_year: { cardId, month, year } },
    update: { openingBalance, expectedBalance, difference, status },
    create: { cardId, month, year, openingBalance, expectedBalance, difference, status },
  })
  return NextResponse.json(balance, { status: 201 })
}
```

- [ ] **Paso 2: Testear**

```bash
curl "http://localhost:3000/api/balances?month=4&year=2026"
# Resultado: array con Itaú Débito y Efectivo
```

- [ ] **Paso 3: Commit**

```bash
git add app/api/balances/
git commit -m "feat: API reconciliación mensual de saldos"
```

---

## Task 9: Bot de Telegram — Handlers y Webhook

**Files:**
- Create: `lib/bot-handlers.ts`
- Create: `app/api/bot/route.ts`

- [ ] **Paso 1: Crear `lib/bot-handlers.ts`**

```typescript
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

  const extracted = await extractTransaction(transcript)

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

  const pendingData = {
    amount: extracted.amount,
    currency: extracted.currency,
    type: extracted.type,
    categoryId: category?.id,
    cardId: card?.id,
    description: extracted.description,
    date: new Date().toISOString(),
    source: 'telegram',
  }

  // Guardar pendiente
  await savePendingTransaction(confirmKey, pendingData)

  const cardStr = card ? card.name : '❓ tarjeta no detectada'
  const catStr = category ? `${category.emoji ?? ''} ${category.name}` : '❓ categoría no detectada'
  const typeStr = extracted.type === 'gasto' ? '📤 Gasto' : '📥 Ingreso'

  await sendWithConfirmButtons(
    `${typeStr}: *${montoStr}*\nCategoría: ${catStr}\nTarjeta: ${cardStr}\nDescripción: _${extracted.description}_\n\n¿Confirmo este registro?`,
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
```

- [ ] **Paso 2: Crear `app/api/bot/route.ts`**

```typescript
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
```

- [ ] **Paso 3: Commit**

```bash
git add lib/bot-handlers.ts app/api/bot/
git commit -m "feat: bot de Telegram — webhook, audio/texto, comandos, confirmación con botones"
```

---

## Task 10: Cron Job de Notificaciones

**Files:**
- Create: `app/api/cron/route.ts`

- [ ] **Paso 1: Crear `app/api/cron/route.ts`**

```typescript
import { prisma } from '@/lib/db'
import { sendMessage } from '@/lib/telegram'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  // Verificar secret
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
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
```

- [ ] **Paso 2: Agregar config de Vercel Cron a `vercel.json`**

```json
{
  "crons": [
    {
      "path": "/api/cron",
      "schedule": "0 9 * * *"
    }
  ]
}
```

> ⚠️ **Importante sobre autenticación del cron:**
> Vercel inyecta automáticamente el header `Authorization: Bearer <CRON_SECRET>` **solo en planes Pro/Enterprise**.
> En el plan gratuito (Hobby), el cron llama al endpoint sin ese header → el endpoint devolverá 401 silenciosamente.
>
> **Solución para plan Hobby:** Cambiar la verificación en `app/api/cron/route.ts` para aceptar también una query param:
> ```typescript
> const authHeader = req.headers.get('authorization')?.replace('Bearer ', '')
> const querySecret = new URL(req.url).searchParams.get('secret')
> const secret = authHeader ?? querySecret
> if (secret !== process.env.CRON_SECRET) return new NextResponse('Unauthorized', { status: 401 })
> ```
> Y en `vercel.json` usar: `"path": "/api/cron?secret=<CRON_SECRET>"` — **no exponer el secret en el path en producción**; usar variables de entorno de Vercel en la URL no es posible directamente. La alternativa más limpia para Hobby es desactivar la verificación (el endpoint no es público, no hay datos sensibles en la respuesta).

- [ ] **Paso 3: Commit**

```bash
git add app/api/cron/ vercel.json
git commit -m "feat: cron job diario — notificaciones cierre, límite y recordatorio reconciliación"
```

---

## Task 11: Layout y Navegación

**Files:**
- Modify: `app/layout.tsx`
- Create: `components/BottomNav.tsx`

- [ ] **Paso 1: Crear `components/BottomNav.tsx`**

```tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/', icon: '🏠', label: 'Inicio' },
  { href: '/transacciones/nueva', icon: '➕', label: 'Nueva' },
  { href: '/reportes', icon: '📊', label: 'Reportes' },
  { href: '/tarjetas', icon: '💳', label: 'Tarjetas' },
]

export default function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900 border-t border-gray-800 md:hidden">
      <div className="flex justify-around items-center h-16">
        {NAV_ITEMS.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-0.5 px-4 py-2 text-xs ${
              pathname === item.href ? 'text-indigo-400' : 'text-gray-500'
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  )
}
```

- [ ] **Paso 2: Actualizar `app/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import BottomNav from '@/components/BottomNav'
import Link from 'next/link'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Finanzas',
  description: 'App de finanzas personales',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
}

const NAV_ITEMS = [
  { href: '/', icon: '🏠', label: 'Dashboard' },
  { href: '/transacciones/nueva', icon: '➕', label: 'Nueva transacción' },
  { href: '/reportes', icon: '📊', label: 'Reportes' },
  { href: '/tarjetas', icon: '💳', label: 'Tarjetas' },
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${inter.className} bg-gray-950 text-gray-100 min-h-screen`}>
        {/* Sidebar desktop */}
        <aside className="hidden md:flex fixed left-0 top-0 h-full w-56 bg-gray-900 border-r border-gray-800 flex-col p-4 gap-1">
          <div className="text-xl font-bold text-indigo-400 mb-6 px-2">💰 Finanzas</div>
          {NAV_ITEMS.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </aside>
        {/* Main content */}
        <main className="md:ml-56 pb-20 md:pb-0 min-h-screen">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  )
}
```

- [ ] **Paso 3: Verificar que se ve la navegación**

```bash
# En el navegador: http://localhost:3000
# Mobile: bottom nav visible
# Desktop (>768px): sidebar visible
```

- [ ] **Paso 4: Commit**

```bash
git add app/layout.tsx components/BottomNav.tsx
git commit -m "feat: layout con bottom nav mobile y sidebar desktop"
```

---

## Task 12: Dashboard UI

**Files:**
- Modify: `app/page.tsx`
- Create: `components/CardCarousel.tsx`
- Create: `components/TransactionList.tsx`
- Create: `components/ReconciliationModal.tsx`

- [ ] **Paso 1: Crear `components/CardCarousel.tsx`**

```tsx
'use client'
import { useState } from 'react'

type Card = {
  id: string
  name: string
  type: string
  bank?: string | null
  closingDay?: number | null
  limitAmount?: number | null
}

type Props = {
  cards: Card[]
  selectedCardId: string | null
  onSelect: (cardId: string | null) => void
  monthExpenses: Record<string, number>
}

const CARD_COLORS: Record<string, string> = {
  'itau-debito': 'from-blue-600 to-blue-800',
  'itau-credito': 'from-indigo-600 to-indigo-900',
  'santander-credito': 'from-red-600 to-red-900',
  'efectivo': 'from-green-600 to-green-900',
}

export default function CardCarousel({ cards, selectedCardId, onSelect, monthExpenses }: Props) {
  const [current, setCurrent] = useState(0)

  const ownerCards = cards.filter(c => c.id !== 'itau-infinite' && !c.name.includes('mamá'))

  const handlePrev = () => setCurrent(i => Math.max(0, i - 1))
  const handleNext = () => setCurrent(i => Math.min(ownerCards.length - 1, i + 1))

  const CardItem = ({ card, active }: { card: Card; active: boolean }) => {
    const spent = monthExpenses[card.id] ?? 0
    const gradient = CARD_COLORS[card.id] ?? 'from-gray-600 to-gray-800'
    const isSelected = selectedCardId === card.id
    return (
      <div
        onClick={() => onSelect(isSelected ? null : card.id)}
        className={`bg-gradient-to-br ${gradient} rounded-2xl p-4 cursor-pointer transition-all ${
          isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-950' : ''
        } ${active ? 'scale-100 opacity-100' : 'scale-95 opacity-60'}`}
      >
        <div className="text-xs text-white/70 mb-1">{card.bank ?? card.type}</div>
        <div className="font-semibold text-white">{card.name}</div>
        <div className="mt-3 text-white/80 text-sm">Gastado este mes</div>
        <div className="text-xl font-bold text-white">${spent.toLocaleString('es-UY')} UYU</div>
        {card.closingDay && (
          <div className="text-xs text-white/60 mt-1">Cierre: día {card.closingDay}</div>
        )}
      </div>
    )
  }

  return (
    <div>
      {/* Mobile: carousel */}
      <div className="md:hidden relative">
        <div className="overflow-hidden">
          <div
            className="flex transition-transform duration-300"
            style={{ transform: `translateX(-${current * 100}%)` }}
          >
            {ownerCards.map((card, i) => (
              <div key={card.id} className="w-full flex-shrink-0 px-4">
                <CardItem card={card} active={i === current} />
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-center gap-2 mt-3">
          {ownerCards.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`w-2 h-2 rounded-full transition-colors ${i === current ? 'bg-indigo-400' : 'bg-gray-600'}`}
            />
          ))}
        </div>
      </div>
      {/* Desktop: fila horizontal */}
      <div className="hidden md:grid grid-cols-3 xl:grid-cols-4 gap-3 px-4">
        {ownerCards.map(card => (
          <CardItem key={card.id} card={card} active={true} />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Paso 2: Crear `components/TransactionList.tsx`**

```tsx
'use client'
import Link from 'next/link'

type Transaction = {
  id: string
  amount: number
  currency: string
  type: string
  date: string
  description?: string | null
  cardId: string  // necesario para el filtro por tarjeta
  category: { name: string; emoji?: string | null }
  card: { name: string }
}

type Props = { transactions: Transaction[]; selectedCardId: string | null }

export default function TransactionList({ transactions, selectedCardId }: Props) {
  const filtered = selectedCardId
    ? transactions.filter(t => t.cardId === selectedCardId)
    : transactions

  if (filtered.length === 0) {
    return <p className="text-center text-gray-500 py-8">Sin transacciones</p>
  }

  return (
    <div className="divide-y divide-gray-800">
      {filtered.map(t => (
        <div key={t.id} className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{t.category.emoji ?? '📦'}</span>
            <div>
              <div className="font-medium text-sm">{t.category.name}</div>
              <div className="text-xs text-gray-500">
                {t.card.name} · {new Date(t.date).toLocaleDateString('es-UY')}
              </div>
            </div>
          </div>
          <span className={`font-bold ${t.type === 'gasto' ? 'text-red-400' : 'text-green-400'}`}>
            {t.type === 'gasto' ? '-' : '+'}${t.amount.toLocaleString('es-UY')} {t.currency}
          </span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Paso 3: Crear `components/ReconciliationModal.tsx`**

```tsx
'use client'
import { useState } from 'react'

type Card = { id: string; name: string }
type BalanceItem = { card: Card; expectedBalance: number; existing: any }

type Props = {
  items: BalanceItem[]
  month: number
  year: number
  onClose: () => void
}

export default function ReconciliationModal({ items, month, year, onClose }: Props) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const pending = items.filter(item => !item.existing)
  if (pending.length === 0) return null

  const handleSave = async (item: BalanceItem, status: 'confirmed' | 'cancelled') => {
    setSaving(true)
    const openingBalance = status === 'confirmed' ? parseFloat(values[item.card.id] || '0') : item.expectedBalance
    await fetch('/api/balances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardId: item.card.id, month, year, openingBalance, expectedBalance: item.expectedBalance, status }),
    })
    setSaving(false)
    onClose()
  }

  const item = pending[0]
  const inputValue = values[item.card.id] ?? ''
  const diff = inputValue ? parseFloat(inputValue) - item.expectedBalance : null

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold mb-1">Reconciliación mensual</h2>
        <p className="text-gray-400 text-sm mb-4">{item.card.name}</p>
        <div className="bg-gray-800 rounded-xl p-4 mb-4">
          <div className="text-sm text-gray-400">Saldo esperado</div>
          <div className="text-xl font-bold">${item.expectedBalance.toLocaleString('es-UY')} UYU</div>
        </div>
        <label className="block text-sm text-gray-400 mb-1">¿Con cuánto arrancás?</label>
        <input
          type="number"
          value={inputValue}
          onChange={e => setValues(v => ({ ...v, [item.card.id]: e.target.value }))}
          className="w-full bg-gray-800 rounded-xl px-4 py-3 text-white text-lg font-bold mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="0"
        />
        {diff !== null && diff !== 0 && (
          <div className={`text-sm mb-4 ${diff < 0 ? 'text-red-400' : 'text-green-400'}`}>
            Diferencia: {diff > 0 ? '+' : ''}${diff.toLocaleString('es-UY')} UYU
          </div>
        )}
        <div className="flex gap-3">
          <button
            onClick={() => handleSave(item, 'confirmed')}
            disabled={!inputValue || saving}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl py-3 font-semibold"
          >
            ✅ Usar mi monto
          </button>
          <button
            onClick={() => handleSave(item, 'cancelled')}
            disabled={saving}
            className="flex-1 bg-gray-700 hover:bg-gray-600 rounded-xl py-3 font-semibold"
          >
            ❌ Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Paso 4: Crear `app/page.tsx`**

```tsx
import { prisma } from '@/lib/db'
import DashboardClient from './DashboardClient'

export const revalidate = 0

export default async function DashboardPage() {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0, 23, 59, 59)

  const [cards, transactions, balances] = await Promise.all([
    prisma.card.findMany({ where: { isActive: true }, orderBy: { createdAt: 'asc' } }),
    prisma.transaction.findMany({
      where: { date: { gte: start, lte: end } },
      include: { category: true, card: true },
      orderBy: { date: 'desc' },
      take: 50,
    }),
    fetch(`${process.env.NEXT_PUBLIC_URL ?? 'http://localhost:3000'}/api/balances?month=${month}&year=${year}`, { cache: 'no-store' })
      .then(r => r.json()).catch(() => []),
  ])

  const totalExpenses = transactions.filter(t => t.type === 'gasto').reduce((s, t) => s + t.amount, 0)
  const totalIncome = transactions.filter(t => t.type === 'ingreso').reduce((s, t) => s + t.amount, 0)

  const monthExpenses: Record<string, number> = {}
  for (const t of transactions.filter(t => t.type === 'gasto')) {
    monthExpenses[t.cardId] = (monthExpenses[t.cardId] ?? 0) + t.amount
  }

  return (
    <DashboardClient
      cards={cards}
      transactions={transactions.map(t => ({ ...t, date: t.date.toISOString() }))}
      totalExpenses={totalExpenses}
      totalIncome={totalIncome}
      monthExpenses={monthExpenses}
      balanceItems={balances}
      month={month}
      year={year}
    />
  )
}
```

- [ ] **Paso 5: Crear `app/DashboardClient.tsx`**

```tsx
'use client'
import { useState } from 'react'
import CardCarousel from '@/components/CardCarousel'
import TransactionList from '@/components/TransactionList'
import ReconciliationModal from '@/components/ReconciliationModal'

export default function DashboardClient({ cards, transactions, totalExpenses, totalIncome, monthExpenses, balanceItems, month, year }: any) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [showReconciliation, setShowReconciliation] = useState(
    balanceItems?.some((b: any) => !b.existing) ?? false
  )

  const monthName = new Date(year, month - 1).toLocaleString('es', { month: 'long', year: 'numeric' })

  return (
    <div className="max-w-2xl mx-auto">
      {showReconciliation && balanceItems?.length > 0 && (
        <ReconciliationModal
          items={balanceItems}
          month={month}
          year={year}
          onClose={() => setShowReconciliation(false)}
        />
      )}
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <div className="text-sm text-gray-400 capitalize">{monthName}</div>
        <div className="flex gap-6 mt-2">
          <div>
            <div className="text-xs text-gray-500">Gastos</div>
            <div className="text-2xl font-bold text-red-400">-${totalExpenses.toLocaleString('es-UY')}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Ingresos</div>
            <div className="text-2xl font-bold text-green-400">+${totalIncome.toLocaleString('es-UY')}</div>
          </div>
        </div>
      </div>
      {/* Cards */}
      <CardCarousel cards={cards} selectedCardId={selectedCardId} onSelect={setSelectedCardId} monthExpenses={monthExpenses} />
      {/* Transactions */}
      <div className="mt-6">
        <div className="px-4 mb-2 flex items-center justify-between">
          <h2 className="font-semibold text-gray-300">Transacciones</h2>
          {selectedCardId && (
            <button onClick={() => setSelectedCardId(null)} className="text-xs text-indigo-400">
              Ver todas
            </button>
          )}
        </div>
        <TransactionList transactions={transactions} selectedCardId={selectedCardId} />
      </div>
    </div>
  )
}
```

- [ ] **Paso 6: Verificar en el navegador** — Dashboard debe mostrar cards y transacciones

- [ ] **Paso 7: Commit**

```bash
git add app/page.tsx app/DashboardClient.tsx components/CardCarousel.tsx components/TransactionList.tsx components/ReconciliationModal.tsx
git commit -m "feat: dashboard con carousel de tarjetas, lista de transacciones y modal de reconciliación"
```

---

## Task 13: Formulario Nueva Transacción

**Files:**
- Create: `app/transacciones/nueva/page.tsx`
- Create: `components/TransactionForm.tsx`

- [ ] **Paso 1: Crear `components/TransactionForm.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Card = { id: string; name: string; type: string }
type Category = { id: string; name: string; emoji?: string | null; type: string }

type Props = { cards: Card[]; categories: Category[] }

export default function TransactionForm({ cards, categories }: Props) {
  const router = useRouter()
  const [type, setType] = useState<'gasto' | 'ingreso'>('gasto')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('UYU')
  const [categoryId, setCategoryId] = useState('')
  const [cardId, setCardId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  const filteredCategories = categories.filter(c => c.type === type)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || !categoryId || !cardId) return
    setSaving(true)
    await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: parseFloat(amount), currency, type, categoryId, cardId, date, description: description || null, source: 'manual' }),
    })
    setSaving(false)
    router.push('/')
    router.refresh()
  }

  const inputClass = 'w-full bg-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500'

  return (
    <form onSubmit={handleSubmit} className="p-4 max-w-lg mx-auto space-y-4">
      <h1 className="text-xl font-bold pt-2">Nueva transacción</h1>
      {/* Tipo */}
      <div className="flex gap-2">
        {(['gasto', 'ingreso'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => { setType(t); setCategoryId('') }}
            className={`flex-1 py-3 rounded-xl font-semibold capitalize transition-colors ${
              type === t
                ? t === 'gasto' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
                : 'bg-gray-800 text-gray-400'
            }`}
          >
            {t === 'gasto' ? '📤 Gasto' : '📥 Ingreso'}
          </button>
        ))}
      </div>
      {/* Monto + moneda */}
      <div className="flex gap-2">
        <input type="number" placeholder="Monto" value={amount} onChange={e => setAmount(e.target.value)} className={`${inputClass} flex-1`} required min="0" step="0.01" />
        <select value={currency} onChange={e => setCurrency(e.target.value)} className="bg-gray-800 rounded-xl px-3 py-3 text-white focus:outline-none">
          <option value="UYU">UYU</option>
          <option value="USD">USD</option>
        </select>
      </div>
      {/* Categoría */}
      <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className={inputClass} required>
        <option value="">Seleccionar categoría</option>
        {filteredCategories.map(c => (
          <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
        ))}
      </select>
      {/* Tarjeta */}
      <select value={cardId} onChange={e => setCardId(e.target.value)} className={inputClass} required>
        <option value="">Seleccionar tarjeta</option>
        {cards.filter(c => c.id !== 'itau-infinite').map(c => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      {/* Fecha */}
      <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputClass} required />
      {/* Descripción */}
      <input type="text" placeholder="Descripción (opcional)" value={description} onChange={e => setDescription(e.target.value)} className={inputClass} />
      <button type="submit" disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl py-4 font-bold text-lg">
        {saving ? 'Guardando...' : 'Guardar'}
      </button>
    </form>
  )
}
```

- [ ] **Paso 2: Crear `app/transacciones/nueva/page.tsx`**

```tsx
import { prisma } from '@/lib/db'
import TransactionForm from '@/components/TransactionForm'

export default async function NuevaTransaccionPage() {
  const [cards, categories] = await Promise.all([
    prisma.card.findMany({ where: { isActive: true }, orderBy: { createdAt: 'asc' } }),
    prisma.category.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
  ])
  return <TransactionForm cards={cards} categories={categories} />
}
```

- [ ] **Paso 3: Verificar en el navegador** — el formulario carga, se puede guardar y redirige al dashboard

- [ ] **Paso 4: Commit**

```bash
git add app/transacciones/ components/TransactionForm.tsx
git commit -m "feat: formulario de nueva transacción manual"
```

---

## Task 14: Gestión de Tarjetas UI

**Files:**
- Create: `app/tarjetas/page.tsx`
- Create: `components/CardForm.tsx`

- [ ] **Paso 1: Crear `components/CardForm.tsx`**

```tsx
'use client'
import { useState } from 'react'

type Card = {
  id?: string; name: string; type: string; bank?: string | null;
  closingDay?: number | null; dueDay?: number | null;
  limitAmount?: number | null; isOwner?: boolean
}

type Props = { card?: Card; onSave: () => void; onCancel: () => void }

export default function CardForm({ card, onSave, onCancel }: Props) {
  const [form, setForm] = useState<Card>(card ?? { name: '', type: 'debito', isOwner: true })
  const [saving, setSaving] = useState(false)

  const set = (key: keyof Card, val: any) => setForm(f => ({ ...f, [key]: val }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    if (card?.id) {
      await fetch(`/api/cards/${card.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    } else {
      await fetch('/api/cards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    }
    setSaving(false)
    onSave()
  }

  const inputClass = 'w-full bg-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm'

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input required placeholder="Nombre de la tarjeta" value={form.name} onChange={e => set('name', e.target.value)} className={inputClass} />
      <select value={form.type} onChange={e => set('type', e.target.value)} className={inputClass}>
        <option value="credito">Crédito</option>
        <option value="debito">Débito</option>
        <option value="efectivo">Efectivo</option>
      </select>
      <input placeholder="Banco" value={form.bank ?? ''} onChange={e => set('bank', e.target.value)} className={inputClass} />
      <div className="flex gap-2">
        <input type="number" placeholder="Día cierre" value={form.closingDay ?? ''} onChange={e => set('closingDay', e.target.value ? parseInt(e.target.value) : null)} className={inputClass} min="1" max="31" />
        <input type="number" placeholder="Día vencimiento" value={form.dueDay ?? ''} onChange={e => set('dueDay', e.target.value ? parseInt(e.target.value) : null)} className={inputClass} min="1" max="31" />
      </div>
      <input type="number" placeholder="Límite de alerta (UYU)" value={form.limitAmount ?? ''} onChange={e => set('limitAmount', e.target.value ? parseFloat(e.target.value) : null)} className={inputClass} />
      <label className="flex items-center gap-2 text-sm text-gray-400">
        <input type="checkbox" checked={form.isOwner} onChange={e => set('isOwner', e.target.checked)} className="rounded" />
        Es mi tarjeta (no de mamá)
      </label>
      <div className="flex gap-2 pt-2">
        <button type="submit" disabled={saving} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl py-2.5 font-semibold text-sm">
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
        <button type="button" onClick={onCancel} className="flex-1 bg-gray-700 hover:bg-gray-600 rounded-xl py-2.5 font-semibold text-sm">
          Cancelar
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Paso 2: Crear `app/tarjetas/page.tsx`**

```tsx
import { prisma } from '@/lib/db'
import CardsClient from './CardsClient'

export default async function TarjetasPage() {
  const cards = await prisma.card.findMany({ orderBy: { createdAt: 'asc' } })
  return <CardsClient initialCards={cards} />
}
```

- [ ] **Paso 3: Crear `app/tarjetas/CardsClient.tsx`**

```tsx
'use client'
import { useState } from 'react'
import CardForm from '@/components/CardForm'

export default function CardsClient({ initialCards }: { initialCards: any[] }) {
  const [cards, setCards] = useState(initialCards)
  const [editing, setEditing] = useState<any | null>(null)
  const [adding, setAdding] = useState(false)

  const reload = async () => {
    const res = await fetch('/api/cards')
    setCards(await res.json())
    setEditing(null)
    setAdding(false)
  }

  const toggle = async (id: string, isActive: boolean) => {
    await fetch(`/api/cards/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive }) })
    reload()
  }

  return (
    <div className="max-w-lg mx-auto p-4">
      <div className="flex items-center justify-between mb-6 pt-2">
        <h1 className="text-xl font-bold">Tarjetas</h1>
        <button onClick={() => setAdding(true)} className="bg-indigo-600 hover:bg-indigo-500 rounded-xl px-4 py-2 text-sm font-semibold">
          + Agregar
        </button>
      </div>
      {adding && (
        <div className="bg-gray-800 rounded-2xl p-4 mb-4">
          <h3 className="font-semibold mb-3">Nueva tarjeta</h3>
          <CardForm onSave={reload} onCancel={() => setAdding(false)} />
        </div>
      )}
      <div className="space-y-3">
        {cards.map(card => (
          <div key={card.id} className={`bg-gray-900 rounded-2xl p-4 border border-gray-800 ${!card.isActive ? 'opacity-50' : ''}`}>
            {editing?.id === card.id ? (
              <CardForm card={editing} onSave={reload} onCancel={() => setEditing(null)} />
            ) : (
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold">{card.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {card.bank} · {card.type}
                    {card.closingDay && ` · Cierre día ${card.closingDay}`}
                    {card.dueDay && ` · Vence día ${card.dueDay}`}
                    {card.limitAmount && ` · Límite $${card.limitAmount.toLocaleString('es-UY')}`}
                  </div>
                  {!card.isOwner && <span className="text-xs text-yellow-500">Tarjeta de mamá</span>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEditing(card)} className="text-xs text-indigo-400 hover:text-indigo-300">Editar</button>
                  <button onClick={() => toggle(card.id, !card.isActive)} className="text-xs text-gray-500 hover:text-gray-300">
                    {card.isActive ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Paso 4: Verificar** — se pueden editar tarjetas, agregar nuevas, activar/desactivar

- [ ] **Paso 5: Commit**

```bash
git add app/tarjetas/ components/CardForm.tsx
git commit -m "feat: pantalla de gestión de tarjetas con CRUD"
```

---

## Task 15: Reportes UI

**Files:**
- Create: `app/reportes/page.tsx`
- Create: `components/MonthSelector.tsx`
- Create: `components/charts/ExpensePieChart.tsx`
- Create: `components/charts/MonthlyBarChart.tsx`
- Create: `components/charts/BalanceLine.tsx`
- Create: `components/charts/CardSummary.tsx`
- Create: `components/charts/TopCategories.tsx`

- [ ] **Paso 1: Crear `components/MonthSelector.tsx`**

```tsx
'use client'

type Props = {
  month: number
  year: number
  onChange: (month: number, year: number) => void
}

export default function MonthSelector({ month, year, onChange }: Props) {
  const prev = () => {
    if (month === 1) onChange(12, year - 1)
    else onChange(month - 1, year)
  }
  const next = () => {
    const now = new Date()
    if (year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1)) return
    if (month === 12) onChange(1, year + 1)
    else onChange(month + 1, year)
  }
  const label = new Date(year, month - 1).toLocaleString('es', { month: 'long', year: 'numeric' })
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <button onClick={prev} className="text-2xl text-gray-400 hover:text-white px-2">‹</button>
      <span className="capitalize font-semibold">{label}</span>
      <button onClick={next} className="text-2xl text-gray-400 hover:text-white px-2">›</button>
    </div>
  )
}
```

- [ ] **Paso 2: Crear `components/charts/ExpensePieChart.tsx`**

```tsx
'use client'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

type Props = { data: { name: string; total: number; color?: string | null }[] }

export default function ExpensePieChart({ data }: Props) {
  if (data.length === 0) return <p className="text-center text-gray-500 py-8">Sin gastos</p>
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={data} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={100}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color ?? `hsl(${i * 37}, 70%, 55%)`} />
          ))}
        </Pie>
        <Tooltip formatter={(v: number) => `$${v.toLocaleString('es-UY')}`} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Paso 3: Crear `components/charts/MonthlyBarChart.tsx`**

```tsx
'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'

type Props = { data: { label: string; expenses: number; income: number }[] }

export default function MonthlyBarChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} />
        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
        <Tooltip formatter={(v: number) => `$${v.toLocaleString('es-UY')}`} />
        <Legend />
        <Bar dataKey="income" name="Ingresos" fill="#34d399" radius={[4, 4, 0, 0]} />
        <Bar dataKey="expenses" name="Gastos" fill="#f87171" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Paso 4: Crear `components/charts/BalanceLine.tsx`**

```tsx
'use client'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

type Props = { data: Record<string, number> }

export default function BalanceLine({ data }: Props) {
  const chartData = Object.entries(data)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, delta]) => ({ date: date.slice(5), delta }))

  // Acumular
  let running = 0
  const accumulated = chartData.map(d => { running += d.delta; return { date: d.date, balance: running } })

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={accumulated}>
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
        <Tooltip formatter={(v: number) => `$${v.toLocaleString('es-UY')}`} />
        <Line type="monotone" dataKey="balance" stroke="#818cf8" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Paso 5: Crear `components/charts/CardSummary.tsx`**

```tsx
type Props = { data: { name: string; total: number }[] }

export default function CardSummary({ data }: Props) {
  if (data.length === 0) return <p className="text-gray-500 text-sm">Sin gastos</p>
  return (
    <div className="space-y-2">
      {data.sort((a, b) => b.total - a.total).map((item, i) => (
        <div key={i} className="flex justify-between items-center py-2 border-b border-gray-800">
          <span className="text-sm">{item.name}</span>
          <span className="font-semibold text-red-400">${item.total.toLocaleString('es-UY')}</span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Paso 6: Crear `components/charts/TopCategories.tsx`**

```tsx
type Props = { data: { name: string; emoji?: string | null; total: number }[] }

export default function TopCategories({ data }: Props) {
  const max = data[0]?.total ?? 1
  return (
    <div className="space-y-3">
      {data.map((item, i) => (
        <div key={i}>
          <div className="flex justify-between text-sm mb-1">
            <span>{item.emoji} {item.name}</span>
            <span className="text-red-400">${item.total.toLocaleString('es-UY')}</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(item.total / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Paso 7: Crear `app/reportes/page.tsx`**

```tsx
import ReportesClient from './ReportesClient'

export default function ReportesPage() {
  const now = new Date()
  return <ReportesClient initialMonth={now.getMonth() + 1} initialYear={now.getFullYear()} />
}
```

- [ ] **Paso 8: Crear `app/reportes/ReportesClient.tsx`**

```tsx
'use client'
import { useState, useEffect } from 'react'
import MonthSelector from '@/components/MonthSelector'
import ExpensePieChart from '@/components/charts/ExpensePieChart'
import MonthlyBarChart from '@/components/charts/MonthlyBarChart'
import BalanceLine from '@/components/charts/BalanceLine'
import CardSummary from '@/components/charts/CardSummary'
import TopCategories from '@/components/charts/TopCategories'

export default function ReportesClient({ initialMonth, initialYear }: { initialMonth: number; initialYear: number }) {
  const [month, setMonth] = useState(initialMonth)
  const [year, setYear] = useState(initialYear)
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    fetch(`/api/reports?month=${month}&year=${year}`)
      .then(r => r.json())
      .then(setData)
  }, [month, year])

  const section = (title: string, children: React.ReactNode) => (
    <div className="bg-gray-900 rounded-2xl p-4 mb-4">
      <h3 className="font-semibold text-gray-300 mb-3">{title}</h3>
      {children}
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto">
      <MonthSelector month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y) }} />
      {!data ? (
        <div className="text-center text-gray-500 py-12">Cargando...</div>
      ) : (
        <div className="px-4 pb-6">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-gray-900 rounded-2xl p-4">
              <div className="text-xs text-gray-500">Gastos</div>
              <div className="text-xl font-bold text-red-400">${data.monthly.totalExpenses.toLocaleString('es-UY')}</div>
            </div>
            <div className="bg-gray-900 rounded-2xl p-4">
              <div className="text-xs text-gray-500">Ingresos</div>
              <div className="text-xl font-bold text-green-400">${data.monthly.totalIncome.toLocaleString('es-UY')}</div>
            </div>
          </div>
          {section('Gastos por categoría', <ExpensePieChart data={data.monthly.expenseByCategory} />)}
          {section('Evolución del saldo', <BalanceLine data={data.monthly.dailyBalance} />)}
          {section('Top 5 categorías', <TopCategories data={data.monthly.topCategories} />)}
          {section('Por tarjeta', <CardSummary data={data.monthly.expenseByCard} />)}
          {section('Últimos 6 meses', <MonthlyBarChart data={data.last6} />)}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Paso 9: Verificar en el navegador** — Reportes carga, selector de mes funciona, gráficos se renderizan

- [ ] **Paso 10: Commit**

```bash
git add app/reportes/ components/MonthSelector.tsx components/charts/
git commit -m "feat: pantalla de reportes con selector de mes y gráficos (Recharts)"
```

---

## Task 16: Deploy en Vercel

**Files:**
- Create: `vercel.json` (ya existe del Task 10)

- [ ] **Paso 1: Crear repositorio en GitHub**

```bash
# Crear repo en github.com y luego:
git remote add origin https://github.com/TU_USUARIO/finanzas.git
git push -u origin main
```

- [ ] **Paso 2: Conectar Vercel**
  - Ir a vercel.com → New Project → importar el repo
  - Framework: Next.js (auto-detectado)

- [ ] **Paso 3: Configurar variables de entorno en Vercel**
  - `DATABASE_URL` — URL de Neon Postgres (Production)
  - `TELEGRAM_BOT_TOKEN`
  - `TELEGRAM_CHAT_ID`
  - `OPENAI_API_KEY`
  - `CRON_SECRET`
  - `NEXT_PUBLIC_URL` — URL de tu app (ej: `https://finanzas-claudio.vercel.app`)

- [ ] **Paso 4: Deploy inicial**

Vercel hace el build automáticamente. Verificar que no hay errores de build.

- [ ] **Paso 5: Registrar webhook de Telegram**

Después del deploy, ejecutar una vez (reemplazar con tu URL real de Vercel):

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<TU_APP>.vercel.app/api/bot"
# Resultado: {"ok":true,"result":true,"description":"Webhook was set"}
```

- [ ] **Paso 6: Correr migraciones en producción**

```bash
# Con la DATABASE_URL de producción
DATABASE_URL="postgresql://..." npx prisma migrate deploy
DATABASE_URL="postgresql://..." npx prisma db seed
```

- [ ] **Paso 7: Verificar Cron Jobs** en Vercel dashboard → Settings → Cron Jobs. Debe aparecer `/api/cron` con schedule `0 9 * * *`.

- [ ] **Paso 8: Test de punta a punta**
  - Abrir la app en el celular
  - Agregar una transacción manual
  - Mandar un audio al bot de Telegram
  - Confirmar con el botón ✅
  - Verificar que aparece en el dashboard
  - Abrir /reportes

- [ ] **Paso 9: Commit final**

```bash
git add vercel.json
git commit -m "feat: configuración Vercel con cron jobs"
git push origin main
```

---

## Resumen de Tareas

| # | Tarea | Archivos clave |
|---|---|---|
| 1 | Setup proyecto | `package.json`, dependencias |
| 2 | Schema DB + seed | `prisma/schema.prisma`, `prisma/seed.ts` |
| 3 | Lib base | `lib/db.ts`, `lib/telegram.ts`, `lib/openai.ts` |
| 4 | API Cards | `app/api/cards/` |
| 5 | API Categories | `app/api/categories/` |
| 6 | API Transactions | `app/api/transactions/` |
| 7 | API Reports | `lib/reports.ts`, `app/api/reports/` |
| 8 | API Balances | `app/api/balances/` |
| 9 | Bot Telegram | `lib/bot-handlers.ts`, `app/api/bot/` |
| 10 | Cron job | `app/api/cron/`, `vercel.json` |
| 11 | Layout + Nav | `app/layout.tsx`, `components/BottomNav.tsx` |
| 12 | Dashboard UI | `app/page.tsx`, `components/CardCarousel.tsx`, etc |
| 13 | Form transacción | `components/TransactionForm.tsx` |
| 14 | Gestión tarjetas | `app/tarjetas/` |
| 15 | Reportes UI | `app/reportes/`, `components/charts/` |
| 16 | Deploy Vercel | Vercel + webhook Telegram |
