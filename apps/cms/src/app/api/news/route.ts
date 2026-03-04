import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies, isAuthenticated } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { newsPostSchema } from '@/lib/validation'

export async function GET() {
  const session = await getSessionFromCookies()
  if (!isAuthenticated(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const posts = await prisma.newsPost.findMany({
    include: { pages: { orderBy: { pageNum: 'asc' } } },
    orderBy: { publishedAt: 'desc' },
  })

  return NextResponse.json(posts)
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies()
  if (!isAuthenticated(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

  const post = await prisma.newsPost.create({
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

  return NextResponse.json(post, { status: 201 })
}
