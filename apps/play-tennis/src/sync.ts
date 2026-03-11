import { ref, set, onValue, get, Unsubscribe } from 'firebase/database'
import { initFirebase, isFirebaseConfigured, getDb } from './firebase'
import { Tournament, LobbyEntry, PlayerRating, AvailabilitySlot } from './types'

// Custom event dispatched when remote data arrives
export const SYNC_EVENT = 'rally-sync-update'

function dispatchSync() {
  window.dispatchEvent(new Event(SYNC_EVENT))
}

const STORAGE_KEY = 'play-tennis-data'
const LOBBY_KEY = 'play-tennis-lobby'
const RATINGS_KEY = 'play-tennis-ratings'
const AVAILABILITY_KEY = 'play-tennis-availability'

// --- Firebase write helpers ---

export function syncTournaments(tournaments: Tournament[]): void {
  const db = getDb()
  if (!db) return
  // Group tournaments by county for efficient querying
  const byCounty: Record<string, Tournament[]> = {}
  for (const t of tournaments) {
    const key = t.county.toLowerCase().replace(/[^a-z0-9]/g, '_')
    if (!byCounty[key]) byCounty[key] = []
    byCounty[key].push(t)
  }
  for (const [county, ts] of Object.entries(byCounty)) {
    const tournamentsRef = ref(db, `tournaments/${county}`)
    const map: Record<string, Tournament> = {}
    for (const t of ts) map[t.id] = t
    set(tournamentsRef, map)
  }
}

export function syncLobby(lobby: LobbyEntry[]): void {
  const db = getDb()
  if (!db) return
  const byCounty: Record<string, Record<string, LobbyEntry>> = {}
  for (const e of lobby) {
    const key = e.county.toLowerCase().replace(/[^a-z0-9]/g, '_')
    if (!byCounty[key]) byCounty[key] = {}
    byCounty[key][e.playerId] = e
  }
  // Write each county's lobby
  for (const [county, entries] of Object.entries(byCounty)) {
    set(ref(db, `lobby/${county}`), entries)
  }
}

export function syncLobbyForCounty(county: string, entries: LobbyEntry[]): void {
  const db = getDb()
  if (!db) return
  const key = county.toLowerCase().replace(/[^a-z0-9]/g, '_')
  const map: Record<string, LobbyEntry> = {}
  for (const e of entries) map[e.playerId] = e
  set(ref(db, `lobby/${key}`), map)
}

export function syncTournament(tournament: Tournament): void {
  const db = getDb()
  if (!db) return
  const key = tournament.county.toLowerCase().replace(/[^a-z0-9]/g, '_')
  set(ref(db, `tournaments/${key}/${tournament.id}`), tournament)
}

export function syncRatings(ratings: Record<string, PlayerRating>): void {
  const db = getDb()
  if (!db) return
  set(ref(db, 'ratings'), ratings)
}

export function syncAvailability(playerId: string, slots: AvailabilitySlot[]): void {
  const db = getDb()
  if (!db) return
  set(ref(db, `availability/${playerId}`), slots)
}

// --- Firebase subscribe helpers ---

let unsubscribers: Unsubscribe[] = []

export function subscribeToCounty(county: string): void {
  const db = getDb()
  if (!db) return

  const key = county.toLowerCase().replace(/[^a-z0-9]/g, '_')

  // Subscribe to lobby for this county
  const lobbyRef = ref(db, `lobby/${key}`)
  const unsubLobby = onValue(lobbyRef, (snapshot) => {
    const data = snapshot.val()
    if (!data) return
    const remoteEntries: LobbyEntry[] = Object.values(data)
    // Merge with local lobby: keep local entries from other counties, replace this county's
    const localLobby: LobbyEntry[] = safeParseJSON(localStorage.getItem(LOBBY_KEY), [])
    const otherCounties = localLobby.filter(
      e => e.county.toLowerCase().replace(/[^a-z0-9]/g, '_') !== key
    )
    const merged = [...otherCounties, ...remoteEntries]
    localStorage.setItem(LOBBY_KEY, JSON.stringify(merged))
    dispatchSync()
  })
  unsubscribers.push(unsubLobby)

  // Subscribe to tournaments for this county
  const tournamentsRef = ref(db, `tournaments/${key}`)
  const unsubTournaments = onValue(tournamentsRef, (snapshot) => {
    const data = snapshot.val()
    if (!data) return
    const remoteTournaments: Tournament[] = Object.values(data)
    // Merge with local: replace tournaments from this county, keep others
    const localTournaments: Tournament[] = safeParseJSON(localStorage.getItem(STORAGE_KEY), [])
    const remoteIds = new Set(remoteTournaments.map(t => t.id))
    const otherTournaments = localTournaments.filter(
      t => !remoteIds.has(t.id) && t.county.toLowerCase().replace(/[^a-z0-9]/g, '_') !== key
    )
    const merged = [...remoteTournaments, ...otherTournaments]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
    dispatchSync()
  })
  unsubscribers.push(unsubTournaments)

  // Subscribe to ratings
  const ratingsRef = ref(db, 'ratings')
  const unsubRatings = onValue(ratingsRef, (snapshot) => {
    const data = snapshot.val()
    if (!data) return
    // Merge: remote wins for conflicts
    const localRatings: Record<string, PlayerRating> = safeParseJSON(localStorage.getItem(RATINGS_KEY), {})
    const merged = { ...localRatings, ...data }
    localStorage.setItem(RATINGS_KEY, JSON.stringify(merged))
    dispatchSync()
  })
  unsubscribers.push(unsubRatings)
}

