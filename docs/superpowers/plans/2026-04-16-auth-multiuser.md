# Auth + Multi-usuario + Categorías — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar autenticación (login/signup), soporte multi-usuario en la DB (cards y categories por usuario), sesión persistente que no vence, y botón "Crear categoría" vinculado al usuario logueado.

**Architecture:** NextAuth v5 (Auth.js) con Credentials provider (email + password), bcryptjs para hashing, JWT strategy con maxAge 1 año. Se agrega modelo `User` en Prisma, se vinculan `Card` y `Category` a `userId`. Middleware de Next.js protege todas las rutas excepto `/login`, `/signup`, `/api/bot` y `/api/cron/*`. Nueva página `/categorias` con gestión de categorías.

**Tech Stack:** next-auth@beta (Auth.js v5), bcryptjs, Prisma (ya instalado), Next.js 16.2.2 App Router

> **Nota sobre tests:** Este proyecto no tiene infraestructura de testing. Los pasos de "verificación" son manuales (correr el dev server y probar en browser).

---

> **Nota sobre `app/reportes` y `app/extractos`:** estas páginas server NO hacen queries Prisma directas — solo renderizan sus Client Components que llaman a las API routes (`/api/reports`, `/api/balances`). Como esas API routes ya tienen auth check, no hay filtrado adicional necesario en las páginas.

---

## File Map

### Archivos nuevos
| Archivo | Responsabilidad |
|---|---|
| `auth.ts` | Config central de NextAuth (provider, JWT callbacks, session) |
| `middleware.ts` | Protección de rutas con auth() |
| `app/api/auth/[...nextauth]/route.ts` | Handler HTTP para NextAuth |
| `app/api/auth/signup/route.ts` | Endpoint POST para registrar usuarios |
| `app/(auth)/login/page.tsx` | Página de login |
| `app/(auth)/signup/page.tsx` | Página de signup |
| `app/categorias/page.tsx` | Página server para gestión de categorías |
| `app/categorias/CategoriesClient.tsx` | UI de categorías con botón crear |
| `prisma/backfill.ts` | Script one-time para asignar datos existentes al usuario inicial |

### Archivos modificados
| Archivo | Cambio |
|---|---|
| `prisma/schema.prisma` | Agregar modelo `User`, `userId` a `Card` y `Category` |
| `.env` | Agregar `AUTH_SECRET` |
| `app/layout.tsx` | Mostrar usuario logueado + botón logout en sidebar/nav |
| `app/page.tsx` | Filtrar cards y transactions por `userId` de sesión |
| `app/tarjetas/page.tsx` | Filtrar cards por `userId` |
| `app/transacciones/nueva/page.tsx` | Filtrar cards y categories por `userId` |
| `app/api/cards/route.ts` | Auth check + filtro por `userId` |
| `app/api/cards/[id]/route.ts` | Auth check + verificar ownership |
| `app/api/categories/route.ts` | Auth check + filtro por `userId` |
| `app/api/categories/[id]/route.ts` | Auth check + verificar ownership |
| `app/api/transactions/route.ts` | Auth check (transacciones ya filtran por cardId) |
| `app/api/transactions/[id]/route.ts` | Auth check |
| `app/api/balances/route.ts` | Auth check + filtrar cards por `userId` |
| `app/api/reports/route.ts` | Auth check + pasar `userId` a lib/reports |
| `lib/reports.ts` | Aceptar `userId` como parámetro en queries |

---

## Task 1: Instalar dependencias

**Files:** `package.json`

- [ ] Instalar next-auth y bcryptjs:

```bash
cd C:/Users/Usuario/OneDrive/Desktop/CLAUDIO/Finanzas
npm install next-auth@beta bcryptjs
npm install -D @types/bcryptjs
```

- [ ] Verificar que se instalaron:

```bash
npm list next-auth bcryptjs
```

Expected: versiones listadas sin errores.

- [ ] Commit:

```bash
git add package.json package-lock.json
git commit -m "chore: install next-auth and bcryptjs"
```

---

