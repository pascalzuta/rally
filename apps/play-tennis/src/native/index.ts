/**
 * Native (Capacitor) module barrel export
 *
 * All native-specific code lives in this directory.
 * On web, Capacitor plugins no-op — safe to import everywhere.
 */
export { isNative, isIOS, isAndroid, isWeb, platform } from './platform'
export { setNavigateRef, handleDeepLink, consumePendingDeepLink, parseUniversalLink } from './deep-link'
export { initNativeApp } from './init'
