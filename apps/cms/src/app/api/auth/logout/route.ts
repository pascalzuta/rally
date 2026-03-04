import { NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth'

export async function POST() {
  const session = await getSessionFromCookies()

  session.destroy()

  return NextResponse.json({ success: true })
}
