import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  if (!process.argv.includes('--confirm')) {
    console.log('⚠️  Este script modifica la base de datos configurada en DATABASE_URL.')
    console.log(`    DB: ${process.env.DATABASE_URL?.replace(/:\/\/.*@/, '://***@') ?? 'no configurada'}`)
    console.log('')
    console.log('    Si estás seguro, corré:')
    console.log("    npx ts-node --compiler-options '{\"module\":\"CommonJS\"}' prisma/backfill.ts --confirm")
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
