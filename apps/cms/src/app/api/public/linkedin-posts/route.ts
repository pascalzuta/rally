import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function GET(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown'
  const { success } = rateLimit(`public-linkedin:${ip}`, 60, 60 * 1000)
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: corsHeaders }
    )
  }

  try {
    const posts = await prisma.linkedInPost.findMany({
      where: { active: true },
      orderBy: [{ order: 'asc' }, { postDate: 'desc' }],
      select: {
        embedHtml: true,
        caption: true,
        postDate: true,
        active: true,
        order: true,
      },
    })

    return NextResponse.json(posts, { headers: corsHeaders })
  } catch (error) {
    console.error('Public linkedin-posts GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch LinkedIn posts' },
      { status: 500, headers: corsHeaders }
    )
  }
}

export async function OPTIONS() {
  return new Response(null, {
    headers: corsHeaders,
  })
}
