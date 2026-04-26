/**
 * RallyDataProvider — Single source of truth for all domain data.
 *
 * Replaces localStorage as the read layer. All persistent data is fetched
 * from Supabase on mount, held in React state, and kept in sync via
 * Supabase Realtime subscriptions.
 *
 * Components read from this context (never from localStorage).
 * Mutations go through store.ts functions which write to Supabase
 * and then call the updater functions exposed here.
 *
 * Data lifecycle:
 *   Mount → fetch from Supabase → populate state
 *   Realtime event → refresh from Supabase → update state
 *   User action → store.ts writes to Supabase → updates state via callback
 *   Page refresh → re-fetch from Supabase (no localStorage)
 */

import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react'
import { useAuth } from './AuthContext'
import { useToast } from '../components/Toast'
import { getClient } from '../supabase'
import { registerBridge, unregisterBridge } from '../storeBridge'
import {
  Tournament, LobbyEntry, PlayerRating, AvailabilitySlot,
  Trophy, Badge, RatingSnapshot, MatchFeedback, EtiquetteScore,
  MatchBroadcast, MatchOffer, RallyNotification, DirectMessage,
  MatchReaction, ReliabilityScore,
} from '../types'
import type { RealtimeChannel } from '@supabase/supabase-js'

// ── App version (placeholder for future version mismatch detection) ──
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const _APP_VERSION = '1.0.0'

// ── Ephemeral state types (no Supabase table, lives in React state only) ──

export interface PendingVictory {
  tier: 'champion' | 'finalist' | 'semifinalist'
  tournamentName: string
  playerId: string
}

export interface PendingFeedback {
  matchId: string
  tournamentId: string
  opponentId: string
  opponentName: string
}

// ── Context value ──

export interface RallyData {
  // Core data (Supabase-backed)
  lobby: LobbyEntry[]
  tournaments: Tournament[]
  ratings: Record<string, PlayerRating>
  availability: Record<string, AvailabilitySlot[]>
  trophies: Trophy[]
  badges: Badge[]
  ratingHistory: Record<string, RatingSnapshot[]>
  feedback: MatchFeedback[]
  etiquetteScores: Record<string, EtiquetteScore>

  // Ephemeral data (React state only — lost on refresh)
  broadcasts: MatchBroadcast[]
  matchOffers: MatchOffer[]
  notifications: RallyNotification[]
  messages: DirectMessage[]
  reactions: MatchReaction[]
  reliabilityScores: Record<string, ReliabilityScore>
  pendingVictories: PendingVictory[]
  pendingFeedback: PendingFeedback | null

  // Loading state
  loading: boolean
  /** True once the initial Supabase fetch completes */
  hydrated: boolean
  /** True when hydration failed (network error, Supabase down, etc.) */
  hydrationFailed: boolean

  // ── Updater functions (called by store.ts after Supabase writes) ──
  setLobby: React.Dispatch<React.SetStateAction<LobbyEntry[]>>
  setTournaments: React.Dispatch<React.SetStateAction<Tournament[]>>
  setRatings: React.Dispatch<React.SetStateAction<Record<string, PlayerRating>>>
  setAvailability: React.Dispatch<React.SetStateAction<Record<string, AvailabilitySlot[]>>>
  setTrophies: React.Dispatch<React.SetStateAction<Trophy[]>>
  setBadges: React.Dispatch<React.SetStateAction<Badge[]>>
  setRatingHistory: React.Dispatch<React.SetStateAction<Record<string, RatingSnapshot[]>>>
  setFeedback: React.Dispatch<React.SetStateAction<MatchFeedback[]>>
  setEtiquetteScores: React.Dispatch<React.SetStateAction<Record<string, EtiquetteScore>>>
  setBroadcasts: React.Dispatch<React.SetStateAction<MatchBroadcast[]>>
  setMatchOffers: React.Dispatch<React.SetStateAction<MatchOffer[]>>
  setNotifications: React.Dispatch<React.SetStateAction<RallyNotification[]>>
  setMessages: React.Dispatch<React.SetStateAction<DirectMessage[]>>
  setReactions: React.Dispatch<React.SetStateAction<MatchReaction[]>>
  setReliabilityScores: React.Dispatch<React.SetStateAction<Record<string, ReliabilityScore>>>
  setPendingVictories: React.Dispatch<React.SetStateAction<PendingVictory[]>>
  setPendingFeedback: React.Dispatch<React.SetStateAction<PendingFeedback | null>>

