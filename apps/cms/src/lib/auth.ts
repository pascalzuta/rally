import { getIronSession, IronSession } from 'iron-session'
import { cookies } from 'next/headers'

// Validate SESSION_SECRET at startup
const SESSION_SECRET = process.env.SESSION_SECRET ?? ''
if (!SESSION_SECRET) {
  throw new Error('SESSION_SECRET environment variable is required')
}
if (SESSION_SECRET.length < 32) {
  throw new Error('SESSION_SECRET must be at least 32 characters long')
}
if (SESSION_SECRET === 'change-me-to-a-random-secret-at-least-32-chars') {
  throw new Error(
    'SESSION_SECRET is still set to the placeholder value. Please generate a secure random secret.'
  )
}

export type SessionData = {
  userId: string
  email: string
  role: string
  mustChangePassword?: boolean
}

export const sessionOptions = {
  cookieName: 'cms_session',
  password: SESSION_SECRET,
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax' as const,
  },
  ttl: 8 * 60 * 60, // 8 hours in seconds
}

export async function getSessionFromCookies(): Promise<
  IronSession<SessionData>
> {
  const cookieStore = await cookies()
  return getIronSession<SessionData>(cookieStore, sessionOptions)
}

export function isAuthenticated(session: IronSession<SessionData>): boolean {
  return !!session.userId
}

export function isFullyAuthenticated(session: IronSession<SessionData>): boolean {
  return !!session.userId && !session.mustChangePassword
}
