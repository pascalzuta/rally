/**
 * Lightweight feature flag module.
 *
 * Flags resolve in priority order:
 *   1. URL query string — `?newhome=1` / `?newhome=0` (also persists to localStorage)
 *   2. localStorage      — key `rally-ff-<flagName>` = '1' | '0'
 *   3. Vite env          — `VITE_FF_<FLAG_NAME>` = '1' | '0'
 *   4. Default (below)
 *
 * Adding a flag: extend `FLAGS` with its default, then call `isEnabled('name')`.
 */

export type FlagName = 'newHome'

const FLAGS: Record<FlagName, { default: boolean; urlParam: string; envKey: string }> = {
  newHome: { default: false, urlParam: 'newhome', envKey: 'VITE_FF_NEW_HOME' },
}

function readUrlOverride(urlParam: string): '1' | '0' | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const v = params.get(urlParam)
  if (v === '1' || v === 'true' || v === 'on') return '1'
  if (v === '0' || v === 'false' || v === 'off') return '0'
  return null
}

function storageKey(name: FlagName): string {
  return `rally-ff-${name}`
}

function readStorage(name: FlagName): '1' | '0' | null {
  if (typeof window === 'undefined') return null
  try {
    const v = window.localStorage.getItem(storageKey(name))
    if (v === '1' || v === '0') return v
  } catch {
    // localStorage may be unavailable in private mode / some embedded webviews
  }
  return null
}

function writeStorage(name: FlagName, value: '1' | '0'): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey(name), value)
  } catch {
    // best-effort persistence
  }
}

function readEnv(envKey: string): '1' | '0' | null {
  const v = (import.meta.env as Record<string, string | undefined>)[envKey]
  if (v === '1' || v === 'true') return '1'
  if (v === '0' || v === 'false') return '0'
  return null
}

export function isEnabled(name: FlagName): boolean {
  const def = FLAGS[name]

  const urlOverride = readUrlOverride(def.urlParam)
  if (urlOverride !== null) {
    writeStorage(name, urlOverride)
    return urlOverride === '1'
  }

  const stored = readStorage(name)
  if (stored !== null) return stored === '1'

  const env = readEnv(def.envKey)
  if (env !== null) return env === '1'

  return def.default
}
