import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import ApiKeysClient from './ApiKeysClient'

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const keys = await prisma.apiKey.findMany({
    where: { userId: session.user.id },
    select: { id: true, name: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })

  return <ApiKeysClient initialKeys={keys.map(k => ({ ...k, createdAt: k.createdAt.toISOString() }))} />
}
