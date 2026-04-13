/**
 * Native (Capacitor) module barrel export
 *
 * All native-specific code lives in this directory.
 * On web, Capacitor plugins no-op — safe to import everywhere.
 */
export { isNative, isIOS, isAndroid, isWeb, platform } from './platform'
export { checkPushPermission, requestPushPermission, registerPushIfGranted } from './push'
export { initPushListeners, teardownPushListeners, setForegroundNotificationHandler } from './push-listeners'
export { setNavigateRef, handleDeepLink, consumePendingDeepLink, parseUniversalLink } from './deep-link'
export { initNativeApp } from './init'
