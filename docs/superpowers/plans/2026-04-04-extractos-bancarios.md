# Extractos Bancarios Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar una sección `/extractos` al menú de la app que permita subir un PDF de extracto bancario Itaú, procesarlo con GPT-4o-mini, y guardar automáticamente las transacciones en la base de datos.

**Architecture:** El usuario selecciona la tarjeta y sube el PDF → API extrae texto con `pdf-parse` → GPT categoriza cada gasto → se detectan duplicados → se insertan las transacciones nuevas → se muestra resumen.

**Tech Stack:** Next.js 16 (App Router), Prisma/Neon Postgres, OpenAI SDK v6, pdf-parse, Tailwind CSS

---

## File Map

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `package.json` | Modify | Agregar pdf-parse |
| `next.config.ts` | Modify | serverExternalPackages para pdf-parse |
| `prisma/schema.prisma` | Modify | Agregar `extracto` al enum Source |
| `app/api/extractos/route.ts` | Create | Endpoint POST: pdf → GPT → DB |
| `app/extractos/page.tsx` | Create | Server component wrapper |
| `app/extractos/ExtractosClient.tsx` | Create | UI: selección tarjeta + upload + resultado |
| `components/BottomNav.tsx` | Modify | Agregar ítem Extractos |
| `app/layout.tsx` | Modify | Agregar ítem Extractos al sidebar |

---

## Task 1: Instalar pdf-parse y configurar Next.js

**Files:**
- Modify: `package.json` (via npm install)
- Modify: `next.config.ts`

- [ ] **Step 1: Instalar dependencias**

```bash
cd "C:/Users/Usuario/OneDrive/Desktop/CLAUDIO/Finanzas"
npm install pdf-parse
npm install --save-dev @types/pdf-parse
```

Expected output: `added X packages` sin errores.

- [ ] **Step 2: Actualizar next.config.ts**

Agregar `serverExternalPackages` al objeto de configuración existente en `next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdf-parse'],
};

export default nextConfig;
```

> Nota: el archivo actual solo tiene el comentario `/* config options here */`. Si ya tenés otras opciones configuradas, simplemente agregá `serverExternalPackages: ['pdf-parse']` al objeto existente sin borrar lo demás.

- [ ] **Step 3: Verificar que el build no rompe**

```bash
cd "C:/Users/Usuario/OneDrive/Desktop/CLAUDIO/Finanzas"
npx next build 2>&1 | tail -20
```

Expected: build exitoso (puede haber warnings pero no errores fatales).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json next.config.ts
git commit -m "chore: instalar pdf-parse y configurar serverExternalPackages"
```

---

## Task 2: Migración Prisma — agregar `extracto` al enum Source

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Editar schema.prisma**

Ubicar el enum `Source` (actualmente líneas 68-71) y agregar `extracto`:

```prisma
enum Source {
  manual
  telegram
  extracto
}
```

- [ ] **Step 2: Crear y aplicar la migración**

```bash
cd "C:/Users/Usuario/OneDrive/Desktop/CLAUDIO/Finanzas"
npx prisma migrate dev --name add-extracto-source
```

Expected: `The following migration(s) have been applied: .../add_extracto_source` y `Generated Prisma Client`.

- [ ] **Step 3: Verificar que el cliente Prisma incluye el nuevo valor**

```bash
grep -r "extracto" node_modules/.prisma/client/index.d.ts | head -5
```

Expected: aparece `extracto` en la definición del enum.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: agregar valor extracto al enum Source en Prisma"
```

---

## Task 3: Crear el endpoint `/api/extractos`

**Files:**
- Create: `app/api/extractos/route.ts`

Este es el núcleo de la funcionalidad. El endpoint recibe `multipart/form-data` con `cardId` y `file` (PDF), extrae el texto, llama a GPT, valida, detecta duplicados e inserta.

- [ ] **Step 1: Crear el archivo del endpoint**

Crear `app/api/extractos/route.ts` con el siguiente contenido:

```ts
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import pdfParse from 'pdf-parse'

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
    const parsed = await pdfParse(buffer)
    pdfText = parsed.text?.trim() ?? ''
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
```

- [ ] **Step 2: Verificar que TypeScript compila**

```bash
cd "C:/Users/Usuario/OneDrive/Desktop/CLAUDIO/Finanzas"
npx tsc --noEmit 2>&1
```

