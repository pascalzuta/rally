import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { loginSchema } from '@/lib/validation'
import { rateLimit } from '@/lib/rate-limit'
import { getSessionFromCookies } from '@/lib/auth'

// Dummy hash for timing-safe comparison when user is not found (AUTH-13)
const DUMMY_HASH = '$2a$12$x/yzoGKPCMYIXFHHdMvSaOQEDjs0BSXmm3HqGS0iGdJPyaKLF.S2i'

export async function POST(request: NextRequest) {
  try {
    // Rate limit by IP
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      'unknown'
    const { success: ipWithinLimit, resetAt: ipResetAt } = rateLimit(`login:${ip}`, 5, 15 * 60 * 1000)

    if (!ipWithinLimit) {
      const retryAfterSeconds = Math.ceil((ipResetAt - Date.now()) / 1000)
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfterSeconds) },
        }
      )
    }

    // Parse and validate body
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      )
    }
    const result = loginSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0]?.message ?? 'Invalid input' },
        { status: 400 }
      )
    }

    const { email, password } = result.data

    // Rate limit by email (AUTH-01, AUTH-08)
    const { success: emailWithinLimit, resetAt: emailResetAt } = rateLimit(
      `login-email:${email}`,
      5,
      15 * 60 * 1000
    )

    if (!emailWithinLimit) {
      const retryAfterSeconds = Math.ceil((emailResetAt - Date.now()) / 1000)
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfterSeconds) },
        }
      )
    }

    // Look up user
    const user = await prisma.user.findUnique({ where: { email } })

    if (!user) {
      // Perform dummy bcrypt comparison to prevent timing attacks (AUTH-13)
      await bcrypt.compare(password, DUMMY_HASH)
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, user.passwordHash)

    if (!passwordValid) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Create session
    const session = await getSessionFromCookies()

    session.userId = user.id
    session.email = user.email
    session.role = user.role
    session.mustChangePassword = user.mustChangePassword

    await session.save()

    return NextResponse.json({
      success: true,
      mustChangePassword: user.mustChangePassword,
    })
  } catch {
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
