import { NextResponse } from 'next/server'
import { getSessionFromCookies, isFullyAuthenticated } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { contentBulkSchema } from '@/lib/validation'
import { getPageDef, PAGE_SLUGS } from '@/lib/content-fields'

function isValidPage(page: string): boolean {
  return PAGE_SLUGS.includes(page)
}

export async function GET(
  request: Request,
  { params }: { params: { page: string } }
) {
  const session = await getSessionFromCookies()
  if (!isFullyAuthenticated(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { page } = params

  if (!isValidPage(page)) {
    return NextResponse.json(
      { error: `Invalid page: "${page}". Must be one of: ${PAGE_SLUGS.join(', ')}` },
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
  if (!isFullyAuthenticated(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { page } = params

  if (!isValidPage(page)) {
    return NextResponse.json(
      { error: `Invalid page: "${page}". Must be one of: ${PAGE_SLUGS.join(', ')}` },
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

    // Filter to only accept keys defined in the page's field definitions
    const pageDef = getPageDef(page)
    const allowedKeys = new Set(pageDef?.fields.map((f) => f.key) ?? [])
    const entries = Object.entries(parsed.data).filter(([key]) => allowedKeys.has(key))

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
