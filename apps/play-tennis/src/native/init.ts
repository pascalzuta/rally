/**
 * Native app initialization
 *
 * Two phases:
 * 1. initNativeListeners() — called at app startup BEFORE auth, registers
 *    the appUrlOpen listener so OAuth callbacks are caught.
 * 2. initNativeApp() — called after auth resolves, sets up status bar,
 *    app state listeners, and hides the splash screen.
 */
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'
import { handleDeepLink, parseUniversalLink } from './deep-link'
import { handleOAuthCallback } from '../supabase'
import { initSocialLogin } from './social-auth'

let listenersInitialized = false

/**
 * Register the appUrlOpen listener early, BEFORE auth resolves.
 * This ensures OAuth Universal Link callbacks are caught even when the user
 * is not yet authenticated.
 */
export function initNativeListeners(): void {
  if (!Capacitor.isNativePlatform() || listenersInitialized) return
  listenersInitialized = true

  // Initialize native social login (Google + Apple) — fire-and-forget so the
  // listener registration is not blocked by plugin init.
  void initSocialLogin()

  // Listen for Universal Links (play-rally.com URLs opening the app)
  CapApp.addListener('appUrlOpen', async (event) => {
    console.log('[Rally] appUrlOpen:', event.url)
    // OAuth callback: /auth/callback?code=... or /auth/callback#access_token=...
    if (event.url.includes('/auth/callback')) {
      await handleOAuthCallback(event.url)
      return
    }
    const data = parseUniversalLink(event.url)
    handleDeepLink(data)
  })
}

/**
 * Initialize all native features.
 * Call after auth state is resolved and user ID is known.
 */
export async function initNativeApp(userId: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  // Ensure listeners are registered (idempotent)
  initNativeListeners()

  // 1. Style the status bar to match Rally's theme
  try {
    await StatusBar.setStyle({ style: Style.Light })
    if (Capacitor.getPlatform() === 'android') {
      await StatusBar.setBackgroundColor({ color: '#ffffff' })
    }
  } catch {
    // StatusBar not available (e.g., older device)
  }

  // 2. Listen for app state changes (foreground/background)
  CapApp.addListener('appStateChange', (state) => {
    if (state.isActive) {
      window.dispatchEvent(new CustomEvent('rally-app-resumed'))
    }
  })

  // 3. Hide splash screen now that everything is initialized
  await SplashScreen.hide({ fadeOutDuration: 300 })
}
