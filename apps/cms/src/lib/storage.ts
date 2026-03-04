import { promises as fs } from 'fs'
import path from 'path'

const UPLOAD_DIR = process.env.UPLOAD_DIR || './public/uploads'

export async function ensureUploadDir() {
  await fs.mkdir(path.resolve(UPLOAD_DIR), { recursive: true })
}

export async function saveFile(filename: string, buffer: Buffer): Promise<string> {
  await ensureUploadDir()
  const filePath = path.join(path.resolve(UPLOAD_DIR), filename)
  await fs.writeFile(filePath, buffer)
  return `/uploads/${filename}`
}

export async function deleteFile(filename: string): Promise<void> {
  const filePath = path.join(path.resolve(UPLOAD_DIR), filename)
  try {
    await fs.unlink(filePath)
  } catch {
    // File may not exist, that's ok
  }
}

export function getPublicUrl(filename: string): string {
  return `/uploads/${filename}`
}
