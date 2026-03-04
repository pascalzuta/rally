import { NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth'

export async function GET() {
  const session = await getSessionFromCookies()

  if (!session.userId) {
    return NextResponse.json({ user: null }, { status: 401 })
  }

  return NextResponse.json({
    user: {
      userId: session.userId,
      email: session.email,
      role: session.role,
      mustChangePassword: session.mustChangePassword ?? false,
    },
  })
}
