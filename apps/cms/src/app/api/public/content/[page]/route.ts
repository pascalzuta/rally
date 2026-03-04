import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'

const VALID_PAGES = [
  'home',
  'structure',
  'investment',
  'sectors',
  'team',
  'contact',
  'news',
] as const

type ValidPage = (typeof VALID_PAGES)[number]

function isValidPage(page: string): page is ValidPage {
  return (VALID_PAGES as readonly string[]).includes(page)
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function GET(
  request: Request,
  { params }: { params: { page: string } }
) {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown'
  const { success } = rateLimit(`public-content:${ip}`, 60, 60 * 1000)
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: corsHeaders }
    )
  }

  const { page } = params

  if (!isValidPage(page)) {
    return NextResponse.json(
      { error: 'Page not found' },
      { status: 404, headers: corsHeaders }
    )
  }

  try {
    const contentAreas = await prisma.contentArea.findMany({
      where: { page },
    })

    const fields: Record<string, string> = {}
    for (const area of contentAreas) {
      fields[area.key] = area.value
    }

    return NextResponse.json({ page, fields }, { headers: corsHeaders })
  } catch (error) {
    console.error('Public content GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch content' },
      { status: 500, headers: corsHeaders }
    )
  }
}

export async function OPTIONS() {
  return new Response(null, {
    headers: corsHeaders,
  })
}