  /** Force a re-fetch of all data from Supabase */
  refresh: () => Promise<void>
}

export const RallyDataContext = createContext<RallyData | null>(null)

// ── Supabase fetch helpers ──

async function fetchLobby(county: string): Promise<LobbyEntry[]> {
  const client = getClient()
  if (!client) return []
  const { data } = await client.from('lobby').select('*').eq('county', county.toLowerCase())
  if (!data) return []
  return data.map(row => ({
    playerId: row.player_id,
    playerName: row.player_name,
    county: row.county?.toLowerCase() ?? county.toLowerCase(),
    joinedAt: row.joined_at,
    gender: row.sex ?? undefined,
    skillLevel: row.experience_level ?? undefined,
  }))
}

async function fetchTournaments(county: string): Promise<Tournament[]> {
  const client = getClient()
  if (!client) return []
  const { data } = await client.from('tournaments').select('*').eq('county', county.toLowerCase())
  if (!data) return []
  return data.map(row => row.data as Tournament)
}

async function fetchRatings(): Promise<Record<string, PlayerRating>> {
  const client = getClient()
  if (!client) return {}
  const { data } = await client.from('ratings').select('*')
  if (!data) return {}
  const result: Record<string, PlayerRating> = {}
  for (const row of data) result[row.player_id] = row.data as PlayerRating
  return result
}

async function fetchAvailability(county: string): Promise<Record<string, AvailabilitySlot[]>> {
  const client = getClient()
  if (!client) return {}
  const { data } = await client.from('availability').select('*').eq('county', county.toLowerCase())
  if (!data) return {}
  const result: Record<string, AvailabilitySlot[]> = {}
  for (const row of data) result[row.player_id] = row.slots as AvailabilitySlot[]
  return result
}

async function fetchTrophies(playerId: string): Promise<Trophy[]> {
  const client = getClient()
  if (!client) return []
  const { data } = await client.from('trophies').select('*').eq('player_id', playerId)
  if (!data) return []
  return data.map(row => ({
    id: row.id,
    playerId: row.player_id,
    playerName: row.player_name,
    tournamentId: row.tournament_id,
    tournamentName: row.tournament_name,
    county: row.county,
    tier: row.tier as Trophy['tier'],
    date: row.date,
    awardedAt: row.awarded_at,
    ...(row.final_match ? { finalMatch: row.final_match } : {}),
  }))
}

async function fetchBadges(playerId: string): Promise<Badge[]> {
  const client = getClient()
  if (!client) return []
  const { data } = await client.from('badges').select('*').eq('player_id', playerId)
  if (!data) return []
  return data.map(row => ({
    id: row.id,
    playerId: row.player_id,
    type: row.badge_type as Badge['type'],
    label: row.label,
    description: row.description,
    awardedAt: row.awarded_at,
    ...(row.tournament_id ? { tournamentId: row.tournament_id } : {}),
  }))
}

async function fetchRatingHistory(playerId: string): Promise<RatingSnapshot[]> {
  const client = getClient()
  if (!client) return []
  const { data } = await client.from('rating_history').select('rating, recorded_at')
    .eq('player_id', playerId).order('recorded_at', { ascending: true })
  if (!data) return []
  return data.map(row => ({ rating: Number(row.rating), timestamp: row.recorded_at }))
}

// ── Provider ──

