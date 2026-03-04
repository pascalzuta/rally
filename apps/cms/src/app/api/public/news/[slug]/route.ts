import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  const { slug } = params

  try {
    const post = await prisma.newsPost.findUnique({
      where: { slug, status: 'published' },
      include: { pages: { orderBy: { pageNum: 'asc' } } },
    })

    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404, headers: corsHeaders }
      )
    }

    const parsed = {
      ...post,
      tags: typeof post.tags === 'string' ? JSON.parse(post.tags) : post.tags,
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
