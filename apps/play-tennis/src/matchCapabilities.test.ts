import { describe, it, expect } from 'vitest'
import { canEnterScore } from './matchCapabilities'
import type { Match, MatchCourt } from './types'

function confirmedMatch(court?: MatchCourt): Match {
  return {
    id: 'm1',
    round: 1,
    position: 0,
    player1Id: 'p1',
    player2Id: 'p2',
    score1: [],
    score2: [],
    winnerId: null,
    completed: false,
    schedule: {
      status: 'confirmed',
      proposals: [],
      confirmedSlot: { day: 'monday', startHour: 18, endHour: 20 },
      createdAt: '2026-01-01T00:00:00Z',
      escalationDay: 0,
      lastEscalation: '2026-01-01T00:00:00Z',
      court,
    },
  } as Match
}

const assigned: MatchCourt = { venueId: 'boyle-park', captainId: 'p1', status: 'assigned', assignedBy: 'p1', assignedAt: 'x' }
const secured: MatchCourt = { venueId: 'boyle-park', captainId: 'p1', status: 'secured', assignedBy: 'p1', assignedAt: 'x', securedAt: 'y' }

// P0 regression: the "Court secured" flag must NEVER gate score entry.
describe('canEnterScore is never gated by court/secured status', () => {
  it('true when there is no court (legacy match)', () => {
    expect(canEnterScore(confirmedMatch(undefined), 'p1')).toBe(true)
  })
  it('true when court is assigned but unsecured', () => {
    expect(canEnterScore(confirmedMatch(assigned), 'p1')).toBe(true)
  })
  it('true when court is secured', () => {
    expect(canEnterScore(confirmedMatch(secured), 'p1')).toBe(true)
  })
})