export function RallyDataProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const { showError, showSuccess } = useToast()
  const channelRef = useRef<RealtimeChannel | null>(null)

  // Core Supabase-backed state
  const [lobby, setLobby] = useState<LobbyEntry[]>([])
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [ratings, setRatings] = useState<Record<string, PlayerRating>>({})
  const [availability, setAvailability] = useState<Record<string, AvailabilitySlot[]>>({})
  const [trophies, setTrophies] = useState<Trophy[]>([])
  const [badges, setBadges] = useState<Badge[]>([])
  const [ratingHistory, setRatingHistory] = useState<Record<string, RatingSnapshot[]>>({})
  const [feedback, setFeedback] = useState<MatchFeedback[]>([])
  const [etiquetteScores, setEtiquetteScores] = useState<Record<string, EtiquetteScore>>({})

  // Ephemeral state (no Supabase table — lost on refresh, and that's OK)
  const [broadcasts, setBroadcasts] = useState<MatchBroadcast[]>([])
  const [matchOffers, setMatchOffers] = useState<MatchOffer[]>([])
  const [notifications, setNotifications] = useState<RallyNotification[]>([])
  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [reactions, setReactions] = useState<MatchReaction[]>([])
  const [reliabilityScores, setReliabilityScores] = useState<Record<string, ReliabilityScore>>({})
  const [pendingVictories, setPendingVictories] = useState<PendingVictory[]>([])
  const [pendingFeedback, setPendingFeedback] = useState<PendingFeedback | null>(null)

  const [loading, setLoading] = useState(true)
  const [hydrated, setHydrated] = useState(false)
  const [hydrationFailed, setHydrationFailed] = useState(false)

  // ── Hydrate from Supabase on mount / profile change ──

  const hydrateAll = useCallback(async () => {
    if (!profile) {
      setLoading(false)
      return
    }

    const county = profile.county.toLowerCase()
    setHydrationFailed(false)

    try {
      // Fetch core data in parallel
      const [lobbyData, tournamentsData, ratingsData, availData, trophiesData, badgesData, historyData] =
        await Promise.all([
          fetchLobby(county),
          fetchTournaments(county),
          fetchRatings(),
          fetchAvailability(county),
          fetchTrophies(profile.id),
          fetchBadges(profile.id),
          fetchRatingHistory(profile.id),
        ])

      setLobby(lobbyData)
      setTournaments(tournamentsData)
      setRatings(ratingsData)
      setAvailability(availData)
      setTrophies(trophiesData)
      setBadges(badgesData)
      setRatingHistory(prev => ({ ...prev, [profile.id]: historyData }))

      // One-time backfill: replay completed matches to fix ratings/history
      // for users whose matches completed via simulation/auto-confirm paths
      // that historically didn't apply ELO updates.
      try {
        const { backfillRatingsFromMatches } = await import('../store')
        const result = await backfillRatingsFromMatches({ tournaments: tournamentsData })
        if (result) {
          setRatings(result.ratings)
          setRatingHistory(result.history)
        }
      } catch (err) {
        console.warn('[Rally] Rating backfill skipped:', err)
      }
    } catch (err) {
      console.error('[Rally] Failed to hydrate data from Supabase:', err)
      setHydrationFailed(true)
      showError('Could not load data — check your connection')
    } finally {
      setLoading(false)
      setHydrated(true)
    }
  }, [profile?.id, profile?.county])

  useEffect(() => {
    // Subscribe FIRST, then hydrate — prevents missing changes during fetch
    const client = getClient()
    if (client && profile) {
      const county = profile.county.toLowerCase()

      if (channelRef.current) channelRef.current.unsubscribe()

      const channel = client.channel(`rally-${county}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'lobby', filter: `county=eq.${county}` }, () => {
          fetchLobby(county).then(setLobby)
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments', filter: `county=eq.${county}` }, () => {
          fetchTournaments(county).then(setTournaments)
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'availability', filter: `county=eq.${county}` }, () => {
          fetchAvailability(county).then(setAvailability)
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'ratings' }, () => {
          fetchRatings().then(setRatings)
        })
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR') {
            console.warn('[Rally] Realtime channel error — will retry on next mount')
          }
        })

      channelRef.current = channel
    }

    // Then hydrate (any changes during fetch will be caught by subscription above)
    hydrateAll()

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe()
        channelRef.current = null
      }
    }
  }, [hydrateAll])

  // ── Clean up on sign out (profile goes null) ──

  useEffect(() => {
    if (!profile) {
      setLobby([])
      setTournaments([])
      setRatings({})
      setAvailability({})
      setTrophies([])
      setBadges([])
      setRatingHistory({})
      setFeedback([])
      setEtiquetteScores({})
      setBroadcasts([])
      setMatchOffers([])
      setNotifications([])
      setMessages([])
      setReactions([])
      setReliabilityScores({})
      setPendingVictories([])
      setPendingFeedback(null)
      setHydrated(false)
    }
  }, [profile])

  // ── Cross-tab sync via BroadcastChannel ──
  // When one tab writes data, it broadcasts a "refresh" message.
  // Other tabs re-fetch from Supabase to stay in sync.

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return // SSR / old browsers
    const bc = new BroadcastChannel('rally-data-sync')
    bc.onmessage = (event) => {
      if (event.data === 'refresh' && profile) {
        hydrateAll()
      }
    }
    return () => bc.close()
  }, [profile?.id, hydrateAll])

  // ── Register bridge so store.ts can access state without React hooks ──

  useEffect(() => {
    registerBridge({
      getLobby: () => lobby,
      getTournaments: () => tournaments,
      getRatings: () => ratings,
      getAvailability: () => availability,
      getTrophies: () => trophies,
      getBadges: () => badges,
      getRatingHistory: () => ratingHistory,
      getFeedback: () => feedback,
      getEtiquetteScores: () => etiquetteScores,
      getBroadcasts: () => broadcasts,
      getMatchOffers: () => matchOffers,
      getNotifications: () => notifications,
      getMessages: () => messages,
      getReactions: () => reactions,
      getReliabilityScores: () => reliabilityScores,
      getPendingVictories: () => pendingVictories,
      getPendingFeedback: () => pendingFeedback,
      setLobby, setTournaments, setRatings, setAvailability,
      setTrophies, setBadges, setRatingHistory, setFeedback,
      setEtiquetteScores, setBroadcasts, setMatchOffers,
      setNotifications, setMessages, setReactions,
      setReliabilityScores, setPendingVictories, setPendingFeedback,
      refresh: hydrateAll,
      showError,
      showSuccess,
    })
    return () => unregisterBridge()
  }) // No deps — re-register on every render so getters capture latest state

  const value: RallyData = {
    lobby, tournaments, ratings, availability, trophies, badges,
    ratingHistory, feedback, etiquetteScores,
    broadcasts, matchOffers, notifications, messages, reactions,
    reliabilityScores, pendingVictories, pendingFeedback,
    loading, hydrated, hydrationFailed,
    setLobby, setTournaments, setRatings, setAvailability,
    setTrophies, setBadges, setRatingHistory, setFeedback,
    setEtiquetteScores, setBroadcasts, setMatchOffers,
    setNotifications, setMessages, setReactions,
    setReliabilityScores, setPendingVictories, setPendingFeedback,
    refresh: hydrateAll,
  }

  if (hydrationFailed && !hydrated) {
    return (
      <RallyDataContext.Provider value={value}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 12 }}>
          <p style={{ color: '#666' }}>Could not connect to server</p>
          <button onClick={() => hydrateAll()} style={{ padding: '8px 24px', borderRadius: 8, border: '1px solid #ccc', background: '#fff', cursor: 'pointer' }}>
            Retry
          </button>
        </div>
      </RallyDataContext.Provider>
    )
  }

  return (
    <RallyDataContext.Provider value={value}>
      {children}
    </RallyDataContext.Provider>
  )
}

// ── Hook ──

export function useRallyData(): RallyData {
  const ctx = useContext(RallyDataContext)
  if (!ctx) throw new Error('useRallyData must be used inside RallyDataProvider')
  return ctx
}

// ── Convenience hooks (computed from base data) ──

export function useLobby(county?: string): LobbyEntry[] {
  const { lobby } = useRallyData()
  if (!county) return lobby
  const key = county.toLowerCase()
  return lobby.filter(e => e.county.toLowerCase() === key)
}

export function usePlayerTournaments(playerId: string | undefined): Tournament[] {
  const { tournaments } = useRallyData()
  if (!playerId) return []
  return tournaments.filter(t => t.players.some(p => p.id === playerId))
}

export function useTournamentsByCounty(county?: string): Tournament[] {
  const { tournaments } = useRallyData()
  if (!county) return tournaments
  const key = county.toLowerCase()
  return tournaments.filter(t => t.county.toLowerCase() === key)
}

export function useTournament(id: string | undefined): Tournament | undefined {
  const { tournaments } = useRallyData()
  if (!id) return undefined
  return tournaments.find(t => t.id === id)
}

export function usePlayerRating(playerId: string | undefined): PlayerRating | undefined {
  const { ratings } = useRallyData()
  if (!playerId) return undefined
  return ratings[playerId]
}
