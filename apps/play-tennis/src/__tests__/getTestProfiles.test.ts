import { describe, it, expect, afterEach } from 'vitest'
import { getTestProfiles } from '../store'
import { registerBridge, unregisterBridge } from '../storeBridge'
import type { LobbyEntry, Tournament } from '../types'

const MARIN = 'Marin County, CA'

function lobbyEntry(name: string, id: string, county: string): LobbyEntry {
  return { playerId: id, playerName: name, county, joinedAt: '2026-01-01T00:00:00Z' }
}

function tournament(over: Partial<Tournament> & Pick<Tournament, 'id' | 'county' | 'status' | 'players'>): Tournament {
  return {
    name: 'T', date: '2026-01-01', format: 'round-robin', matches: [],
    createdAt: '2026-01-01T00:00:00Z', ...over,
  } as unknown as Tournament
}

// Minimal in-memory bridge: only lobby + tournaments matter for getTestProfiles.
function setupBridge(lobby: LobbyEntry[], tournaments: Tournament[]) {
  const noop = () => {}
  registerBridge({
    getLobby: () => lobby,
    getTournaments: () => tournaments,
    getRatings: () => ({}),
    getAvailability: () => ({}),
    getTrophies: () => [],
    getBadges: () => [],
    getRatingHistory: () => ({}),
    getFeedback: () => [],
    getEtiquetteScores: () => ({}),
    getBroadcasts: () => [],
    getMatchOffers: () => [],
    getNotifications: () => [],
    getMessages: () => [],
    getReactions: () => [],
    getReliabilityScores: () => ({}),
    getPendingVictories: () => [],
    getPendingFeedback: () => null,
    setLobby: noop, setTournaments: noop, setRatings: noop, setAvailability: noop,
    setTrophies: noop, setBadges: noop, setRatingHistory: noop, setFeedback: noop,
    setEtiquetteScores: noop, setBroadcasts: noop, setMatchOffers: noop,
    setNotifications: noop, setMessages: noop, setReactions: noop,
    setReliabilityScores: noop, setPendingVictories: noop, setPendingFeedback: noop,
    refresh: async () => {},
    showError: noop, showSuccess: noop,
  } as never)
}

function idFor(profiles: ReturnType<typeof getTestProfiles>, name: string): string | undefined {
  return profiles.find(p => p.name === name)?.id
}

afterEach(() => unregisterBridge())

describe('getTestProfiles ID resolution', () => {
  it('resolves a player to their ACTIVE tournament id, never a stale lobby placeholder', () => {
    // The exact regression: Casey has a junk "test-4" placeholder in the lobby,
    // a real id in a completed tournament, and a different real id in the live
    // in-progress tournament. Membership (App.tsx) keys on the tournament id, so
    // the switcher must resolve to the in-progress id.
    setupBridge(
      [lobbyEntry('Casey Brooks', 'test-4', MARIN)],
      [
        tournament({ id: 't-done', county: 'marin county, ca', status: 'completed',
          players: [{ id: 'casey-completed', name: 'Casey Brooks' }] }),
        tournament({ id: 't-live', county: 'marin county, ca', status: 'in-progress',
          players: [{ id: 'casey-inprogress', name: 'Casey Brooks' }] }),
      ],
    )

    const casey = idFor(getTestProfiles(MARIN), 'Casey Brooks')
    expect(casey).toBe('casey-inprogress')
    expect(casey).not.toBe('test-4')        // not the lobby placeholder
    expect(casey).not.toBe('casey-completed') // not the stale completed tournament
  })

  it('falls back to the lobby id for players not yet in any tournament', () => {
    setupBridge(
      [lobbyEntry('Morgan Lee', 'morgan-lobby-id', MARIN)],
      [],
    )
    expect(idFor(getTestProfiles(MARIN), 'Morgan Lee')).toBe('morgan-lobby-id')
  })

  it('scopes resolution to the requested county', () => {
    // A Casey in a different county's tournament must not leak into Marin.
    setupBridge(
      [],
      [tournament({ id: 't-sf', county: 'san francisco county, ca', status: 'in-progress',
        players: [{ id: 'casey-sf', name: 'Casey Brooks' }] })],
    )
    const casey = idFor(getTestProfiles(MARIN), 'Casey Brooks')
    expect(casey).not.toBe('casey-sf')
    expect(casey).toMatch(/^test-/) // unresolved → placeholder
  })
})
