import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies, isFullyAuthenticated } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSessionFromCookies()
  if (!isFullyAuthenticated(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = params

  const existing = await prisma.linkedInPost.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { embedHtml, caption, postDate, active, order } = body as {
    embedHtml?: string
    caption?: string
    postDate?: string
    active?: boolean
    order?: number
  }

  const updated = await prisma.linkedInPost.update({
    where: { id },
    data: {
      embedHtml: embedHtml?.trim() ?? existing.embedHtml,
      caption: caption !== undefined ? caption.trim() : existing.caption,
      postDate: postDate ? new Date(postDate) : existing.postDate,
      active: active !== undefined ? active : existing.active,
      order: order !== undefined ? order : existing.order,
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSessionFromCookies()
  if (!isFullyAuthenticated(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = params

  const existing = await prisma.linkedInPost.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.linkedInPost.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
