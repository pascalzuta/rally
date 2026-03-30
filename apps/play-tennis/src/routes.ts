// Route path constants — single source of truth for all navigation
export const ROUTES = {
  HOME: '/',
  BRACKET: '/bracket',
  PLAYNOW: '/playnow',
  PROFILE: '/profile',
  LEADERBOARD: '/leaderboard',
  HELP: '/help',
  ANALYTICS: '/analytics',
  LOGIN: '/login',
  JOIN: '/join',
} as const

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES]

// Map legacy hash routes to new paths (for backward compat)
const HASH_TO_PATH: Record<string, RoutePath> = {
  home: ROUTES.HOME,
  bracket: ROUTES.BRACKET,
  playnow: ROUTES.PLAYNOW,
  profile: ROUTES.PROFILE,
  leaderboard: ROUTES.LEADERBOARD,
  help: ROUTES.HELP,
  analytics: ROUTES.ANALYTICS,
}

/** Redirect legacy #hash URLs to path-based routes */
export function getLegacyHashRedirect(): RoutePath | null {
  const hash = window.location.hash.replace('#', '')
  return HASH_TO_PATH[hash] ?? null
}
