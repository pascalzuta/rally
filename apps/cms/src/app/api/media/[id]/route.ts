import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies, isAuthenticated } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { deleteFile } from '@/lib/storage'

interface RouteParams {
  params: { id: string }
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await getSessionFromCookies()
  if (!isAuthenticated(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = params

  const asset = await prisma.mediaAsset.findUnique({
    where: { id },
  })

  if (!asset) {
    return NextResponse.json({ error: 'Media not found' }, { status: 404 })
  }

  return NextResponse.json({
    id: asset.id,
    filename: asset.filename,
    originalName: asset.originalName,
    mimeType: asset.mimeType,
    size: asset.size,
    width: asset.width,
    height: asset.height,
    alt: asset.alt,
    variants: JSON.parse(asset.variants),
    createdAt: asset.createdAt,
  })
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await getSessionFromCookies()
  if (!isAuthenticated(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = params

  const body = await request.json()
  const alt = typeof body.alt === 'string' ? body.alt.trim() : undefined

  if (alt === undefined) {
    return NextResponse.json(
      { error: 'Missing "alt" field' },
      { status: 400 }
    )
  }

  const asset = await prisma.mediaAsset.findUnique({ where: { id } })
  if (!asset) {
    return NextResponse.json({ error: 'Media not found' }, { status: 404 })
  }

  const updated = await prisma.mediaAsset.update({
    where: { id },
    data: { alt },
  })

  return NextResponse.json({
    id: updated.id,
    filename: updated.filename,
    originalName: updated.originalName,
    alt: updated.alt,
  })
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await getSessionFromCookies()
  if (!isAuthenticated(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = params

  const asset = await prisma.mediaAsset.findUnique({
    where: { id },
  })

  if (!asset) {
    return NextResponse.json({ error: 'Media not found' }, { status: 404 })
  }

  // Delete variant files from disk
  const variants = JSON.parse(asset.variants)
  const filesToDelete: string[] = [asset.filename]

  for (const sizeKey of Object.keys(variants)) {
    const sizeVariants = variants[sizeKey]
    if (sizeVariants.jpg) {
      const jpgFilename = sizeVariants.jpg.replace('/uploads/', '')
      filesToDelete.push(jpgFilename)
    }
    if (sizeVariants.webp) {
      const webpFilename = sizeVariants.webp.replace('/uploads/', '')
      filesToDelete.push(webpFilename)
    }
  }

  await Promise.all(filesToDelete.map((f) => deleteFile(f)))

  // Delete DB record
  await prisma.mediaAsset.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
