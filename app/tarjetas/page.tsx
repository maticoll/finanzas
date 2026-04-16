import { prisma } from '@/lib/db'
import { auth } from '@/auth'
import CardsClient from './CardsClient'

export const dynamic = 'force-dynamic'

export default async function TarjetasPage() {
  const session = await auth()
  const cards = await prisma.card.findMany({
    where: { userId: session!.user.id },
    orderBy: { createdAt: 'asc' },
  })
  return <CardsClient initialCards={cards} />
}
