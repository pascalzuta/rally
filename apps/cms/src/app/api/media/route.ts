import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies, isFullyAuthenticated } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { processImage, validateUpload, sanitizeFilename } from '@/lib/image'

export async function GET() {
  const session = await getSessionFromCookies()
  if (!isFullyAuthenticated(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const assets = await prisma.mediaAsset.findMany({
    orderBy: { createdAt: 'desc' },
  })

  const result = assets.map((asset) => ({
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
  }))

  return NextResponse.json(result)
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies()
  if (!isFullyAuthenticated(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate the upload
    const validation = validateUpload(file.name, file.type, file.size)
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const sanitizedName = sanitizeFilename(file.name)

    // Process image: resize to 512/1024/2048 + webp variants
    const processed = await processImage(buffer, sanitizedName)

    // Create MediaAsset record
    const asset = await prisma.mediaAsset.create({
      data: {
        filename: processed.filename,
        originalName: file.name,
        mimeType: file.type,
        size: processed.size,
        width: processed.width,
        height: processed.height,
        variants: JSON.stringify(processed.variants),
      },
    })

    return NextResponse.json(
      {
        id: asset.id,
        filename: asset.filename,
        originalName: asset.originalName,
        mimeType: asset.mimeType,
        size: asset.size,
        width: asset.width,
        height: asset.height,
        alt: asset.alt,
        variants: processed.variants,
        createdAt: asset.createdAt,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Media upload error:', error)
    return NextResponse.json(
      { error: 'Failed to process upload' },
      { status: 500 }
    )
  }
}
