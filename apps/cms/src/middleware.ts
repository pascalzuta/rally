import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { SessionData, sessionOptions } from '@/lib/auth'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow the login page through without auth
  if (pathname === '/admin/login') {
    return NextResponse.next()
  }

  const response = NextResponse.next()
  const session = await getIronSession<SessionData>(
    request,
    response,
    sessionOptions
  )

  // No session -- redirect to login
  if (!session.userId) {
    const loginUrl = new URL('/admin/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  // Session exists but user must change their password
  if (session.mustChangePassword && pathname !== '/admin/change-password') {
    const changePasswordUrl = new URL('/admin/change-password', request.url)
    return NextResponse.redirect(changePasswordUrl)
  }

  return response
}

export const config = {
  matcher: '/admin/:path*',
}
