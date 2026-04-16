import { prisma } from '@/lib/db'
import { auth } from '@/auth'
import TransactionForm from '@/components/TransactionForm'

export const dynamic = 'force-dynamic'

export default async function NuevaTransaccionPage() {
  const session = await auth()
  const userId = session!.user.id

  const [cards, categories] = await Promise.all([
    prisma.card.findMany({ where: { isActive: true, userId }, orderBy: { createdAt: 'asc' } }),
    prisma.category.findMany({ where: { isActive: true, userId }, orderBy: { name: 'asc' } }),
  ])
  return <TransactionForm cards={cards} categories={categories} />
}
