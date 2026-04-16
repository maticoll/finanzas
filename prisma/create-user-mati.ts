/**
 * Script para crear el usuario "mati" y asignar todos los datos existentes.
 * Usa @neondatabase/serverless (HTTP) en lugar de TCP — funciona desde red local.
 *
 * Correr DESPUÉS de aplicar la migración SQL en la consola de Neon.
 *
 * Uso: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/create-user-mati.ts
 */

import { neon } from '@neondatabase/serverless'
import * as bcrypt from 'bcryptjs'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Cargar .env manualmente (evita dependencia de dotenv)
try {
  const envFile = readFileSync(resolve(process.cwd(), '.env'), 'utf-8')
  for (const line of envFile.split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      const val = match[2].trim().replace(/^["']|["']$/g, '')
      if (!process.env[key]) process.env[key] = val
    }
  }
} catch {
  // .env no encontrado — asumir que las vars ya están en el entorno
}

const sql = neon(process.env.DATABASE_URL!)

async function main() {
  console.log('🔧 Conectando a Neon via HTTP...')

  // Verificar que la tabla User existe
  const tableCheck = await sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_name = 'User'
    ) as exists
  `
  if (!tableCheck[0].exists) {
    console.error('❌ La tabla "User" no existe. Aplicá el SQL de migración en la consola de Neon primero.')
    console.error('   Archivo: prisma/migrations/20260416000000_add_users/migration.sql')
    process.exit(1)
  }

  // Verificar si el usuario ya existe
  const existing = await sql`SELECT id, name, email FROM "User" WHERE email = 'maticoll.dale@gmail.com'`

  let userId: string

  if (existing.length > 0) {
    console.log(`ℹ️  Usuario ya existe: ${existing[0].name} (${existing[0].email})`)
    userId = existing[0].id
  } else {
    // Crear usuario
    const passwordHash = await bcrypt.hash('claudio123', 12)
    const newUser = await sql`
      INSERT INTO "User" (id, name, email, "passwordHash", "createdAt")
      VALUES (
        gen_random_uuid()::text,
        'mati',
        'maticoll.dale@gmail.com',
        ${passwordHash},
        NOW()
      )
      RETURNING id, name, email
    `
    userId = newUser[0].id
    console.log(`✅ Usuario creado: ${newUser[0].name} (${newUser[0].email})`)
  }

  // Backfill: asignar tarjetas sin userId
  const cardsResult = await sql`
    UPDATE "Card" SET "userId" = ${userId} WHERE "userId" IS NULL
  `
  console.log(`✅ Tarjetas asignadas: ${cardsResult.length ?? '(todas las sin userId)'}`)

  // Backfill: asignar categorías sin userId
  const catsResult = await sql`
    UPDATE "Category" SET "userId" = ${userId} WHERE "userId" IS NULL
  `
  console.log(`✅ Categorías asignadas: ${catsResult.length ?? '(todas las sin userId)'}`)

  // Resumen
  const cardCount = await sql`SELECT COUNT(*) as n FROM "Card" WHERE "userId" = ${userId}`
  const catCount = await sql`SELECT COUNT(*) as n FROM "Category" WHERE "userId" = ${userId}`
  console.log(`\n📊 Resumen para mati:`)
  console.log(`   Tarjetas: ${cardCount[0].n}`)
  console.log(`   Categorías: ${catCount[0].n}`)
  console.log(`\n🎉 Listo! Ahora podés loguearte con:`)
  console.log(`   Email: maticoll.dale@gmail.com`)
  console.log(`   Contraseña: claudio123`)
}

main().catch(e => {
  console.error('❌ Error:', e.message)
  process.exit(1)
})
