import { NextResponse } from 'next/server'
import { getSessionFromCookies, isAuthenticated } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { contentBulkSchema } from '@/lib/validation'

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

export async function GET(
  request: Request,
  { params }: { params: { page: string } }
) {
  const session = await getSessionFromCookies()
  if (!isAuthenticated(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { page } = params

  if (!isValidPage(page)) {
    return NextResponse.json(
      { error: `Invalid page: "${page}". Must be one of: ${VALID_PAGES.join(', ')}` },
      { status: 400 }
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

    return NextResponse.json({ page, fields })
  } catch (error) {
    console.error('Content GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch content' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { page: string } }
) {
  const session = await getSessionFromCookies()
  if (!isAuthenticated(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { page } = params

  if (!isValidPage(page)) {
    return NextResponse.json(
      { error: `Invalid page: "${page}". Must be one of: ${VALID_PAGES.join(', ')}` },
      { status: 400 }
    )
  }

  try {
    const body = await request.json()
    const parsed = contentBulkSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const entries = Object.entries(parsed.data)

    await Promise.all(
      entries.map(([key, value]) =>
        prisma.contentArea.upsert({
          where: { page_key: { page, key } },
          create: { page, key, value },
          update: { value },
        })
      )
    )

    // Build the response fields from the validated input
    const fields: Record<string, string> = {}
    for (const [key, value] of entries) {
      fields[key] = value
    }

    return NextResponse.json({ page, fields })
  } catch (error) {
    console.error('Content PUT error:', error)
    return NextResponse.json(
      { error: 'Failed to update content' },
      { status: 500 }
    )
  }
}
