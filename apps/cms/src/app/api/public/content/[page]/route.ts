import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

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
  const { page } = params

  if (!isValidPage(page)) {
    return NextResponse.json(
      { error: `Invalid page: "${page}". Must be one of: ${VALID_PAGES.join(', ')}` },
      { status: 400, headers: corsHeaders }
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
