import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function safeParseJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string') return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown'
  const { success } = rateLimit(`public-news-slug:${ip}`, 60, 60 * 1000)
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: corsHeaders }
    )
  }

  const { slug } = params

  try {
    const post = await prisma.newsPost.findUnique({
      where: { slug, status: 'published' },
      select: {
        slug: true,
        title: true,
        author: true,
        publishedAt: true,
        monthKey: true,
        summary: true,
        tags: true,
        pages: {
          select: {
            pageNum: true,
            heading: true,
            body: true,
          },
          orderBy: { pageNum: 'asc' },
        },
      },
    })

    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404, headers: corsHeaders }
      )
    }

    const parsed = {
      ...post,
      tags: safeParseJsonArray(post.tags),
    }

    return NextResponse.json(parsed, { headers: corsHeaders })
  } catch (error) {
    console.error('Public news slug GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch news post' },
      { status: 500, headers: corsHeaders }
    )
  }
}

export async function OPTIONS() {
  return new Response(null, {
    headers: corsHeaders,
  })
}
