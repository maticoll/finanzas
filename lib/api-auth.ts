import { auth } from '@/auth'
import { prisma } from '@/lib/db'

/**
 * Resolves a userId from either a NextAuth session (browser) or a Bearer API key (external apps).
 * Returns the userId string, or null if not authenticated.
 */
export async function resolveUserId(req: Request): Promise<string | null> {
  // 1. Try Bearer token
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const key = authHeader.slice(7)
    const apiKey = await prisma.apiKey.findUnique({
      where: { key },
      select: { userId: true },
    })
    return apiKey?.userId ?? null
  }

  // 2. Fall back to NextAuth session
  const session = await auth()
  return session?.user?.id ?? null
}

const ALLOWED_ORIGIN = 'https://app-personal-ten.vercel.app'

export function corsHeaders(origin: string | null) {
  const allowed = origin === ALLOWED_ORIGIN || origin?.startsWith('http://localhost')
  return {
    'Access-Control-Allow-Origin': allowed ? (origin ?? '') : '',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}
