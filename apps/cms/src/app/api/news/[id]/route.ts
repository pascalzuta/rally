import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies, isFullyAuthenticated } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { newsPostSchema } from '@/lib/validation'

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSessionFromCookies()
  if (!isFullyAuthenticated(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = params

  const post = await prisma.newsPost.findUnique({
    where: { id },
    include: { pages: { orderBy: { pageNum: 'asc' } } },
  })

  if (!post) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(post)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSessionFromCookies()
  if (!isFullyAuthenticated(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = params

  const existing = await prisma.newsPost.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const result = newsPostSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: result.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { pages, tags, ...postData } = result.data

  const updated = await prisma.$transaction(async (tx) => {
    await tx.newsPostPage.deleteMany({ where: { postId: id } })

    return tx.newsPost.update({
      where: { id },
      data: {
        ...postData,
        tags: JSON.stringify(tags),
        pages: {
          create: pages.map((p, i) => ({
            pageNum: i + 1,
            heading: p.heading,
            body: p.body,
          })),
        },
      },
      include: { pages: { orderBy: { pageNum: 'asc' } } },
    })
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

  const existing = await prisma.newsPost.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.newsPost.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
