import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { SessionData, sessionOptions } from '@/lib/auth'

// Auth-related API routes that should be accessible without full auth
const PUBLIC_API_PREFIXES = ['/api/auth/login', '/api/auth/session', '/api/auth/change-password', '/api/public/']

function isPublicApiRoute(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith('/api/')
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public API routes through without auth
  if (isApiRoute(pathname) && isPublicApiRoute(pathname)) {
    return NextResponse.next()
  }

  // For login page, check if user is already logged in and redirect
  if (pathname === '/admin/login') {
    const response = NextResponse.next()
    const session = await getIronSession<SessionData>(
      request,
      response,
      sessionOptions
    )

    // Fix 6: Redirect logged-in users from login page (AUTH-07)
    if (session.userId) {
      const adminUrl = new URL('/admin', request.url)
      return NextResponse.redirect(adminUrl)
    }

    return response
  }

  const response = NextResponse.next()
  const session = await getIronSession<SessionData>(
    request,
    response,
    sessionOptions
  )

  // No session
  if (!session.userId) {
    if (isApiRoute(pathname)) {
      // Return 401 JSON for API routes
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      )
    }
    const loginUrl = new URL('/admin/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  // Session exists but user must change their password
  if (session.mustChangePassword) {
    if (isApiRoute(pathname)) {
      // API routes: block access for users who must change password
      return NextResponse.json(
        { error: 'Password change required' },
        { status: 403, headers: { 'Cache-Control': 'no-store' } }
      )
    }
    if (pathname !== '/admin/change-password') {
      const changePasswordUrl = new URL('/admin/change-password', request.url)
      return NextResponse.redirect(changePasswordUrl)
    }
  }

  // Add Cache-Control: no-store to admin responses (AUTH-11)
  response.headers.set('Cache-Control', 'no-store')

  return response
}

export const config = {
  matcher: ['/admin/:path*', '/api/((?!public/).*)'],
}
