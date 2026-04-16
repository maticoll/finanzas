import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import OnboardingClient from './OnboardingClient'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  const session = await auth()
  const userId = session!.user.id

  // Si ya tiene tarjetas, no necesita onboarding
  const cardCount = await prisma.card.count({ where: { userId } })
  if (cardCount > 0) redirect('/')

  return <OnboardingClient />
}
