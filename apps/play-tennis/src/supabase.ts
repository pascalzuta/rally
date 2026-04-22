import { createClient, SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://gxiflulfgqahlvdirecz.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4aWZsdWxmZ3FhaGx2ZGlyZWN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNTE2NjksImV4cCI6MjA4ODkyNzY2OX0.URWQ_FVCB3DqXGKvb-G6eAKUPBmcso6FHl1gxIWLK-I'

let client: SupabaseClient | null = null

export function initSupabase(): SupabaseClient | null {
  if (client) return client

  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      // OTP-only flow: never auto-consume a session from a URL hash. Without this,
      // clicking (or an email client prefetching) the magic link in the OTP email
      // logs the user in without ever entering the code.
      detectSessionInUrl: false,
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
export async function sendOtp(email: string): Promise<{ ok: boolean; error?: string; status?: number }> {
  if (!client) return { ok: false, error: 'supabase_not_initialized' }

  const { error } = await client.auth.signInWithOtp({
    email,
    // No emailRedirectTo on purpose — we want OTP-only emails. Setting a redirect
    // causes Supabase to render a magic-link email which can be used to bypass
    // OTP entry entirely.
    options: { shouldCreateUser: true },
  })

  if (error) {
    console.warn('[Rally] OTP send failed:', error.status, error.message)
    return { ok: false, error: error.message, status: error.status }
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
 * Fetch a player's full profile from the players table by auth user ID.
 * Returns profile fields if found, null if new user.
 */
export async function fetchPlayerProfile(userId: string): Promise<{
  name: string
  county: string
  email?: string
  skillLevel?: string
  gender?: string
  weeklyCap?: number
  createdAt?: string
} | null> {
  if (!client) return null
  const { data, error } = await client
    .from('players')
    .select('player_name, county, email, sex, experience_level, weekly_cap, created_at')
    .eq('auth_id', userId)
    .eq('player_id', userId)
    .maybeSingle()
  if (error || !data) return null
  return {
    name: data.player_name,
    county: data.county,
    email: data.email ?? undefined,
    skillLevel: data.experience_level ?? undefined,
    gender: data.sex ?? undefined,
    weeklyCap: data.weekly_cap ?? 2,
    createdAt: data.created_at,
  }
}

/**
 * Save or update a player's full profile in the players table.
 * Uses auth_id as the key for upsert.
 */
export async function savePlayerProfile(userId: string, profile: {
  name: string
  county: string
  email?: string
  skillLevel?: string
  gender?: string
  weeklyCap?: number
}): Promise<boolean> {
  if (!client) return false
  const { error } = await client.from('players').upsert({
    player_id: userId,
    auth_id: userId,
    player_name: profile.name,
    county: profile.county.toLowerCase(),
    email: profile.email ?? null,
    sex: profile.gender ?? null,
    experience_level: profile.skillLevel ?? null,
    weekly_cap: profile.weeklyCap ?? 2,
  }, { onConflict: 'player_id' })
  return !error
}