Expected: sin errores (puede haber warnings menores de `any`).

- [ ] **Step 3: Probar el endpoint manualmente**

Arrancar el servidor de desarrollo:
```bash
npm run dev
```

Probar con curl que el endpoint responde a errores básicos:
```bash
curl -X POST http://localhost:3000/api/extractos \
  -F "cardId=CARD_ID_INVALIDO" \
  -F "file=@/dev/null;type=application/pdf"
```

Expected: `{"error":"Tarjeta no encontrada"}` con status 400.

- [ ] **Step 4: Commit**

```bash
git add app/api/extractos/route.ts
git commit -m "feat: endpoint POST /api/extractos — pdf-parse + GPT + dedup"
```

---

## Task 4: Crear la página `/extractos` con UI

**Files:**
- Create: `app/extractos/page.tsx`
- Create: `app/extractos/ExtractosClient.tsx`

- [ ] **Step 1: Crear el server component `app/extractos/page.tsx`**

```tsx
import ExtractosClient from './ExtractosClient'

export default function ExtractosPage() {
  return <ExtractosClient />
}
```

- [ ] **Step 2: Crear el componente cliente `app/extractos/ExtractosClient.tsx`**

```tsx
'use client'
import { useState, useEffect } from 'react'

type Card = { id: string; name: string; bank: string | null; type: string }
type Result = { saved: number; skipped: number }

export default function ExtractosClient() {
  const [cards, setCards] = useState<Card[]>([])
  const [cardId, setCardId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/cards')
      .then(r => r.json())
      .then((data: Card[]) => {
        setCards(data)
        if (data.length > 0) setCardId(data[0].id)
      })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !cardId) return

    setLoading(true)
    setResult(null)
    setError(null)

    const formData = new FormData()
    formData.append('cardId', cardId)
    formData.append('file', file)

    try {
      const res = await fetch('/api/extractos', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Error desconocido')
      } else {
        setResult(data)
      }
    } catch {
      setError('Error de red. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto p-4">
      <div className="pt-2 mb-6">
        <h1 className="text-xl font-bold">Importar extracto</h1>
        <p className="text-sm text-gray-500 mt-1">Subí el PDF del extracto Itaú para importar tus gastos automáticamente.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Selector de tarjeta */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Tarjeta</label>
          <select
            value={cardId}
            onChange={e => setCardId(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            required
          >
            {cards.map(card => (
              <option key={card.id} value={card.id}>
                {card.name} {card.bank ? `· ${card.bank}` : ''} ({card.type})
              </option>
            ))}
          </select>
        </div>

        {/* Upload PDF */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Archivo PDF</label>
          <input
            type="file"
            accept=".pdf,application/pdf"
            onChange={e => setFile(e.target.files?.[0] ?? null)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm file:mr-3 file:bg-indigo-600 file:text-white file:border-0 file:rounded-lg file:px-3 file:py-1 file:text-xs focus:outline-none focus:border-indigo-500"
            required
          />
          {file && <p className="text-xs text-gray-500 mt-1">{file.name} · {(file.size / 1024).toFixed(0)} KB</p>}
        </div>

        <button
          type="submit"
          disabled={loading || !file || !cardId}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl py-3 text-sm font-semibold transition-colors"
        >
          {loading ? 'Procesando...' : 'Procesar extracto'}
        </button>
      </form>

      {/* Resultado */}
      {result && (
        <div className="mt-6 bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <h2 className="font-semibold mb-3 text-green-400">✅ Extracto procesado</h2>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Transacciones guardadas</span>
              <span className="font-semibold text-green-400">{result.saved}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Duplicadas ignoradas</span>
              <span className="font-semibold text-gray-500">{result.skipped}</span>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-6 bg-red-950 border border-red-800 rounded-2xl p-4">
          <p className="text-sm text-red-400">⚠️ {error}</p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verificar que la página carga en el browser**

Con `npm run dev` corriendo, abrir `http://localhost:3000/extractos`.

Expected: se ve la página con el dropdown de tarjetas, el input de archivo y el botón "Procesar extracto".

- [ ] **Step 4: Commit**

```bash
git add app/extractos/page.tsx app/extractos/ExtractosClient.tsx
git commit -m "feat: página /extractos con UI de upload y resultado"
```

---

## Task 5: Agregar Extractos al menú de navegación

