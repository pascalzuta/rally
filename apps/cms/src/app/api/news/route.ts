import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { getSessionFromCookies, isFullyAuthenticated } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { newsPostSchema } from '@/lib/validation'

export async function GET() {
  const session = await getSessionFromCookies()
  if (!isFullyAuthenticated(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const posts = await prisma.newsPost.findMany({
      include: { pages: { orderBy: { pageNum: 'asc' } } },
      orderBy: { publishedAt: 'desc' },
    })

    return NextResponse.json(posts)
  } catch (error) {
    console.error('News GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch news posts' },
      { status: 500 }
    )
  }
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

  const result = newsPostSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: result.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { pages, tags, ...postData } = result.data

  try {
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
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return NextResponse.json(
        { error: `A news post with the slug "${postData.slug}" already exists. Please choose a different slug.` },
        { status: 409 }
      )
    }
    console.error('News POST error:', error)
    return NextResponse.json(
      { error: 'Failed to create news post' },
      { status: 500 }
    )
  }
}
