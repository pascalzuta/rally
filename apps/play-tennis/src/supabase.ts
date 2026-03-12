import { createClient, SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

export function isSupabaseConfigured(): boolean {
  return !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
}

export function initSupabase(): SupabaseClient | null {
  if (client) return client
  if (!isSupabaseConfigured()) return null

  client = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
  )
  return client
}

export function getClient(): SupabaseClient | null {
  return client
}
