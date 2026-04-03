import { prisma } from '@/lib/db'
import TransactionForm from '@/components/TransactionForm'

export default async function NuevaTransaccionPage() {
  const [cards, categories] = await Promise.all([
    prisma.card.findMany({ where: { isActive: true }, orderBy: { createdAt: 'asc' } }),
    prisma.category.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
  ])
  return <TransactionForm cards={cards} categories={categories} />
}
