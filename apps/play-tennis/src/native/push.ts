/**
 * Push notification registration and permission handling
 *
 * Permission request strategy:
 * 1. After tournament creation (the "aha moment") — best opt-in rate
 * 2. Second chance: when first match is scheduled
 * 3. Never ask a third time — show Settings redirect instead
 *
 * iOS gives ONE chance via system dialog. The pre-permission priming
 * screen (NotificationPrimer component) should appear BEFORE calling
 * requestPermissions() to maximize opt-in.
 */
import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'

export type PushPermissionStatus = 'granted' | 'denied' | 'prompt' | 'unavailable'

/**
 * Check current push notification permission status
 */
export async function checkPushPermission(): Promise<PushPermissionStatus> {
  if (!Capacitor.isNativePlatform()) return 'unavailable'

  const status = await PushNotifications.checkPermissions()
  return status.receive as PushPermissionStatus
}

/**
 * Request push notification permission and register for tokens.
 * Call this AFTER showing the pre-permission priming screen.
 *
 * Returns the permission result. Token delivery happens asynchronously
 * via the 'registration' listener set up in initPushListeners().
 */
export async function requestPushPermission(): Promise<PushPermissionStatus> {
  if (!Capacitor.isNativePlatform()) return 'unavailable'

  const current = await PushNotifications.checkPermissions()
  if (current.receive === 'granted') {
    // Already granted — just register to get/refresh the token
    await PushNotifications.register()
    return 'granted'
  }

  if (current.receive === 'denied') {
    // User previously denied — can't re-ask, must go to Settings
    return 'denied'
  }

  // Status is 'prompt' — show the system dialog
  const result = await PushNotifications.requestPermissions()
  if (result.receive === 'granted') {
    await PushNotifications.register()
    return 'granted'
  }

  return 'denied'
}

/**
 * Silently register for push if permission was already granted.
 * Call this on app startup — no UI, no prompt.
 */
export async function registerPushIfGranted(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  const status = await PushNotifications.checkPermissions()
  if (status.receive === 'granted') {
    await PushNotifications.register()
  }
}
