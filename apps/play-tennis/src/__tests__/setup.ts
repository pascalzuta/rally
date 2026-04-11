// Minimal DOM polyfills so store.ts (which expects localStorage) runs in Node.
import { vi } from 'vitest'

class MemoryStorage {
  private data = new Map<string, string>()
  get length() { return this.data.size }
  key(i: number) { return Array.from(this.data.keys())[i] ?? null }
  getItem(k: string) { return this.data.has(k) ? this.data.get(k)! : null }
  setItem(k: string, v: string) { this.data.set(k, String(v)) }
  removeItem(k: string) { this.data.delete(k) }
  clear() { this.data.clear() }
}

// @ts-expect-error polyfill
globalThis.localStorage = new MemoryStorage()
// @ts-expect-error polyfill
globalThis.window = globalThis.window ?? { location: { origin: 'http://localhost' } }

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
