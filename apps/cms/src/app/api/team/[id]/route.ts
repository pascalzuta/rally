import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies, isFullyAuthenticated } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { teamMemberSchema } from '@/lib/validation'

interface RouteParams {
  params: { id: string }
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await getSessionFromCookies()
  if (!isFullyAuthenticated(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = params

  const member = await prisma.teamMember.findUnique({
    where: { id },
  })

  if (!member) {
    return NextResponse.json(
      { error: 'Team member not found' },
      { status: 404 }
    )
  }

  return NextResponse.json(member)
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await getSessionFromCookies()
  if (!isFullyAuthenticated(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = params

  try {
    const existing = await prisma.teamMember.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Team member not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const parsed = teamMemberSchema.partial().safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const updated = await prisma.teamMember.update({
      where: { id },
      data: parsed.data,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Team member update error:', error)
    return NextResponse.json(
      { error: 'Failed to update team member' },
      { status: 500 }
    )
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await getSessionFromCookies()
  if (!isFullyAuthenticated(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = params

  const existing = await prisma.teamMember.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json(
      { error: 'Team member not found' },
      { status: 404 }
    )
  }

  await prisma.teamMember.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
