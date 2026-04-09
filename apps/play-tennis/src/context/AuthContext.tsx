import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User } from '@supabase/supabase-js'
import { PlayerProfile, SkillLevel, Gender } from '../types'
import { getClient, fetchPlayerProfile, savePlayerProfile } from '../supabase'
import { refreshLobbyFromRemote, refreshAvailabilityFromRemote } from '../sync'

interface AuthContextValue {
  user: User | null
  profile: PlayerProfile | null
  loading: boolean
  signOut: () => Promise<void>
  setProfile: (p: PlayerProfile | null) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const PROFILE_KEY = 'play-tennis-profile'

function clearAuthLocalStorage() {
  // Preserve lobby and availability — these are shared/remote data that will be
  // refreshed from Supabase on next login. Clearing them causes the lobby count
  // to reset to 0 and forces users to re-enter availability each session.
  const preserveKeys = new Set(['play-tennis-lobby', 'play-tennis-availability'])
  const keysToRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith('play-tennis-') && !preserveKeys.has(key)) keysToRemove.push(key)
  }
  for (const key of keysToRemove) localStorage.removeItem(key)
}

function buildProfile(userId: string, email: string, data: Awaited<ReturnType<typeof fetchPlayerProfile>>): PlayerProfile | null {
  if (!data) return null
  return {
    id: userId,
    authId: userId,
    email: email || data.email,
    name: data.name,
    county: data.county,
    skillLevel: (data.skillLevel as SkillLevel) ?? undefined,
    gender: (data.gender as Gender) ?? undefined,
    weeklyCap: (data.weeklyCap as PlayerProfile['weeklyCap']) ?? 2,
    createdAt: data.createdAt ?? new Date().toISOString(),
  }
}

/**
 * Recover profile from localStorage when Supabase has no record.
 * Handles the case where savePlayerProfile() failed during registration
 * (network error, offline, etc.). Rewrites the ID to the stable auth UUID
 * and retries the Supabase write.
 *
 * Unlike the previous version, this does NOT require the cached profile's
 * id/authId to match the auth UUID — the whole point is that they diverged.
 * We only require the profile to have a name and county (i.e., registration
 * was actually completed).
 */
function recoverAndAdoptProfile(userId: string, email: string): PlayerProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    if (!raw) return null
    const local = JSON.parse(raw) as PlayerProfile
    if (!local.name || !local.county) return null

    // Rewrite with canonical auth UUID
    const recovered: PlayerProfile = {
      ...local,
      id: userId,
      authId: userId,
      email: email || local.email,
    }

    localStorage.setItem(PROFILE_KEY, JSON.stringify(recovered))

    // Retry saving to Supabase (fire-and-forget — retried on next login if it fails)
    savePlayerProfile(userId, {
      name: recovered.name,
      county: recovered.county,
      email: recovered.email,
      skillLevel: recovered.skillLevel,
      gender: recovered.gender,
      weeklyCap: recovered.weeklyCap,
    }).catch(() => {
      console.warn('[Rally] Failed to backfill profile to Supabase — will retry on next login')
    })

    console.log('[Rally] Recovered profile from localStorage, adopted auth UUID:', userId)
    return recovered
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Instantly restore cached profile from localStorage (no network wait)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfileState] = useState<PlayerProfile | null>(() => {
    try {
      const cached = localStorage.getItem(PROFILE_KEY)
      return cached ? JSON.parse(cached) : null
    } catch { return null }
  })
  // Skip the loading spinner if we already have a cached profile
  const [loading, setLoading] = useState(!profile)

  useEffect(() => {
    const client = getClient()
    if (!client) { setLoading(false); return }

    // Use onAuthStateChange exclusively — INITIAL_SESSION fires on every page load
    // (with session if one exists, null if not) and is the correct Supabase v2 pattern.
    // This avoids the getSession() + onAuthStateChange race condition that caused
    // infinite loading on refresh.
    // Safety timeout: if INITIAL_SESSION never fires or hangs, force loading to false
    const loadingTimeout = setTimeout(() => {
      setLoading(false)
      console.warn('[Rally] Auth loading timeout — forced loading=false after 8s')
    }, 8000)

    const { data: { subscription } } = client.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION') {
        clearTimeout(loadingTimeout)
        // Fires once on mount. Resolves loading regardless of outcome.
        try {
          if (session?.user) {
            const u = session.user
            setUser(u)
            const profileData = await fetchPlayerProfile(u.id)
            const restored = buildProfile(u.id, u.email ?? '', profileData)
            if (restored) {
              localStorage.setItem(PROFILE_KEY, JSON.stringify(restored))
              setProfileState(restored)
              // Eagerly refresh lobby + availability from Supabase so UI shows correct counts
              const county = restored.county.toLowerCase()
              refreshLobbyFromRemote(county)
              refreshAvailabilityFromRemote(county)
            } else {
              // DB fetch returned null — recover from localStorage regardless of
              // whether the cached profile's ID matches. The profile may have been
              // created with a random generateId() before auth was established.
              const recovered = recoverAndAdoptProfile(u.id, u.email ?? '')
              if (recovered) {
                setProfileState(recovered)
                const county = recovered.county.toLowerCase()
                refreshLobbyFromRemote(county)
                refreshAvailabilityFromRemote(county)
              }
            }
          } else if (profile) {
            // No valid session but we have a cached profile — clear stale data
            localStorage.removeItem(PROFILE_KEY)
            setProfileState(null)
          }
        } finally {
          setLoading(false)
        }
      } else if (event === 'SIGNED_IN' && session?.user) {
        // Fires after OTP verify, magic link redirect, or token refresh that upgrades
        // an anonymous session. NOT fired on page refresh (that's INITIAL_SESSION).
        const u = session.user
        setUser(u)
        const profileData = await fetchPlayerProfile(u.id)
        const restored = buildProfile(u.id, u.email ?? '', profileData)
        if (restored) {
          localStorage.setItem(PROFILE_KEY, JSON.stringify(restored))
          setProfileState(restored)
          // Refresh lobby + availability so returning users see correct counts
          const county = restored.county.toLowerCase()
          refreshLobbyFromRemote(county)
          refreshAvailabilityFromRemote(county)
        } else {
          // No profile in DB — recover from localStorage (handles failed
          // registration saves AND profiles created with random IDs)
          const recovered = recoverAndAdoptProfile(u.id, u.email ?? '')
          if (recovered) {
            setProfileState(recovered)
            const county = recovered.county.toLowerCase()
            refreshLobbyFromRemote(county)
            refreshAvailabilityFromRemote(county)
          } else {
            // Truly new user — no profile anywhere
            setProfileState(null)
          }
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setProfileState(null)
        clearAuthLocalStorage()
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        setUser(session.user)
      }
    })

    return () => { clearTimeout(loadingTimeout); subscription.unsubscribe() }
  }, [])

  async function signOut() {
    // Clear local state immediately so the UI updates even if the network call fails
    setUser(null)
    setProfileState(null)
    clearAuthLocalStorage()
    // Then tell Supabase to revoke the session server-side (best-effort)
    try {
      const client = getClient()
      if (client) await client.auth.signOut()
    } catch {
      // Network failure is fine — local state is already cleared
    }
  }

  function setProfile(p: PlayerProfile | null) {
    setProfileState(p)
    if (p) {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(p))
    } else {
      localStorage.removeItem(PROFILE_KEY)
    }
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, setProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
