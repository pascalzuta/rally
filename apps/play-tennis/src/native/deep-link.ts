/**
 * Deep link handler for push notification taps and Universal Links
 *
 * When a user taps a push notification, we receive a data payload like:
 *   { route: '/bracket', matchId: 'abc-123', action: 'confirm-score' }
 *
 * This module translates that into React Router navigation + custom events
 * for sub-component focusing (e.g., scrolling to a specific match card).
 *
 * Pattern: uses a navigate ref set by App.tsx, consistent with the existing
 * SYNC_EVENT pattern used for Supabase realtime updates.
 */
import type { NavigateFunction } from 'react-router-dom'

let navigateRef: NavigateFunction | null = null
let pendingDeepLink: Record<string, string> | null = null

/**
 * Set the React Router navigate function.
 * Call once from App.tsx after the router is available.
 */
export function setNavigateRef(nav: NavigateFunction): void {
  navigateRef = nav
}

/**
 * Handle a deep link from a push notification tap or Universal Link.
 * If the app hasn't mounted yet, stores it for deferred handling.
 */
export function handleDeepLink(data: Record<string, string>): void {
  if (!navigateRef) {
    // App not yet mounted — store for later
    pendingDeepLink = data
    return
  }

  const route = data.route || '/'

  // Navigate to the correct tab/route
  navigateRef(route)

  // For sub-navigation (e.g., focus a specific match, open score confirmation)
  // dispatch a custom event that the relevant component listens for.
  // This is consistent with the existing rally-sync-update pattern.
  if (data.matchId) {
    window.dispatchEvent(
      new CustomEvent('rally:focus-match', {
        detail: {
          matchId: data.matchId,
          action: data.action || 'view',
        },
      })
    )
  }

  if (data.tournamentId) {
    window.dispatchEvent(
      new CustomEvent('rally:focus-tournament', {
        detail: { tournamentId: data.tournamentId },
      })
    )
  }
}

/**
 * Check for and consume a pending deep link.
 * Call from App.tsx useEffect after the router is ready.
 */
export function consumePendingDeepLink(): Record<string, string> | null {
  const link = pendingDeepLink
  pendingDeepLink = null
  return link
}

/**
 * Parse a Universal Link URL into a deep link data object.
 * Used by the @capacitor/app 'appUrlOpen' listener.
 *
 * Example: https://play-rally.com/bracket?match=abc-123
 *   → { route: '/bracket', matchId: 'abc-123' }
 */
export function parseUniversalLink(url: string): Record<string, string> {
  try {
    const parsed = new URL(url)
    const data: Record<string, string> = {
      route: parsed.pathname || '/',
    }
    const matchId = parsed.searchParams.get('match')
    if (matchId) data.matchId = matchId
    const tournamentId = parsed.searchParams.get('tournament')
    if (tournamentId) data.tournamentId = tournamentId
    return data
  } catch {
    return { route: '/' }
  }
}
