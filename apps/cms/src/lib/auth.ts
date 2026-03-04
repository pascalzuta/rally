import { getIronSession, IronSession } from 'iron-session'
import { cookies } from 'next/headers'

export type SessionData = {
  userId: string
  email: string
  role: string
  mustChangePassword?: boolean
}

export const sessionOptions = {
  cookieName: 'cms_session',
  password: process.env.SESSION_SECRET as string,
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
