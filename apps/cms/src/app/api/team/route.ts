import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies, isAuthenticated } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { teamMemberSchema } from '@/lib/validation'

export async function GET() {
  const session = await getSessionFromCookies()
  if (!isAuthenticated(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const members = await prisma.teamMember.findMany({
    orderBy: [{ type: 'asc' }, { order: 'asc' }],
  })

  return NextResponse.json(members)
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies()
  if (!isAuthenticated(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const parsed = teamMemberSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const member = await prisma.teamMember.create({
      data: parsed.data,
    })

    return NextResponse.json(member, { status: 201 })
  } catch (error) {
    console.error('Team member creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create team member' },
      { status: 500 }
    )
  }
}
