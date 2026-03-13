import { createClient, SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://gxiflulfgqahlvdirecz.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4aWZsdWxmZ3FhaGx2ZGlyZWN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNTE2NjksImV4cCI6MjA4ODkyNzY2OX0.URWQ_FVCB3DqXGKvb-G6eAKUPBmcso6FHl1gxIWLK-I'

let client: SupabaseClient | null = null
let authReady = false

export function initSupabase(): SupabaseClient | null {
  if (client) return client

  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  return client
}

export function getClient(): SupabaseClient | null {
  return client
}

/**
 * Ensure the user has an anonymous auth session.
 * Called once on app mount. If the user already has a session (from a
 * previous visit), this is a no-op. Otherwise creates an anonymous user.
 * This is required for RLS policies to work (they check auth.uid()).
 */
export async function ensureAuth(): Promise<string | null> {
  if (!client) return null
  if (authReady) {
    const { data } = await client.auth.getSession()
    return data.session?.user?.id ?? null
  }

  // Check for existing session first
  const { data: existing } = await client.auth.getSession()
  if (existing.session) {
    authReady = true
    return existing.session.user.id
  }

  // No session — sign in anonymously
  try {
    const { data, error } = await client.auth.signInAnonymously()
    if (error) {
      console.warn('[Rally] Anonymous auth failed:', error.message)
      return null
    }
    authReady = true
    return data.session?.user?.id ?? null
  } catch (err) {
    console.warn('[Rally] Anonymous auth error:', err)
    return null
  }
}

/**
 * Get the current auth user ID, or null if not authenticated.
 */
export async function getAuthUserId(): Promise<string | null> {
  if (!client) return null
  const { data } = await client.auth.getSession()
  return data.session?.user?.id ?? null
}
