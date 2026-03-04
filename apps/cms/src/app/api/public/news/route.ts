import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function GET() {
  try {
    const posts = await prisma.newsPost.findMany({
      where: { status: 'published' },
      include: { pages: { orderBy: { pageNum: 'asc' } } },
      orderBy: { publishedAt: 'desc' },
    })

    const parsed = posts.map((post) => ({
      ...post,
      tags: typeof post.tags === 'string' ? JSON.parse(post.tags) : post.tags,
    }))

    return NextResponse.json(parsed, { headers: corsHeaders })
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
