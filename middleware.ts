import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const { pathname } = req.nextUrl

  const publicPaths = ['/login', '/signup']
  const isPublicPath = publicPaths.includes(pathname)

  const isPublicApi =
    pathname.startsWith('/api/bot') ||
    pathname.startsWith('/api/cron') ||
    pathname.startsWith('/api/auth')

  if (isPublicApi) return NextResponse.next()
  if (isPublicPath && isLoggedIn) return NextResponse.redirect(new URL('/', req.url))
  if (!isPublicPath && !isLoggedIn) return NextResponse.redirect(new URL('/login', req.url))

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
