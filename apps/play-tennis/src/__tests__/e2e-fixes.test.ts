/**
 * Regression tests for the 2026-07-09 E2E tournament findings:
 *  - standings head-to-head tiebreak for two-way win ties
 *  - "Won" means champion: getTournamentChampionId
 *  - simulateRoundScores awards trophies when it completes the tournament
 */
import { describe, it, expect, beforeEach } from 'vitest'
import './setup'
import {
  createProfile,
  joinLobby,
  seedLobby,
  startTournamentFromLobby,
  getSetupTournamentForCounty,
  forceStartTournament,
  getTournament,
  simulateRoundScores,
  autoConfirmAllSchedules,
  getGroupStandings,
  getTournamentChampionId,
  getPlayerTrophies,
  saveAvailability,
} from '../store'
import type { Tournament, Match, AvailabilitySlot } from '../types'
import { clear as clearMemoryStore } from '../memoryStore'

const COUNTY = 'testville'

function defaultAvail(): AvailabilitySlot[] {
  return [
    { day: 'monday', startHour: 18, endHour: 21 },
    { day: 'wednesday', startHour: 18, endHour: 21 },
    { day: 'saturday', startHour: 10, endHour: 14 },
  ]
}

function groupMatch(
  id: string, p1: string, p2: string, s1: number[], s2: number[], winner: string
): Match {
  return {
    id, round: 1, position: 0, player1Id: p1, player2Id: p2,
    score1: s1, score2: s2, winnerId: winner, completed: true, phase: 'group',
  }
}

function bareTournament(matches: Match[], playerIds: string[], status: Tournament['status'] = 'completed'): Tournament {
  return {
    id: 'tt', name: 'Test Open', date: '2026-07-01', county: COUNTY,
    format: 'round-robin', status,
    players: playerIds.map(id => ({ id, name: id.toUpperCase() })),
    matches, createdAt: '2026-07-01T00:00:00.000Z',
  }
}

describe('standings head-to-head tiebreak', () => {
  it('orders a two-way win tie by their head-to-head result, not set diff', () => {
    // a & b tied at 2 wins; b has the better set diff but a beat b directly.
    // c & d tied at 1 win; d has the better set diff but c beat d directly.
    const t = bareTournament([
      groupMatch('m1', 'a', 'b', [7, 7], [6, 6], 'a'),            // a d. b (close)
      groupMatch('m2', 'a', 'c', [6, 4, 6], [4, 6, 4], 'a'),      // a d. c (3 sets)
      groupMatch('m3', 'd', 'a', [6, 6], [0, 0], 'd'),            // d d. a (crushing)
      groupMatch('m4', 'b', 'c', [6, 6], [0, 0], 'b'),            // b d. c (crushing)
      groupMatch('m5', 'b', 'd', [6, 6], [0, 0], 'b'),            // b d. d (crushing)
      groupMatch('m6', 'c', 'd', [7, 6, 7], [6, 7, 6], 'c'),      // c d. d (3 sets)
    ], ['a', 'b', 'c', 'd'])

    const standings = getGroupStandings(t)
    expect(standings.map(s => s.id)).toEqual(['a', 'b', 'c', 'd'])
    // sanity: without H2H, set diff would have put b first and d third
    const b = standings.find(s => s.id === 'b')!
    const a = standings.find(s => s.id === 'a')!
    expect(b.setsWon - b.setsLost).toBeGreaterThan(a.setsWon - a.setsLost)
  })

  it('leaves three-way ties to set/game diff (no circular H2H)', () => {
    // a>b, b>c, c>a — all 1-1... make it 3 players with 1 win each
    const t = bareTournament([
      groupMatch('m1', 'a', 'b', [6, 6], [0, 0], 'a'),
      groupMatch('m2', 'b', 'c', [6, 6], [4, 4], 'b'),
      groupMatch('m3', 'c', 'a', [7, 7], [6, 6], 'c'),
    ], ['a', 'b', 'c'])

    const standings = getGroupStandings(t)
    // a has the best set diff story: won 6-0 6-0, lost 6-7 6-7
    expect(standings[0].id).toBe('a')
  })
})

describe('getTournamentChampionId', () => {
  it('returns the final (max round) winner when a knockout phase exists', () => {
    const matches = [
      groupMatch('g1', 'a', 'b', [6, 6], [4, 4], 'a'),
      { ...groupMatch('s1', 'a', 'b', [6, 6], [4, 4], 'b'), round: 2, phase: 'knockout' as const },
      { ...groupMatch('f1', 'b', 'c', [6, 6], [4, 4], 'b'), round: 3, phase: 'knockout' as const },
    ]
    const t = bareTournament(matches, ['a', 'b', 'c'])
    expect(getTournamentChampionId(t)).toBe('b')
  })

  it('returns the standings leader for a pure round-robin', () => {
    const t = bareTournament([
      groupMatch('m1', 'a', 'b', [6, 6], [4, 4], 'a'),
      groupMatch('m2', 'a', 'c', [6, 6], [4, 4], 'a'),
      groupMatch('m3', 'b', 'c', [6, 6], [4, 4], 'b'),
    ], ['a', 'b', 'c'])
    expect(getTournamentChampionId(t)).toBe('a')
  })

  it('returns null while the tournament is still in progress', () => {
    const t = bareTournament([
      groupMatch('m1', 'a', 'b', [6, 6], [4, 4], 'a'),
    ], ['a', 'b'], 'in-progress')
    expect(getTournamentChampionId(t)).toBeNull()
  })
})

describe('simulateRoundScores completion awards trophies', () => {
  beforeEach(() => {
    localStorage.clear()
    clearMemoryStore()
  })

  it('awards the champion trophy the moment the simulated final completes', async () => {
    const me = createProfile('Test Player', COUNTY, { gender: 'male', skillLevel: 'intermediate' })
    saveAvailability(me.id, defaultAvail())
    await joinLobby(me)
    await seedLobby(COUNTY, 5)
    await startTournamentFromLobby(COUNTY)
    const setup = getSetupTournamentForCounty(COUNTY, 'male', 'intermediate')
    expect(setup, 'setup tournament created').toBeTruthy()
    const started = await forceStartTournament(setup!.id)
    expect(started?.status).toBe('in-progress')
    await autoConfirmAllSchedules(started!.id)

    // Score rounds until the tournament completes (group + knockout rounds)
    let t = getTournament(started!.id)!
    for (let i = 0; i < 10 && t.status !== 'completed'; i++) {
      await simulateRoundScores(t.id)
      t = getTournament(t.id)!
    }
    expect(t.status).toBe('completed')

    const championId = getTournamentChampionId(t)
    expect(championId, 'champion decidable').toBeTruthy()
    const trophies = getPlayerTrophies(championId!)
    expect(
      trophies.some(tr => tr.tournamentId === t.id),
      'champion has a trophy for this tournament without an app restart'
    ).toBe(true)
  })
})