## Task 2: Actualizar schema de Prisma

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] Reemplazar `prisma/schema.prisma` con el schema actualizado. Agregar modelo `User` y campos `userId` (nullable) a `Card` y `Category`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String     @id @default(cuid())
  name         String
  email        String     @unique
  passwordHash String
  createdAt    DateTime   @default(now())
  cards        Card[]
  categories   Category[]
}

model Card {
  id                  String    @id @default(cuid())
  userId              String?
  user                User?     @relation(fields: [userId], references: [id])
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
  userId       String?
  user         User?           @relation(fields: [userId], references: [id])
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
  extracto
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

- [ ] Correr la migración:

```bash
npx prisma migrate dev --name add-users
```

Expected: migración aplicada sin errores. Se crea la tabla `User` y se agregan columnas `userId` a `Card` y `Category`.

- [ ] Regenerar el cliente:

```bash
npx prisma generate
```

- [ ] Commit:

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add User model and userId to Card and Category"
```

---

## Task 3: Agregar AUTH_SECRET al .env

**Files:** `.env`

- [ ] Generar un secret seguro:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

- [ ] Agregar al `.env`:

```env
AUTH_SECRET=<valor_generado_arriba>
```

> **Importante:** `AUTH_SECRET` es la variable que usa Auth.js v5. No es `NEXTAUTH_SECRET`.

- [ ] **No commitear el .env.** Solo verificar que la variable existe:

```bash
grep AUTH_SECRET .env
```

---

## Task 3.5: Extender tipos de TypeScript para Session

**Files:**
- Create: `types/next-auth.d.ts`

> **Requerido antes de Task 4.** Sin este archivo, TypeScript no reconoce `session.user.id` en ningún lado y todo el proyecto falla en compilación.

- [ ] Crear `types/next-auth.d.ts`:

```typescript
import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
    }
  }
}
```

- [ ] Verificar que TypeScript acepta el archivo:

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: sin errores relacionados a `user.id`.

- [ ] Commit:

```bash
git add types/next-auth.d.ts
git commit -m "chore: extend next-auth Session type to include user.id"
```

---

## Task 4: Crear auth.ts (config central de NextAuth)

**Files:**
- Create: `auth.ts` (en la raíz del proyecto, al mismo nivel que `package.json`)

- [ ] Crear `auth.ts`:

```typescript
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        })
        if (!user) return null
        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        )
        if (!valid) return null
        return { id: user.id, name: user.name, email: user.email }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 365 * 24 * 60 * 60, // 1 año — sesión persistente
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id
      return token
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
})
```

- [ ] Verificar que TypeScript no tiene errores:

```bash
npx tsc --noEmit
```

- [ ] Commit:

```bash
git add auth.ts
git commit -m "feat: configure NextAuth with Credentials provider and 1-year JWT"
```

---

## Task 5: Crear API route para NextAuth y endpoint de signup

**Files:**
- Create: `app/api/auth/[...nextauth]/route.ts`
- Create: `app/api/auth/signup/route.ts`

- [ ] Crear `app/api/auth/[...nextauth]/route.ts`:

```typescript
import { handlers } from '@/auth'
export const { GET, POST } = handlers
```

- [ ] Crear `app/api/auth/signup/route.ts`:

```typescript
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

export async function POST(req: Request) {
  const { name, email, password } = await req.json()

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: 'El email ya está registrado' }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const user = await prisma.user.create({
    data: { name, email, passwordHash },
  })

  return NextResponse.json({ id: user.id, name: user.name, email: user.email }, { status: 201 })
}
```

- [ ] Commit:

```bash
git add app/api/auth/
git commit -m "feat: add NextAuth handler and signup endpoint"
```

---

## Task 6: Crear middleware de protección de rutas

**Files:**
- Create: `middleware.ts` (en la raíz del proyecto)

- [ ] Crear `middleware.ts`:

```typescript
import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const { pathname } = req.nextUrl

  // Rutas públicas que no requieren auth
  const publicPaths = ['/login', '/signup']
  const isPublicPath = publicPaths.includes(pathname)

  // Rutas de API que no requieren auth (bot de Telegram, cron jobs)
  const isPublicApi =
    pathname.startsWith('/api/bot') ||
    pathname.startsWith('/api/cron') ||
    pathname.startsWith('/api/auth')

  if (isPublicApi) return NextResponse.next()
  if (isPublicPath && isLoggedIn) return NextResponse.redirect(new URL('/', req.url))
  if (!isPublicPath && !isLoggedIn) return NextResponse.redirect(new URL('/login', req.url))

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

