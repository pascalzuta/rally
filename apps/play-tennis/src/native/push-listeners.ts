/**
 * Push notification event listeners
 *
 * Initialize ONCE at app startup (after auth resolves).
 * Handles:
 * - Token registration/refresh → upsert to Supabase
 * - Foreground notifications → in-app toast
 * - Notification tap → deep link to correct screen
 */
import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import type { PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications'
import { getClient } from '../supabase'
import { handleDeepLink } from './deep-link'

let listenersInitialized = false

// Callback for showing in-app notifications when app is in foreground
type ForegroundHandler = (notification: PushNotificationSchema) => void
let onForegroundNotification: ForegroundHandler | null = null

export function setForegroundNotificationHandler(handler: ForegroundHandler): void {
  onForegroundNotification = handler
}

/**
 * Initialize all push notification listeners.
 * Must be called after the user is authenticated.
 * Safe to call multiple times — only initializes once.
 */
export function initPushListeners(userId: string): void {
  if (listenersInitialized) return
  if (!Capacitor.isNativePlatform()) return
  listenersInitialized = true

  // Token received (initial registration + every refresh)
  PushNotifications.addListener('registration', async (token) => {
    const client = getClient()
    if (!client) return

    // Upsert: if this token already exists, update the player_id
    // (handles re-login on same device)
    const { error } = await client.rpc('upsert_device_token', {
      p_player_id: userId,
      p_token: token.value,
      p_platform: Capacitor.getPlatform(),
      p_app_version: __APP_VERSION__,
    })

    if (error) {
      console.error('[Push] Token registration failed:', error)
    } else {
      console.log('[Push] Token registered for', Capacitor.getPlatform())
    }
  })

  // Registration error
  PushNotifications.addListener('registrationError', (err) => {
    console.error('[Push] Registration error:', err.error)
  })

  // Foreground notification — OS does NOT show system notification
  // We must render our own in-app banner/toast
  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('[Push] Foreground notification:', notification.title)
    if (onForegroundNotification) {
      onForegroundNotification(notification)
    }
  })

  // User tapped a notification (app was in background or killed)
  PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
    console.log('[Push] Notification tapped:', action.notification.data)
    const data = action.notification.data as Record<string, string>
    handleDeepLink(data)
  })
}

/**
 * Remove all push listeners. Call on logout.
 */
export async function teardownPushListeners(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  await PushNotifications.removeAllListeners()
  listenersInitialized = false
}

// Declare the build-time constant (injected by Vite define)
declare const __APP_VERSION__: string