export function unsubscribeAll(): void {
  for (const unsub of unsubscribers) unsub()
  unsubscribers = []
}

// --- Init: push local data to Firebase on first connect, then subscribe ---

export async function initSync(county: string): Promise<void> {
  const db = initFirebase()
  if (!db) return

  const key = county.toLowerCase().replace(/[^a-z0-9]/g, '_')

  // Check if remote has data for this county
  const lobbySnap = await get(ref(db, `lobby/${key}`))
  const tournamentsSnap = await get(ref(db, `tournaments/${key}`))

  // Merge local lobby entries INTO remote (don't overwrite remote)
  const localLobby: LobbyEntry[] = safeParseJSON(localStorage.getItem(LOBBY_KEY), [])
  const localCountyLobby = localLobby.filter(
    e => e.county.toLowerCase().replace(/[^a-z0-9]/g, '_') === key
  )

  if (lobbySnap.exists()) {
    const remoteLobby: Record<string, LobbyEntry> = lobbySnap.val()
    // Add local entries that aren't already remote
    for (const entry of localCountyLobby) {
      if (!remoteLobby[entry.playerId]) {
        remoteLobby[entry.playerId] = entry
      }
    }
    await set(ref(db, `lobby/${key}`), remoteLobby)
  } else if (localCountyLobby.length > 0) {
    // No remote data, push local
    const map: Record<string, LobbyEntry> = {}
    for (const e of localCountyLobby) map[e.playerId] = e
    await set(ref(db, `lobby/${key}`), map)
  }

  // Merge local tournaments INTO remote
  const localTournaments: Tournament[] = safeParseJSON(localStorage.getItem(STORAGE_KEY), [])
  const localCountyTournaments = localTournaments.filter(
    t => t.county.toLowerCase().replace(/[^a-z0-9]/g, '_') === key
  )

  if (tournamentsSnap.exists()) {
    const remoteTournaments: Record<string, Tournament> = tournamentsSnap.val()
    for (const t of localCountyTournaments) {
      if (!remoteTournaments[t.id]) {
        remoteTournaments[t.id] = t
      }
    }
    await set(ref(db, `tournaments/${key}`), remoteTournaments)
  } else if (localCountyTournaments.length > 0) {
    const map: Record<string, Tournament> = {}
    for (const t of localCountyTournaments) map[t.id] = t
    await set(ref(db, `tournaments/${key}`), map)
  }

  // Push local ratings
  const localRatings: Record<string, PlayerRating> = safeParseJSON(localStorage.getItem(RATINGS_KEY), {})
  if (Object.keys(localRatings).length > 0) {
    const ratingsSnap = await get(ref(db, 'ratings'))
    if (ratingsSnap.exists()) {
      const remote = ratingsSnap.val()
      // Merge: keep whichever has more matches played
      for (const [id, local] of Object.entries(localRatings)) {
        if (!remote[id] || local.matchesPlayed > (remote[id]?.matchesPlayed ?? 0)) {
          remote[id] = local
        }
      }
      await set(ref(db, 'ratings'), remote)
    } else {
      await set(ref(db, 'ratings'), localRatings)
    }
  }

  // Now subscribe to real-time updates
  subscribeToCounty(county)
}

function safeParseJSON<T>(data: string | null, fallback: T): T {
  try {
    return data ? JSON.parse(data) : fallback
  } catch {
    return fallback
  }
}