- [ ] Commit:

```bash
git add middleware.ts
git commit -m "feat: add middleware to protect all routes except login, signup, bot, cron"
```

---

## Task 7: Crear páginas de login y signup

**Files:**
- Create: `app/(auth)/layout.tsx`
- Create: `app/(auth)/login/page.tsx`
- Create: `app/(auth)/signup/page.tsx`

- [ ] Crear `app/(auth)/layout.tsx` (layout sin nav, para auth pages):

```typescript
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      {children}
    </div>
  )
}
```

- [ ] Crear `app/(auth)/login/page.tsx`:

```typescript
'use client'
import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    setLoading(false)
    if (res?.error) {
      setError('Email o contraseña incorrectos')
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-8">
        <div className="text-4xl mb-2">💰</div>
        <h1 className="text-2xl font-bold text-white">Finanzas</h1>
        <p className="text-gray-400 text-sm mt-1">Iniciá sesión para continuar</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-gray-900 rounded-2xl p-6 space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm text-gray-400 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            placeholder="tu@email.com"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl py-3 font-semibold text-white transition-colors"
        >
          {loading ? 'Iniciando...' : 'Iniciar sesión'}
        </button>

        <p className="text-center text-sm text-gray-500">
          ¿No tenés cuenta?{' '}
          <Link href="/signup" className="text-indigo-400 hover:text-indigo-300">
            Registrate
          </Link>
        </p>
      </form>
    </div>
  )
}
```

- [ ] Crear `app/(auth)/signup/page.tsx`:

```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SignupPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    })

    setLoading(false)
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Error al registrarse')
    } else {
      router.push('/login')
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-8">
        <div className="text-4xl mb-2">💰</div>
        <h1 className="text-2xl font-bold text-white">Finanzas</h1>
        <p className="text-gray-400 text-sm mt-1">Creá tu cuenta</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-gray-900 rounded-2xl p-6 space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm text-gray-400 mb-1">Nombre</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            placeholder="Tu nombre"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            placeholder="tu@email.com"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            placeholder="Mínimo 8 caracteres"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl py-3 font-semibold text-white transition-colors"
        >
          {loading ? 'Creando cuenta...' : 'Crear cuenta'}
        </button>

        <p className="text-center text-sm text-gray-500">
          ¿Ya tenés cuenta?{' '}
          <Link href="/login" className="text-indigo-400 hover:text-indigo-300">
            Iniciá sesión
          </Link>
        </p>
      </form>
    </div>
  )
}
```

- [ ] Commit:

```bash
git add app/(auth)/
git commit -m "feat: add login and signup pages"
```

---

## Task 8: Actualizar API routes — cards y categories

**Files:**
- Modify: `app/api/cards/route.ts`
- Modify: `app/api/cards/[id]/route.ts`
- Modify: `app/api/categories/route.ts`
- Modify: `app/api/categories/[id]/route.ts`

- [ ] Reemplazar `app/api/cards/route.ts`:

```typescript
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const cards = await prisma.card.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(cards)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const card = await prisma.card.create({
    data: { ...body, userId: session.user.id },
  })
  return NextResponse.json(card, { status: 201 })
}
```

- [ ] Leer el archivo actual de `app/api/cards/[id]/route.ts` y reemplazarlo:

```typescript
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const card = await prisma.card.update({
    where: { id, userId: session.user.id },
    data: body,
  })
  return NextResponse.json(card)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await prisma.card.delete({ where: { id, userId: session.user.id } })
  return NextResponse.json({ ok: true })
}
```

