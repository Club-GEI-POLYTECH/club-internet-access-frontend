import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Middleware Next.js pour protéger les routes et gérer HTTP/HTTPS
 */
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const url = request.nextUrl.clone()
  const isHttps =
    request.headers.get('x-forwarded-proto') === 'https' || url.protocol === 'https:'

  const publicRoutes = ['/login', '/register', '/forgot-password', '/reset-password']
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route))

  if (isPublicRoute) {
    return NextResponse.next()
  }

  if (!isHttps && process.env.NODE_ENV === 'production') {
    url.protocol = 'https:'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  // Matcher pour les routes à protéger
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - .well-known (Chrome DevTools, ACME, etc.)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|\\.well-known).*)',
  ],
}