**Files:**
- Modify: `components/BottomNav.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Actualizar BottomNav.tsx**

En `components/BottomNav.tsx`, el array `NAV_ITEMS` actualmente es:
```ts
const NAV_ITEMS = [
  { href: '/', icon: '🏠', label: 'Inicio' },
  { href: '/transacciones/nueva', icon: '➕', label: 'Nueva' },
  { href: '/reportes', icon: '📊', label: 'Reportes' },
  { href: '/tarjetas', icon: '💳', label: 'Tarjetas' },
]
```

Reemplazarlo con (5 ítems, labels cortos para que entren):
```ts
const NAV_ITEMS = [
  { href: '/', icon: '🏠', label: 'Inicio' },
  { href: '/transacciones/nueva', icon: '➕', label: 'Nueva' },
  { href: '/reportes', icon: '📊', label: 'Reportes' },
  { href: '/tarjetas', icon: '💳', label: 'Tarjetas' },
  { href: '/extractos', icon: '📄', label: 'Extractos' },
]
```

- [ ] **Step 2: Actualizar layout.tsx**

En `app/layout.tsx`, el array `NAV_ITEMS` del sidebar desktop actualmente es:
```ts
const NAV_ITEMS = [
  { href: '/', icon: '🏠', label: 'Dashboard' },
  { href: '/transacciones/nueva', icon: '➕', label: 'Nueva transacción' },
  { href: '/reportes', icon: '📊', label: 'Reportes' },
  { href: '/tarjetas', icon: '💳', label: 'Tarjetas' },
]
```

Reemplazarlo con:
```ts
const NAV_ITEMS = [
  { href: '/', icon: '🏠', label: 'Dashboard' },
  { href: '/transacciones/nueva', icon: '➕', label: 'Nueva transacción' },
  { href: '/reportes', icon: '📊', label: 'Reportes' },
  { href: '/tarjetas', icon: '💳', label: 'Tarjetas' },
  { href: '/extractos', icon: '📄', label: 'Extractos' },
]
```

- [ ] **Step 3: Verificar navegación en browser**

Con `npm run dev` corriendo, verificar que:
- En mobile (DevTools a 390px): aparece el ícono 📄 Extractos en la barra inferior
- En desktop: aparece "📄 Extractos" en el sidebar izquierdo
- Al hacer click navega a `/extractos`
- El ítem se resalta (color indigo) cuando está activo

- [ ] **Step 4: Commit**

```bash
git add components/BottomNav.tsx app/layout.tsx
git commit -m "feat: agregar Extractos al menú de navegación (bottom nav + sidebar)"
```

---

## Task 6: Prueba end-to-end con PDF real

- [ ] **Step 1: Arrancar dev server**

```bash
npm run dev
```

- [ ] **Step 2: Abrir la app y navegar a Extractos**

Abrir `http://localhost:3000/extractos`.

- [ ] **Step 3: Subir el extracto PDF de Itaú**

1. Seleccionar la tarjeta correcta en el dropdown (ej: "Itaú crédito")
2. Subir el archivo PDF del extracto
3. Click en "Procesar extracto"

Expected:
- El botón cambia a "Procesando..." mientras espera
- Aparece el resumen con las transacciones guardadas y duplicadas

- [ ] **Step 4: Verificar transacciones en la DB**

Abrir `http://localhost:3000` (Dashboard) y confirmar que aparecen las transacciones importadas con:
- Monto correcto
- Categoría asignada
- Tarjeta correcta
- Fecha correcta

- [ ] **Step 5: Subir el mismo extracto de nuevo**

Subir el mismo PDF otra vez. Expected: `{ saved: 0, skipped: N }` — todas detectadas como duplicados.

- [ ] **Step 6: Commit final si hay ajustes menores**

```bash
git add -A
git commit -m "fix: ajustes menores tras prueba e2e con extracto real"
```

---

## Checklist de verificación final

- [ ] `npm run build` sin errores
- [ ] `pdf-parse` en `serverExternalPackages` (no crashea el build)
- [ ] Enum `extracto` en la DB (migración aplicada)
- [ ] Endpoint devuelve `{ saved, skipped }` con PDF válido
- [ ] Endpoint devuelve `{ error }` con PDF inválido o tarjeta inexistente
- [ ] UI muestra resultado / error correctamente
- [ ] Navegación activa funciona en mobile y desktop
- [ ] Duplicados son detectados correctamente en segunda subida
