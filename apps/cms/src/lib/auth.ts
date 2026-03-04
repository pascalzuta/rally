import { getIronSession, IronSession } from 'iron-session'
import { cookies } from 'next/headers'

// Lazy validation of SESSION_SECRET (edge functions bundle at build time without env vars)
function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET ?? ''
  if (!secret) {
    throw new Error('SESSION_SECRET environment variable is required')
  }
  if (secret.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters long')
  }
  if (secret === 'change-me-to-a-random-secret-at-least-32-chars') {
    throw new Error(
      'SESSION_SECRET is still set to the placeholder value. Please generate a secure random secret.'
    )
  }
  return secret
}

export type SessionData = {
  userId: string
  email: string
  role: string
  mustChangePassword?: boolean
}

export function getSessionOptions() {
  return {
    cookieName: 'cms_session',
    password: getSessionSecret(),
    cookieOptions: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax' as const,
    },
    ttl: 8 * 60 * 60, // 8 hours in seconds
  }
}

// Keep for backward compat with middleware that imports sessionOptions directly
export const sessionOptions = {
  cookieName: 'cms_session',
  password: process.env.SESSION_SECRET as string,
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax' as const,
  },
  ttl: 8 * 60 * 60,
}

export async function getSessionFromCookies(): Promise<
  IronSession<SessionData>
> {
  const cookieStore = await cookies()
  return getIronSession<SessionData>(cookieStore, getSessionOptions())
}

export function isAuthenticated(session: IronSession<SessionData>): boolean {
  return !!session.userId
}

export function isFullyAuthenticated(session: IronSession<SessionData>): boolean {
  return !!session.userId && !session.mustChangePassword
}
