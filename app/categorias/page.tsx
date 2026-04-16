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
