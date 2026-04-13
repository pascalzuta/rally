/**
 * Platform detection utilities for Capacitor
 *
 * @capacitor/core is ~3KB gzipped and no-ops on web.
 * These checks tree-shake properly — import only what you need.
 */
import { Capacitor } from '@capacitor/core'

export const isNative = Capacitor.isNativePlatform()
export const platform = Capacitor.getPlatform() as 'ios' | 'android' | 'web'
export const isIOS = platform === 'ios'
export const isAndroid = platform === 'android'
export const isWeb = platform === 'web'
