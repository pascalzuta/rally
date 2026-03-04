import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const BUCKET = 'media'

function getClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
}

export async function ensureUploadDir() {
  // No-op for Supabase Storage (bucket created via dashboard)
}

export async function saveFile(filename: string, buffer: Buffer): Promise<string> {
  const supabase = getClient()
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filename, buffer, {
      contentType: inferMimeType(filename),
      upsert: true,
    })

  if (error) throw new Error(`Upload failed: ${error.message}`)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filename)
  return data.publicUrl
}

export async function deleteFile(filename: string): Promise<void> {
  const supabase = getClient()
  await supabase.storage.from(BUCKET).remove([filename])
}

export function getPublicUrl(filename: string): string {
  const supabase = getClient()
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filename)
  return data.publicUrl
}

function inferMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'webp':
      return 'image/webp'
    case 'png':
      return 'image/png'
    default:
      return 'application/octet-stream'
  }
}