> **Nota:** `params` es una `Promise` en Next.js 15+. Usar `await params` siempre.

- [ ] Reemplazar `app/api/categories/route.ts`:

```typescript
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')

  const categories = await prisma.category.findMany({
    where: {
      userId: session.user.id,
      isActive: true,
      ...(type ? { type: type as any } : {}),
    },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(categories)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const category = await prisma.category.create({
    data: { ...body, userId: session.user.id },
  })
  return NextResponse.json(category, { status: 201 })
}
```

- [ ] Reemplazar `app/api/categories/[id]/route.ts` con ownership check incluido:

```typescript
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const category = await prisma.category.update({
    where: { id, userId: session.user.id },
    data: body,
  })
  return NextResponse.json(category)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  // Soft delete — solo si es del usuario
  await prisma.category.update({
    where: { id, userId: session.user.id },
    data: { isActive: false },
  })
  return new NextResponse(null, { status: 204 })
}
```

- [ ] Commit:

```bash
git add app/api/cards/ app/api/categories/
git commit -m "feat: add auth to cards and categories API routes, filter by userId"
```

---

## Task 9: Actualizar API routes — transactions, balances, reports

**Files:**
- Modify: `app/api/transactions/route.ts`
- Modify: `app/api/transactions/[id]/route.ts`
- Modify: `app/api/balances/route.ts`
- Modify: `app/api/reports/route.ts`
- Modify: `lib/reports.ts`

- [ ] Agregar auth check al principio de cada handler en `app/api/transactions/route.ts`. Las transacciones ya filtran por `cardId`; el userId se valida indirectamente porque las cards son del usuario. Agregar:

```typescript
import { auth } from '@/auth'

// Al inicio de GET y POST:
const session = await auth()
if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
```

- [ ] Mismo patrón para `app/api/transactions/[id]/route.ts`.

- [ ] En `app/api/balances/route.ts`, agregar auth y filtrar cards por `userId`:

```typescript
import { auth } from '@/auth'

// Al inicio de GET:
const session = await auth()
if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

// En el findMany de cards, agregar userId:
const cards = await prisma.card.findMany({
  where: { userId: session.user.id, isOwner: true, isActive: true, type: { not: 'credito' } },
})
```

- [ ] En `app/api/reports/route.ts`, agregar auth y pasar `userId`:

```typescript
import { auth } from '@/auth'

// Al inicio del GET:
const session = await auth()
if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

// Pasar userId a las funciones:
const [monthly, last6] = await Promise.all([
  getMonthlyReport(month, year, session.user.id),
  getLast6MonthsSummary(session.user.id),
])
```

- [ ] Actualizar `lib/reports.ts` para aceptar `userId` como parámetro en `getMonthlyReport` y `getLast6MonthsSummary`, y agregarlo en los `where` de Prisma:

```typescript
// Ejemplo en getMonthlyReport:
export async function getMonthlyReport(month: number, year: number, userId: string) {
  const transactions = await prisma.transaction.findMany({
    where: {
      date: { gte: start, lte: end },
      card: { userId },  // filter via relation
    },
    include: { category: true, card: true },
  })
  // ... resto igual
}

// Mismo patrón para getLast6MonthsSummary
```

- [ ] Commit:

```bash
git add app/api/transactions/ app/api/balances/ app/api/reports/ lib/reports.ts
git commit -m "feat: add auth to transactions, balances, and reports API routes"
```

---

## Task 10: Actualizar páginas server-side

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/tarjetas/page.tsx`
- Modify: `app/transacciones/nueva/page.tsx`

- [ ] En `app/page.tsx`, obtener la sesión y filtrar por `userId`. Agregar al inicio de la función:

```typescript
import { auth } from '@/auth'

// Al inicio de DashboardPage():
const session = await auth()
const userId = session!.user.id // garantizado por middleware

// En todos los findMany de prisma, agregar: where: { userId, ... }
// Para las transacciones, filtrar via card: where: { card: { userId }, ... }
```

- [ ] En `app/tarjetas/page.tsx` (leer primero), agregar auth y filtrar:

```typescript
import { auth } from '@/auth'

