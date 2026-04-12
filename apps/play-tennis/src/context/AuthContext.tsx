import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User } from '@supabase/supabase-js'
import { PlayerProfile, SkillLevel, Gender } from '../types'
import { getClient, fetchPlayerProfile } from '../supabase'
import { getItem, setItem, removeItem, clear as clearMemoryStore } from '../memoryStore'

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
  clearMemoryStore()
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfileState] = useState<PlayerProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const client = getClient()
    if (!client) { setLoading(false); return }

    // Resolve initial session once, then rely on onAuthStateChange for all updates
    client.auth.getSession().then(async ({ data }) => {
      const sessionUser = data.session?.user ?? null
      if (sessionUser) {
        const profileData = await fetchPlayerProfile(sessionUser.id)
        const restored = buildProfile(sessionUser.id, sessionUser.email ?? '', profileData)
        if (restored) {
          setItem(PROFILE_KEY, JSON.stringify(restored))
          setProfileState(restored)
        }
        setUser(sessionUser)
      }
      setLoading(false)
    })

    const { data: { subscription } } = client.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const u = session.user
        setUser(u)
        const profileData = await fetchPlayerProfile(u.id)
        const restored = buildProfile(u.id, u.email ?? '', profileData)
        if (restored) {
          setItem(PROFILE_KEY, JSON.stringify(restored))
          setProfileState(restored)
        } else {
          // New user — authenticated but not yet registered
          setProfileState(null)
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setProfileState(null)
        clearAuthLocalStorage()
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        setUser(session.user)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signOut() {
    const client = getClient()
    if (client) await client.auth.signOut()
    // SIGNED_OUT event handler above clears state and localStorage
  }

  function setProfile(p: PlayerProfile | null) {
    setProfileState(p)
    if (p) {
      setItem(PROFILE_KEY, JSON.stringify(p))
    } else {
      removeItem(PROFILE_KEY)
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
