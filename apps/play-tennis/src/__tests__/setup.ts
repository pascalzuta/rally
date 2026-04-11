// Minimal DOM polyfills so store.ts (which expects localStorage) runs in Node.
import { vi, beforeEach } from 'vitest'
import { registerBridge } from '../storeBridge'

class MemoryStorage {
  private data = new Map<string, string>()
  get length() { return this.data.size }
  key(i: number) { return Array.from(this.data.keys())[i] ?? null }
  getItem(k: string) { return this.data.has(k) ? this.data.get(k)! : null }
  setItem(k: string, v: string) { this.data.set(k, String(v)) }
  removeItem(k: string) { this.data.delete(k) }
  clear() { this.data.clear() }
}

;(globalThis as unknown as { localStorage: Storage }).localStorage = new MemoryStorage() as unknown as Storage
;(globalThis as unknown as { window: unknown }).window =
  (globalThis as unknown as { window?: unknown }).window ?? { location: { origin: 'http://localhost' } }

// Mock the Supabase module so store.ts doesn't try to talk to the network.
vi.mock('../supabase', () => ({
  getClient: () => null,
  initSupabase: () => null,
  sendOtp: async () => ({ ok: true }),
  verifyOtp: async () => ({ ok: true, userId: 'test-user' }),
  getSession: async () => null,
  signOut: async () => {},
  getAuthUserId: async () => null,
  onAuthStateChange: () => () => {},
  fetchPlayerProfile: async () => null,
  savePlayerProfile: async () => true,
}))

// Mock sync.ts so writes don't hit the network. All sync calls report success.
vi.mock('../sync', () => {
  const ok = async () => ({ success: true })
  return {
    SUPABASE_PRIMARY: false, // treat as offline-only — write only to localStorage
    syncTournament: ok,
    syncTournaments: ok,
    syncLobbyEntry: ok,
    syncRemoveLobbyEntry: ok,
    syncRatings: ok,
    syncRatingsForPlayer: ok,
    syncLobbyForCounty: ok,
    syncAvailabilityToRemote: ok,
    fetchAvailabilityForPlayers: async () => ({}),
    getTournamentTimestamp: () => null,
    setTournamentTimestamp: () => {},
    refreshTournamentById: async () => null,
    refreshLobbyFromRemote: async () => {},
    refreshAvailabilityFromRemote: async () => {},
    syncRatingSnapshot: ok,
    syncTrophiesToRemote: ok,
    syncBadgesToRemote: ok,
  }
})

// Mock the backend API so the tournament engine uses the legacy offline path.
vi.mock('../api', () => ({
  isApiConfigured: () => false,
  apiJoinLobby: async () => false,
  apiLeaveLobby: async () => false,
}))

// ── In-memory bridge stub ──
// store.ts reads/writes all state through storeBridge, which is normally populated
// by RallyDataProvider at runtime. In Node tests there's no provider, so we install
// a plain-object stub that mirrors React's useState semantics (value or updater fn).
type Slot<T> = { value: T }
function makeSlot<T>(initial: T): Slot<T> { return { value: initial } }
function makeSetter<T>(slot: Slot<T>): (u: T | ((prev: T) => T)) => void {
  return (u: T | ((prev: T) => T)) => {
    slot.value = typeof u === 'function' ? (u as (p: T) => T)(slot.value) : u
  }
}

function resetBridge() {
  const lobby = makeSlot<unknown[]>([])
  const tournaments = makeSlot<unknown[]>([])
  const ratings = makeSlot<Record<string, unknown>>({})
  const availability = makeSlot<Record<string, unknown>>({})
  const trophies = makeSlot<unknown[]>([])
  const badges = makeSlot<unknown[]>([])
  const ratingHistory = makeSlot<Record<string, unknown>>({})
  const feedback = makeSlot<unknown[]>([])
  const etiquetteScores = makeSlot<Record<string, unknown>>({})
  const broadcasts = makeSlot<unknown[]>([])
  const matchOffers = makeSlot<unknown[]>([])
  const notifications = makeSlot<unknown[]>([])
  const messages = makeSlot<unknown[]>([])
  const reactions = makeSlot<unknown[]>([])
  const reliabilityScores = makeSlot<Record<string, unknown>>({})
  const pendingVictories = makeSlot<unknown[]>([])
  const pendingFeedback = makeSlot<unknown>(null)

  registerBridge({
    getLobby: () => lobby.value as never,
    getTournaments: () => tournaments.value as never,
    getRatings: () => ratings.value as never,
    getAvailability: () => availability.value as never,
    getTrophies: () => trophies.value as never,
    getBadges: () => badges.value as never,
    getRatingHistory: () => ratingHistory.value as never,
    getFeedback: () => feedback.value as never,
    getEtiquetteScores: () => etiquetteScores.value as never,
    getBroadcasts: () => broadcasts.value as never,
    getMatchOffers: () => matchOffers.value as never,
    getNotifications: () => notifications.value as never,
    getMessages: () => messages.value as never,
    getReactions: () => reactions.value as never,
    getReliabilityScores: () => reliabilityScores.value as never,
    getPendingVictories: () => pendingVictories.value as never,
    getPendingFeedback: () => pendingFeedback.value as never,
    setLobby: makeSetter(lobby) as never,
    setTournaments: makeSetter(tournaments) as never,
    setRatings: makeSetter(ratings) as never,
    setAvailability: makeSetter(availability) as never,
    setTrophies: makeSetter(trophies) as never,
    setBadges: makeSetter(badges) as never,
    setRatingHistory: makeSetter(ratingHistory) as never,
    setFeedback: makeSetter(feedback) as never,
    setEtiquetteScores: makeSetter(etiquetteScores) as never,
    setBroadcasts: makeSetter(broadcasts) as never,
    setMatchOffers: makeSetter(matchOffers) as never,
    setNotifications: makeSetter(notifications) as never,
    setMessages: makeSetter(messages) as never,
    setReactions: makeSetter(reactions) as never,
    setReliabilityScores: makeSetter(reliabilityScores) as never,
    setPendingVictories: makeSetter(pendingVictories) as never,
    setPendingFeedback: makeSetter(pendingFeedback) as never,
    refresh: async () => {},
    showError: (m: string) => console.warn('[Rally test]', m),
    showSuccess: () => {},
  })
}

// Install once up front AND reset between tests so data doesn't leak across cases.
resetBridge()
beforeEach(() => { resetBridge() })