// Al inicio del componente server:
const session = await auth()
const cards = await prisma.card.findMany({
  where: { userId: session!.user.id },
  orderBy: { createdAt: 'asc' },
})
```

- [ ] En `app/transacciones/nueva/page.tsx`, agregar auth y filtrar:

```typescript
import { auth } from '@/auth'

const session = await auth()
const userId = session!.user.id

const [cards, categories] = await Promise.all([
  prisma.card.findMany({ where: { isActive: true, userId }, orderBy: { createdAt: 'asc' } }),
  prisma.category.findMany({ where: { isActive: true, userId }, orderBy: { name: 'asc' } }),
])
```

- [ ] Commit:

```bash
git add app/page.tsx app/tarjetas/page.tsx app/transacciones/nueva/page.tsx
git commit -m "feat: filter dashboard, cards, and transaction form by userId"
```

---

## Task 11: Actualizar layout — condicional según sesión + botón logout

**Files:**
- Modify: `app/layout.tsx`
- Delete: `app/(auth)/layout.tsx` (ya no necesario — ver explicación)

> **Importante — layout nesting en Next.js App Router:** Los route groups como `(auth)` NO evitan que sus páginas hereden `app/layout.tsx`. Un `app/(auth)/layout.tsx` agrega una capa extra pero no reemplaza el root layout. Si el root layout tiene nav/sidebar, las páginas de login/signup también lo mostrarían.
>
> **Solución adoptada:** Hacer el root layout **condicional según sesión**. Si hay sesión → mostrar sidebar y nav. Si no hay sesión → renderizar solo los children (pantalla limpia para login/signup). Esto elimina la necesidad de un `(auth)/layout.tsx` separado.

- [ ] Reemplazar `app/layout.tsx` completo:

```typescript
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import BottomNav from '@/components/BottomNav'
import Link from 'next/link'
import { auth, signOut } from '@/auth'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Finanzas',
  description: 'App de finanzas personales',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

const NAV_ITEMS = [
  { href: '/', icon: '🏠', label: 'Dashboard' },
  { href: '/transacciones/nueva', icon: '➕', label: 'Nueva transacción' },
  { href: '/reportes', icon: '📊', label: 'Reportes' },
  { href: '/tarjetas', icon: '💳', label: 'Tarjetas' },
  { href: '/extractos', icon: '📄', label: 'Extractos' },
  { href: '/categorias', icon: '🏷️', label: 'Categorías' },
]

// layout.tsx must stay a Server Component — do NOT add 'use client'
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  // Sin sesión: renderizar sin nav (páginas de login/signup)
  if (!session) {
    return (
      <html lang="es">
        <body className={`${inter.className} bg-gray-950 text-gray-100`}>
          {children}
        </body>
      </html>
    )
  }

  return (
    <html lang="es">
      <body className={`${inter.className} bg-gray-950 text-gray-100 h-screen overflow-hidden flex flex-col`}>
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar desktop */}
          <aside className="hidden md:flex flex-col w-56 bg-gray-900 border-r border-gray-800 p-4 gap-1 flex-shrink-0">
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
            {/* Usuario + logout */}
            <div className="mt-auto pt-4 border-t border-gray-800">
              <div className="px-2 text-xs text-gray-500 mb-2">{session.user.name}</div>
              <form
                action={async () => {
                  'use server'
                  await signOut({ redirectTo: '/login' })
                }}
              >
                <button
                  type="submit"
                  className="w-full text-left px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors text-sm"
                >
                  Cerrar sesión
                </button>
              </form>
            </div>
          </aside>
          {/* Main content */}
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
        <BottomNav />
      </body>
    </html>
  )
}
```

- [ ] Eliminar `app/(auth)/layout.tsx` si se creó (ya no es necesario con este enfoque):

```bash
rm app/\(auth\)/layout.tsx 2>/dev/null; rmdir app/\(auth\) 2>/dev/null; echo "done"
```

- [ ] Commit:

```bash
git add app/layout.tsx
git commit -m "feat: conditional layout — show nav only when authenticated, add logout button"
```

---

## Task 12: Crear página de Categorías con botón "Crear categoría"

**Files:**
- Create: `app/categorias/page.tsx`
- Create: `app/categorias/CategoriesClient.tsx`
- Modify: `app/layout.tsx` (agregar a NAV_ITEMS)

- [ ] Crear `app/categorias/page.tsx`:

```typescript
import { prisma } from '@/lib/db'
import { auth } from '@/auth'
import CategoriesClient from './CategoriesClient'

