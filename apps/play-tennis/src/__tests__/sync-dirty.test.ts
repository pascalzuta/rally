/**
 * Regression tests for the sync dirty-tracking added after the 2026-07-09 E2E
 * findings: a local change whose push failed (RLS denial / offline) must
 * survive remote pulls instead of being silently clobbered.
 *
 * Tests the REAL sync.ts (no module mock) — only the Supabase client is
 * stubbed out (null = offline), which makes every push fail.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../supabase', () => ({
  getClient: () => null,
  getAuthUserId: async () => null,
}))

import {
  markTournamentDirty, clearTournamentDirty,
  markRatingDirty, clearRatingDirty,
  mergeTournamentsWithDirty, mergeRatingsWithDirty,
  retryDirtySync, hasDirtyData,
} from '../sync'
import type { Tournament, PlayerRating } from '../types'

function tourney(id: string, name: string): Tournament {
  return {
    id, name, date: '2026-07-01', county: 'testville', format: 'round-robin',
    players: [], matches: [], status: 'in-progress', createdAt: '2026-07-01T00:00:00.000Z',
  }
}

beforeEach(() => {
  // Reset registry between tests
  clearTournamentDirty('t1')
  clearTournamentDirty('t2')
  clearRatingDirty('p1')
})

describe('dirty tournaments survive remote pulls', () => {
  it('merge keeps the dirty local copy over the stale remote one', () => {
    const localT1 = tourney('t1', 'local edit')
    markTournamentDirty(localT1)

    const remote = [tourney('t1', 'stale remote'), tourney('t2', 'other')]
    const merged = mergeTournamentsWithDirty(remote)

    expect(merged.find(t => t.id === 't1')?.name).toBe('local edit')
    expect(merged.find(t => t.id === 't2')?.name).toBe('other')
  })

  it('merge re-adds a dirty tournament missing from the remote snapshot', () => {
    const localOnly = tourney('t1', 'never synced')
    markTournamentDirty(localOnly)

    const merged = mergeTournamentsWithDirty([tourney('t2', 'other')])
    expect(merged.map(t => t.id).sort()).toEqual(['t1', 't2'])
  })

  it('merge is a pass-through when nothing is dirty', () => {
    const remote = [tourney('t1', 'remote')]
    expect(mergeTournamentsWithDirty(remote)).toBe(remote)
  })

  it('clearTournamentDirty stops the overlay', () => {
    markTournamentDirty(tourney('t1', 'local'))
    clearTournamentDirty('t1')
    const merged = mergeTournamentsWithDirty([tourney('t1', 'remote')])
    expect(merged.find(t => t.id === 't1')?.name).toBe('remote')
  })
})

describe('dirty ratings survive remote pulls', () => {
  it('merge keeps the dirty local rating over the stale remote one', () => {
    const local: PlayerRating = { name: 'P1', rating: 1100.5, matchesPlayed: 3 }
    markRatingDirty('p1', local)

    const merged = mergeRatingsWithDirty({
      p1: { name: 'P1', rating: 1000, matchesPlayed: 2 },
      p2: { name: 'P2', rating: 1200, matchesPlayed: 5 },
    })
    expect(merged.p1.rating).toBe(1100.5)
    expect(merged.p2.rating).toBe(1200)
  })
})

describe('retryDirtySync while offline', () => {
  it('keeps entries dirty when the push still fails (null client)', async () => {
    markTournamentDirty(tourney('t1', 'local'))
    markRatingDirty('p1', { name: 'P1', rating: 1100, matchesPlayed: 3 })
    expect(hasDirtyData()).toBe(true)

    await retryDirtySync()

    // getClient() is null → pushes fail → still dirty, still merged
    expect(hasDirtyData()).toBe(true)
    const merged = mergeTournamentsWithDirty([tourney('t1', 'remote')])
    expect(merged.find(t => t.id === 't1')?.name).toBe('local')
  })
})
