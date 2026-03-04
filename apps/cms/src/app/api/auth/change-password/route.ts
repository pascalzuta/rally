import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { changePasswordSchema } from '@/lib/validation'
import { getSessionFromCookies } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    // Require valid session
    const session = await getSessionFromCookies()

    if (!session.userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Parse and validate body
    const body = await request.json()
    const result = changePasswordSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0]?.message ?? 'Invalid input' },
        { status: 400 }
      )
    }

    const { currentPassword, newPassword } = result.data

    // Look up the user
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Verify current password
    const currentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.passwordHash
    )

    if (!currentPasswordValid) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 401 }
      )
    }

    // Prevent reusing the same password
    const sameAsOld = await bcrypt.compare(newPassword, user.passwordHash)
    if (sameAsOld) {
      return NextResponse.json(
        { error: 'New password must be different from current password' },
        { status: 400 }
      )
    }

    // Hash and save the new password
    const newHash = await bcrypt.hash(newPassword, 12)

    await prisma.user.update({
      where: { id: session.userId },
      data: {
        passwordHash: newHash,
        mustChangePassword: false,
      },
    })

    // Update session to clear the flag
    session.mustChangePassword = false
    await session.save()

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