export const dynamic = 'force-dynamic'

export default async function CategoriasPage() {
  const session = await auth()
  const categories = await prisma.category.findMany({
    where: { userId: session!.user.id },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
  })
  return <CategoriesClient initialCategories={categories} />
}
```

- [ ] Crear `app/categorias/CategoriesClient.tsx`:

```typescript
'use client'
import { useState } from 'react'

type Category = {
  id: string
  name: string
  type: 'gasto' | 'ingreso'
  emoji: string | null
  color: string | null
  isActive: boolean
}

export default function CategoriesClient({ initialCategories }: { initialCategories: Category[] }) {
  const [categories, setCategories] = useState(initialCategories)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', type: 'gasto' as 'gasto' | 'ingreso', emoji: '', color: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const reload = async () => {
    const res = await fetch('/api/categories')
    setCategories(await res.json())
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        type: form.type,
        emoji: form.emoji || null,
        color: form.color || null,
      }),
    })
    setLoading(false)
    if (!res.ok) {
      setError('Error al crear la categoría')
    } else {
      setForm({ name: '', type: 'gasto', emoji: '', color: '' })
      setAdding(false)
      reload()
    }
  }

  const toggle = async (id: string, isActive: boolean) => {
    await fetch(`/api/categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive }),
    })
    reload()
  }

  const gastos = categories.filter(c => c.type === 'gasto')
  const ingresos = categories.filter(c => c.type === 'ingreso')

  return (
    <div className="max-w-lg mx-auto p-4">
      <div className="flex items-center justify-between mb-6 pt-2">
        <h1 className="text-xl font-bold">Categorías</h1>
        <button
          onClick={() => setAdding(true)}
          className="bg-indigo-600 hover:bg-indigo-500 rounded-xl px-4 py-2 text-sm font-semibold"
        >
          + Crear categoría
        </button>
      </div>

      {adding && (
        <form onSubmit={handleCreate} className="bg-gray-800 rounded-2xl p-4 mb-6 space-y-3">
          <h3 className="font-semibold">Nueva categoría</h3>
          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div>
            <label className="block text-sm text-gray-400 mb-1">Nombre *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full bg-gray-700 rounded-xl px-3 py-2 text-white"
              placeholder="Ej: Alimentación"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Tipo *</label>
            <select
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))}
              className="w-full bg-gray-700 rounded-xl px-3 py-2 text-white"
            >
              <option value="gasto">Gasto</option>
              <option value="ingreso">Ingreso</option>
            </select>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm text-gray-400 mb-1">Emoji</label>
              <input
                type="text"
                value={form.emoji}
                onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))}
                className="w-full bg-gray-700 rounded-xl px-3 py-2 text-white"
                placeholder="🛒"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm text-gray-400 mb-1">Color</label>
              <input
                type="text"
                value={form.color}
                onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                className="w-full bg-gray-700 rounded-xl px-3 py-2 text-white"
                placeholder="#6366f1"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl py-2 text-sm font-semibold"
            >
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="px-4 py-2 rounded-xl text-sm text-gray-400 hover:text-white bg-gray-700"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {[{ label: 'Gastos', items: gastos }, { label: 'Ingresos', items: ingresos }].map(({ label, items }) => (
        <div key={label} className="mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">{label}</h2>
          <div className="space-y-2">
            {items.map(cat => (
              <div
                key={cat.id}
                className={`bg-gray-900 rounded-xl p-3 border border-gray-800 flex items-center justify-between ${!cat.isActive ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center gap-2">
                  {cat.emoji && <span>{cat.emoji}</span>}
                  <span className="font-medium">{cat.name}</span>
                </div>
                <button
                  onClick={() => toggle(cat.id, !cat.isActive)}
                  className="text-xs text-gray-500 hover:text-gray-300"
                >
                  {cat.isActive ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            ))}
            {items.length === 0 && (
              <p className="text-sm text-gray-600 py-2">Sin categorías de {label.toLowerCase()}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] Commit:

```bash
git add app/categorias/ app/layout.tsx
git commit -m "feat: add categories page with create button"
```

---

## Task 13: Script de backfill — asignar datos existentes al primer usuario

**Files:**
- Create: `prisma/backfill.ts`

> **Propósito:** Asignar todas las `Card` y `Category` sin `userId` al primer usuario registrado (Claudio). Correr una sola vez después del primer signup.

- [ ] Crear `prisma/backfill.ts`:

```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Guard: verificar que el operador confirma la intención
  if (!process.argv.includes('--confirm')) {
    console.log('⚠️  Este script modifica la base de datos configurada en DATABASE_URL.')
    console.log(`    DB: ${process.env.DATABASE_URL?.replace(/:\/\/.*@/, '://***@') ?? 'no configurada'}`)
    console.log('')
    console.log('    Si estás seguro, corré:')
    console.log('    npx ts-node --compiler-options \'{"module":"CommonJS"}\' prisma/backfill.ts --confirm')
    process.exit(0)
  }

  const user = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } })
  if (!user) {
    console.error('❌ No hay usuarios registrados. Creá tu cuenta primero en /signup.')
    process.exit(1)
  }

  console.log(`🔍 Asignando datos a: ${user.name} (${user.email})`)

  const cards = await prisma.card.updateMany({
    where: { userId: null },
    data: { userId: user.id },
  })

  const categories = await prisma.category.updateMany({
    where: { userId: null },
    data: { userId: user.id },
  })

  console.log(`✅ ${cards.count} tarjetas y ${categories.count} categorías asignadas correctamente.`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

- [ ] Commit:

```bash
git add prisma/backfill.ts
git commit -m "chore: add backfill script to assign existing data to first user"
```

---

## Task 14: Verificación end-to-end

- [ ] Correr el servidor de desarrollo:

```bash
npm run dev
```

- [ ] Verificar flujo completo:
  1. Abrir `http://localhost:3000` → debe redirigir a `/login`
  2. Ir a `/signup`, crear una cuenta (ej: claudio@app.com)
  3. Hacer login → debe redirigir al dashboard
  4. Verificar que el dashboard carga (cards y transacciones del usuario)
  5. Ir a `/categorias` → ver la página y probar crear una categoría
  6. Cerrar el browser y reabrir → debe seguir logueado (sesión persistente de 1 año)
  7. Usar el botón "Cerrar sesión" → debe redirigir a `/login`

- [ ] Si hay datos existentes sin userId, correr el backfill:

```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/backfill.ts --confirm
```

- [ ] Verificar que los datos aparecen correctamente en el dashboard tras el backfill.

- [ ] Commit final si todo está OK:

```bash
git add -A
git commit -m "feat: multi-user auth complete — login, signup, persistent sessions, categories UI"
```

---

## Notas importantes

### TypeScript — extender Session type
NextAuth v5 necesita que extiendas el tipo `Session` para incluir `user.id`. Crear `types/next-auth.d.ts`:

```typescript
import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
    }
  }
}
```

Agregar este archivo antes de Task 4 si TypeScript se queja de `session.user.id`.

### Bot de Telegram
La ruta `/api/bot` ya está excluida del middleware. Sin embargo, si el bot necesita crear transacciones para un usuario específico, deberás pasar el `userId` explícitamente al crear transacciones desde el bot. Esto requiere una tarea separada.

### Vercel deployment
Asegurarse de agregar `AUTH_SECRET` en las variables de entorno de Vercel (Settings → Environment Variables).
