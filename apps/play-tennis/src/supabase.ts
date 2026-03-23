import { createClient, SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://gxiflulfgqahlvdirecz.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4aWZsdWxmZ3FhaGx2ZGlyZWN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNTE2NjksImV4cCI6MjA4ODkyNzY2OX0.URWQ_FVCB3DqXGKvb-G6eAKUPBmcso6FHl1gxIWLK-I'

let client: SupabaseClient | null = null

// Initialize immediately so magic link hash tokens are picked up on page load
export function initSupabase(): SupabaseClient | null {
  if (client) return client

  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      detectSessionInUrl: true,
    },
  })
  return client
}

// Auto-init on module load so the client exists before any component renders
initSupabase()

export function getClient(): SupabaseClient | null {
  return client
}

/**
 * Send an OTP code to the given email address.
 * Works for both new and returning users.
 */
export async function sendOtp(email: string): Promise<{ ok: boolean; error?: string }> {
  if (!client) return { ok: false, error: 'supabase_not_initialized' }

  const { error } = await client.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  })

  if (error) {
    console.warn('[Rally] OTP send failed:', error.message)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

/**
 * Verify the OTP code the user received via email.
 * On success, establishes a Supabase auth session.
 */
export async function verifyOtp(
  email: string,
  token: string,
): Promise<{ ok: boolean; userId?: string; error?: string }> {
  if (!client) return { ok: false, error: 'supabase_not_initialized' }

  const { data, error } = await client.auth.verifyOtp({
    email,
    token,
    type: 'email',
  })

  if (error) {
    console.warn('[Rally] OTP verify failed:', error.message)
    return { ok: false, error: error.message }
  }

  return { ok: true, userId: data.user?.id }
}

/**
 * Check for an existing authenticated session.
 * Returns the user ID and email if a session exists, null otherwise.
 */
export async function getSession(): Promise<{ userId: string; email: string } | null> {
  if (!client) return null
  const { data } = await client.auth.getSession()
  if (!data.session?.user) return null
  return {
    userId: data.session.user.id,
    email: data.session.user.email ?? '',
  }
}

/**
 * Sign out and clear the Supabase session.
 */
export async function signOut(): Promise<void> {
  if (!client) return
  await client.auth.signOut()
}

/**
 * Get the current auth user ID, or null if not authenticated.
 */
export async function getAuthUserId(): Promise<string | null> {
  if (!client) return null
  const { data } = await client.auth.getSession()
  return data.session?.user?.id ?? null
}

/**
 * Listen for auth state changes (magic link redirect, session refresh, etc.)
 * Returns an unsubscribe function.
 */
export function onAuthStateChange(
  callback: (event: string, userId: string | null, email: string | null) => void,
): () => void {
  if (!client) return () => {}
  const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
    callback(event, session?.user?.id ?? null, session?.user?.email ?? null)
  })
  return () => subscription.unsubscribe()
}

/**
 * Check if a player already exists in the lobby table by their auth user ID.
 * Returns their name and county if found, null otherwise.
 */
export async function fetchExistingPlayer(userId: string): Promise<{ name: string; county: string } | null> {
  if (!client) return null
  const { data, error } = await client.from('lobby').select('player_name, county').eq('player_id', userId).maybeSingle()
  if (error || !data) return null
  return { name: data.player_name, county: data.county }
}
