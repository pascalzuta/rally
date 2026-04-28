/**
 * Native social login (iOS) using @capgo/capacitor-social-login.
 *
 * Why this exists: the previous Google OAuth flow opened SFSafariViewController
 * (via @capacitor/browser) and relied on a Universal Link callback. That always
 * showed a browser to the user and broke onboarding. This module uses the
 * native iOS Google Sign-In SDK and Apple's ASAuthorizationController — both
 * return an ID token directly to the app with zero browser exposure. The ID
 * token is then handed to supabase.auth.signInWithIdToken() to establish a
 * session.
 *
 * Initialization happens once at app startup (see native/init.ts). The
 * iOS Google client ID is loaded from VITE_GOOGLE_IOS_CLIENT_ID. If that env
 * var is missing, the native Google button falls back to "not configured"
 * and the existing browser-based flow remains as a last-resort path.
 */
import { Capacitor } from '@capacitor/core'
import { SocialLogin } from '@capgo/capacitor-social-login'
import { getClient } from '../supabase'

let initialized = false
let initPromise: Promise<boolean> | null = null

const IOS_GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_IOS_CLIENT_ID || '').trim()

export function isNativeSocialLoginAvailable(): boolean {
  return Capacitor.isNativePlatform()
}

export function isNativeGoogleConfigured(): boolean {
  return Capacitor.isNativePlatform() && IOS_GOOGLE_CLIENT_ID.length > 0
}

/**
 * Initialize the social login plugin. Idempotent — safe to call multiple times.
 * Returns true on success, false if iOS client ID is missing or init failed.
 */
export async function initSocialLogin(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  if (initialized) return true
  if (initPromise) return initPromise

  initPromise = (async () => {
    try {
      const config: Parameters<typeof SocialLogin.initialize>[0] = {}
      if (IOS_GOOGLE_CLIENT_ID) {
        config.google = { iOSClientId: IOS_GOOGLE_CLIENT_ID, mode: 'online' }
      }
      // Apple needs no config on iOS — uses the bundle identifier automatically
      config.apple = {}
      await SocialLogin.initialize(config)
      initialized = true
      return true
    } catch (err) {
      console.warn('[Rally] SocialLogin.initialize failed:', err)
      return false
    }
  })()
  return initPromise
}

/**
 * Native Google sign-in — fully in-app, no browser.
 * Returns ok=true after Supabase session is established.
 */
export async function nativeGoogleSignIn(): Promise<{ ok: boolean; error?: string }> {
  const client = getClient()
  if (!client) return { ok: false, error: 'supabase_not_initialized' }
  if (!isNativeGoogleConfigured()) {
    return { ok: false, error: 'ios_google_client_id_missing' }
  }
  if (!(await initSocialLogin())) {
    return { ok: false, error: 'social_login_init_failed' }
  }

  try {
    const result = await SocialLogin.login({ provider: 'google', options: {} })
    if (result.provider !== 'google') {
      return { ok: false, error: 'unexpected_provider' }
    }
    if (result.result.responseType !== 'online' || !result.result.idToken) {
      return { ok: false, error: 'no_id_token' }
    }
    const { error } = await client.auth.signInWithIdToken({
      provider: 'google',
      token: result.result.idToken,
    })
    if (error) {
      console.warn('[Rally] Supabase signInWithIdToken (google) failed:', error.message)
      return { ok: false, error: error.message }
    }
    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // User-cancelled is not an error worth surfacing
    if (/cancel/i.test(msg)) return { ok: false, error: 'cancelled' }
    console.warn('[Rally] nativeGoogleSignIn failed:', msg)
    return { ok: false, error: msg }
  }
}

/**
 * Native Apple sign-in — uses ASAuthorizationController (system sheet, in-app).
 * Required by App Store guideline 4.8 when offering Google sign-in on iOS.
 */
export async function nativeAppleSignIn(): Promise<{ ok: boolean; error?: string }> {
  const client = getClient()
  if (!client) return { ok: false, error: 'supabase_not_initialized' }
  if (!Capacitor.isNativePlatform()) {
    return { ok: false, error: 'native_only' }
  }
  if (!(await initSocialLogin())) {
    return { ok: false, error: 'social_login_init_failed' }
  }

  // Generate a random nonce; Apple signs it into the JWT, Supabase verifies it.
  const nonce = generateNonce()

  try {
    const result = await SocialLogin.login({
      provider: 'apple',
      options: { scopes: ['name', 'email'], nonce },
    })
    if (result.provider !== 'apple' || !result.result.idToken) {
      return { ok: false, error: 'no_id_token' }
    }
    const { error } = await client.auth.signInWithIdToken({
      provider: 'apple',
      token: result.result.idToken,
      nonce,
    })
    if (error) {
      console.warn('[Rally] Supabase signInWithIdToken (apple) failed:', error.message)
      return { ok: false, error: error.message }
    }
    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (/cancel/i.test(msg)) return { ok: false, error: 'cancelled' }
    console.warn('[Rally] nativeAppleSignIn failed:', msg)
    return { ok: false, error: msg }
  }
}

function generateNonce(): string {
  const arr = new Uint8Array(16)
  crypto.getRandomValues(arr)
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}
