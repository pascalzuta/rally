import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Strip whitespace/newlines that can sneak in from env variables
// (Vercel has been known to add trailing \n which breaks WebSocket connections)
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || 'https://gxiflulfgqahlvdirecz.supabase.co').trim()
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4aWZsdWxmZ3FhaGx2ZGlyZWN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNTE2NjksImV4cCI6MjA4ODkyNzY2OX0.URWQ_FVCB3DqXGKvb-G6eAKUPBmcso6FHl1gxIWLK-I').trim()

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
 * Test emails that bypass OTP verification (auto-confirmed via edge function).
 * Only active on staging and localhost — disabled in production.
 */
const isStaging = typeof window !== 'undefined' && (
  window.location.hostname === 'staging.play-rally.com' ||
  window.location.hostname === 'localhost'
)

const TEST_EMAILS = isStaging
  ? new Set(Array.from({ length: 27 }, (_, i) => `pascal.zuta+test${1001 + i}@gmail.com`))
  : new Set<string>()

export function isTestEmail(email: string): boolean {
  return TEST_EMAILS.has(email.toLowerCase().trim())
}

/**
 * Send an OTP code to the given email address.
 * Works for both new and returning users.
 * Test emails (pascal.zuta+test1001-1008@gmail.com) skip the real OTP send.
 */
export async function sendOtp(email: string): Promise<{ ok: boolean; error?: string; status?: number; autoVerified?: boolean }> {
  if (!client) return { ok: false, error: 'supabase_not_initialized' }

  // Test emails: auto-authenticate via edge function (skip OTP entirely)
  if (isTestEmail(email)) {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/test-auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim() }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok || !data.token_hash) {
        return { ok: false, error: data.error || 'Test auth failed' }
      }
      // Verify the token hash to establish a real Supabase session
      const { error: verifyError } = await client.auth.verifyOtp({
        token_hash: data.token_hash,
        type: 'magiclink',
      })
      if (verifyError) {
        return { ok: false, error: verifyError.message }
      }
      // Session is now active — AuthContext's onAuthStateChange will fire SIGNED_IN
      return { ok: true, autoVerified: true }
    } catch {
      return { ok: false, error: 'Test auth request failed' }
    }
  }

  const { error } = await client.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: window.location.origin },
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
 * Test emails use the test-auth edge function instead of real OTP verification.
 */
export async function verifyOtp(
  email: string,
  token: string,
): Promise<{ ok: boolean; userId?: string; error?: string }> {
  if (!client) return { ok: false, error: 'supabase_not_initialized' }

  // Test emails: use edge function to auto-authenticate
  if (isTestEmail(email)) {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/test-auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim() }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        return { ok: false, error: data.error || 'Test auth failed' }
      }
      // Use the token hash to verify OTP via Supabase client (establishes session)
      if (data.token_hash) {
        const { data: verifyData, error: verifyError } = await client.auth.verifyOtp({
          token_hash: data.token_hash,
          type: 'magiclink',
        })
        if (verifyError) {
          console.warn('[Rally] Test auth verify failed:', verifyError.message)
          return { ok: false, error: verifyError.message }
        }
        return { ok: true, userId: verifyData.user?.id }
      }
      return { ok: false, error: 'No token hash returned' }
    } catch (err) {
      console.warn('[Rally] Test auth error:', err)
      return { ok: false, error: 'Test auth request failed' }
    }
  }

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
 * Sign in with Google OAuth.
 * Redirects the user to Google's consent screen, then back to the app.
 */
export async function signInWithGoogle(): Promise<{ ok: boolean; error?: string }> {
  if (!client) return { ok: false, error: 'supabase_not_initialized' }

  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  })

  if (error) {
    console.warn('[Rally] Google sign-in failed:', error.message)
    return { ok: false, error: error.message }
  }
  return { ok: true }
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
  // Use .not('email', 'is', null) + .limit(1) instead of .maybeSingle() because
  // seeded bot players may share the same auth_id. The real user always has an email.
  const { data: rows, error } = await client
    .from('players')
    .select('player_name, county, email, sex, experience_level, weekly_cap, created_at')
    .eq('auth_id', userId)
    .not('email', 'is', null)
    .limit(1)
  if (error || !rows || rows.length === 0) return null
  const data = rows[0]
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
