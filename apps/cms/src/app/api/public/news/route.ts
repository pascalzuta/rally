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

export async function GET(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown'
  const { success } = rateLimit(`public-news:${ip}`, 60, 60 * 1000)
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: corsHeaders }
    )
  }

  try {
    const url = new URL(request.url)
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '10', 10) || 10))
    const skip = (page - 1) * limit

    const [posts, total] = await Promise.all([
      prisma.newsPost.findMany({
        where: { status: 'published' },
        select: {
          slug: true,
          title: true,
          author: true,
          publishedAt: true,
          monthKey: true,
          summary: true,
          tags: true,
        },
        orderBy: { publishedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.newsPost.count({ where: { status: 'published' } }),
    ])

    const parsed = posts.map((post) => ({
      ...post,
      tags: safeParseJsonArray(post.tags),
    }))

    return NextResponse.json(
      { posts: parsed, total, page, limit },
      { headers: corsHeaders }
    )
  } catch (error) {
    console.error('Public news GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch news posts' },
      { status: 500, headers: corsHeaders }
    )
  }
}

export async function OPTIONS() {
  return new Response(null, {
    headers: corsHeaders,
  })
}
