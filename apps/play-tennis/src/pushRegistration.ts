/**
 * Push notification registration for both native (Capacitor) and web.
 * Handles permission requests, token retrieval, and server registration.
 */

import { Capacitor } from '@capacitor/core'
import { getClient } from './supabase'

type PermissionStatus = 'granted' | 'denied' | 'default' | 'unknown'

export async function checkPushPermission(): Promise<PermissionStatus> {
  if (Capacitor.isNativePlatform()) {
    const { PushNotifications } = await import('@capacitor/push-notifications')
    const result = await PushNotifications.checkPermissions()
    if (result.receive === 'granted') return 'granted'
    if (result.receive === 'denied') return 'denied'
    return 'default'
  }

  // Web: check Notification API
  if ('Notification' in window) {
    return Notification.permission as PermissionStatus
  }
  return 'unknown'
}

export async function requestPushPermission(): Promise<PermissionStatus> {
  if (Capacitor.isNativePlatform()) {
    const { PushNotifications } = await import('@capacitor/push-notifications')
    const result = await PushNotifications.requestPermissions()
    if (result.receive === 'granted') return 'granted'
    if (result.receive === 'denied') return 'denied'
    return 'default'
  }

  // Web: use Notification API
  if ('Notification' in window) {
    const result = await Notification.requestPermission()
    return result as PermissionStatus
  }
  return 'unknown'
}

export async function registerDeviceToken(playerId: string): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    return registerNativeToken(playerId)
  }
  // Web push registration deferred to Phase 2 (needs service worker + VAPID)
  return false
}

async function registerNativeToken(playerId: string): Promise<boolean> {
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')

    return new Promise<boolean>((resolve) => {
      // Set up one-time listener for registration result
      const timeout = setTimeout(() => resolve(false), 10_000)

      PushNotifications.addListener('registration', async (token) => {
        clearTimeout(timeout)
        try {
          await saveTokenToServer(playerId, token.value, Capacitor.getPlatform() as 'ios' | 'android')
          resolve(true)
        } catch {
          resolve(false)
        }
      })

      PushNotifications.addListener('registrationError', () => {
        clearTimeout(timeout)
        resolve(false)
      })

      PushNotifications.register()
    })
  } catch {
    return false
  }
}

async function saveTokenToServer(playerId: string, token: string, platform: 'ios' | 'android' | 'web'): Promise<void> {
  const client = getClient()
  if (!client) throw new Error('Supabase not initialized')

  // Use the upsert_device_token RPC which handles insert-or-update
  const { error } = await client.rpc('upsert_device_token', {
    p_player_id: playerId,
    p_token: token,
    p_platform: platform,
  })
  if (error) throw error
}

export async function hasActiveToken(playerId: string): Promise<boolean> {
  const client = getClient()
  if (!client) return false

  const { data, error } = await client
    .from('device_tokens')
    .select('id')
    .eq('player_id', playerId)
    .eq('active', true)
    .limit(1)

  if (error) return false
  return (data?.length ?? 0) > 0
}

export function canOpenSettings(): boolean {
  return Capacitor.isNativePlatform()
}

export async function openAppSettings(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    // On iOS, opening 'app-settings:' URL opens the app's settings page
    // On Android, we'd need NativeSettings plugin, but for now just open the URL
    try {
      const { Browser } = await import('@capacitor/browser')
      if (Capacitor.getPlatform() === 'ios') {
        await Browser.open({ url: 'app-settings:' })
      }
    } catch {
      // Fallback: user needs to go to Settings manually
    }
  }
}
