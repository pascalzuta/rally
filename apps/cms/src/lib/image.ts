import sharp from 'sharp'
import { nanoid } from 'nanoid'
import path from 'path'
import { saveFile } from './storage'

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const SIZES = [
  { key: 'sm', width: 512 },
  { key: 'md', width: 1024 },
  { key: 'lg', width: 2048 },
] as const

type SizeKey = (typeof SIZES)[number]['key']

interface ImageVariantFormats {
  jpg: string
  webp: string
}

interface ProcessedImage {
  filename: string
  width: number
  height: number
  size: number
  variants: Record<SizeKey, ImageVariantFormats>
}

interface ValidationResult {
  valid: boolean
  error?: string
}

export async function processImage(
  buffer: Buffer,
  originalName: string
): Promise<ProcessedImage> {
  const id = nanoid(12)
  const ext = path.extname(originalName).toLowerCase() || '.jpg'
  const baseName = `${id}-original${ext}`

  // Save the original file
  await saveFile(baseName, buffer)

  // Get metadata from the original image
  const metadata = await sharp(buffer).metadata()
  const originalWidth = metadata.width ?? 0
  const originalHeight = metadata.height ?? 0
  const originalSize = buffer.length

  // Generate resized variants
  const variants = {} as Record<SizeKey, ImageVariantFormats>

  for (const { key, width } of SIZES) {
    // Only resize if the original is wider than the target size
    const resizeWidth = originalWidth > width ? width : originalWidth

    const jpgFilename = `${id}-${key}.jpg`
    const webpFilename = `${id}-${key}.webp`

    const resized = sharp(buffer).resize(resizeWidth, null, {
      withoutEnlargement: true,
      fit: 'inside',
    })

    const [jpgBuffer, webpBuffer] = await Promise.all([
      resized.clone().jpeg({ quality: 85 }).toBuffer(),
      resized.clone().webp({ quality: 80 }).toBuffer(),
    ])

    const [jpgUrl, webpUrl] = await Promise.all([
      saveFile(jpgFilename, jpgBuffer),
      saveFile(webpFilename, webpBuffer),
    ])

    variants[key] = {
      jpg: jpgUrl,
      webp: webpUrl,
    }
  }

  return {
    filename: baseName,
    width: originalWidth,
    height: originalHeight,
    size: originalSize,
    variants,
  }
}

export function validateUpload(
  filename: string,
  mimeType: string,
  fileSize: number
): ValidationResult {
  // Check mime type
  if (!ALLOWED_MIMES.includes(mimeType as (typeof ALLOWED_MIMES)[number])) {
    return {
      valid: false,
      error: `Invalid file type "${mimeType}". Allowed: ${ALLOWED_MIMES.join(', ')}`,
    }
  }

  // Check file size
  if (fileSize > MAX_FILE_SIZE) {
    const maxMb = MAX_FILE_SIZE / (1024 * 1024)
    const fileMb = (fileSize / (1024 * 1024)).toFixed(1)
    return {
      valid: false,
      error: `File too large (${fileMb}MB). Maximum allowed: ${maxMb}MB`,
    }
  }

  // Sanitize and validate filename
  const sanitized = sanitizeFilename(filename)
  if (!sanitized) {
    return {
      valid: false,
      error: 'Invalid filename after sanitization',
    }
  }

  return { valid: true }
}

export function sanitizeFilename(filename: string): string {
  // Get extension and name separately
  const ext = path.extname(filename).toLowerCase()
  const name = path.basename(filename, ext)

  // Remove special characters, keep alphanumeric, hyphens, underscores
  const sanitized = name
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  if (!sanitized) return ''

  return `${sanitized}${ext}`
}
