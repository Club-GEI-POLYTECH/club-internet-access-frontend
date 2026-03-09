import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const LOG_PREFIX = '[ClubIA] Middleware'

/**
 * Middleware Next.js pour protéger les routes et gérer HTTP/HTTPS
 */
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const url = request.nextUrl.clone()
  const isHttps = request.headers.get('x-forwarded-proto') === 'https' || 
                   url.protocol === 'https:'

  console.log(`${LOG_PREFIX} requête`, { pathname, isHttps })

  const publicRoutes = ['/login', '/forgot-password', '/reset-password', '/home']
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))

  if (isPublicRoute) {
    console.log(`${LOG_PREFIX} route publique, passage`, { pathname })
    return NextResponse.next()
  }

  if (!isHttps && process.env.NODE_ENV === 'production') {
    console.log(`${LOG_PREFIX} production HTTP → redirection HTTPS`, { pathname })
    url.protocol = 'https:'
    return NextResponse.redirect(url)
  }

  console.log(`${LOG_PREFIX} route protégée, passage`, { pathname })
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
