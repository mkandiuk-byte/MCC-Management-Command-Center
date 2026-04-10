import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PASSWORD = process.env.MCC_ACCESS_PASSWORD

export function middleware(request: NextRequest) {
  // Skip auth if no password set (local dev)
  if (!PASSWORD) return NextResponse.next()

  // Skip auth for API routes (they have their own auth)
  if (request.nextUrl.pathname.startsWith('/api/')) return NextResponse.next()

  // Skip auth for static assets
  if (
    request.nextUrl.pathname.startsWith('/_next/') ||
    request.nextUrl.pathname.startsWith('/favicon') ||
    request.nextUrl.pathname === '/manifest.json'
  ) {
    return NextResponse.next()
  }

  // Check for auth cookie
  const authCookie = request.cookies.get('mcc-auth')?.value
  if (authCookie === PASSWORD) return NextResponse.next()

  // Check for login form submission
  if (request.nextUrl.pathname === '/login') return NextResponse.next()

  // Redirect to login
  return NextResponse.redirect(new URL('/login', request.url))
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
