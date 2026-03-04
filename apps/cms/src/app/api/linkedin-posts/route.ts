import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies, isFullyAuthenticated } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await getSessionFromCookies()
  if (!isFullyAuthenticated(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const posts = await prisma.linkedInPost.findMany({
    where: { active: true },
    orderBy: [{ order: 'asc' }, { postDate: 'desc' }],
  })
  return NextResponse.json(posts)
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies()
  if (!isFullyAuthenticated(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

  if (!embedHtml || typeof embedHtml !== 'string' || embedHtml.trim().length === 0) {
    return NextResponse.json({ error: 'embedHtml is required' }, { status: 400 })
  }

  const post = await prisma.linkedInPost.create({
    data: {
      embedHtml: embedHtml.trim(),
      caption: caption?.trim() || '',
      postDate: postDate ? new Date(postDate) : new Date(),
      active: active !== undefined ? active : true,
      order: order || 0,
    },
  })

  return NextResponse.json(post, { status: 201 })
}
