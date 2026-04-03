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
