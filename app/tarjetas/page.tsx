import { prisma } from '@/lib/db'
import CardsClient from './CardsClient'

export default async function TarjetasPage() {
  const cards = await prisma.card.findMany({ orderBy: { createdAt: 'asc' } })
  return <CardsClient initialCards={cards} />
}
