/**
 * Native app initialization
 *
 * Called once from main.tsx or App.tsx after auth resolves.
 * Sets up all Capacitor plugin listeners and handles app lifecycle.
 */
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'
import { handleDeepLink, parseUniversalLink } from './deep-link'
import { handleOAuthCallback } from '../supabase'

/**
 * Initialize all native features.
 * Call after auth state is resolved and user ID is known.
 */
export async function initNativeApp(userId: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  // 1. Style the status bar to match Rally's theme
  try {
    await StatusBar.setStyle({ style: Style.Light })
    // On Android, set the background color
    if (Capacitor.getPlatform() === 'android') {
      await StatusBar.setBackgroundColor({ color: '#ffffff' })
    }
  } catch {
    // StatusBar not available (e.g., older device)
  }

  // 2. Listen for Universal Links (play-rally.com URLs opening the app)
  CapApp.addListener('appUrlOpen', async (event) => {
    // OAuth callback: /auth/callback#access_token=...
    if (event.url.includes('/auth/callback')) {
      await handleOAuthCallback(event.url)
      return
    }
    const data = parseUniversalLink(event.url)
    handleDeepLink(data)
  })

  // 3. Listen for app state changes (foreground/background)
  CapApp.addListener('appStateChange', (state) => {
    if (state.isActive) {
      // App came to foreground — refresh data
      window.dispatchEvent(new CustomEvent('rally-app-resumed'))
    }
  })

  // 4. Hide splash screen now that everything is initialized
  await SplashScreen.hide({ fadeOutDuration: 300 })
}
