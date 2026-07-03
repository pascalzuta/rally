import { describe, it, expect } from 'vitest'
import './setup'
import { getMatchCardView } from '../matchCardModel'
import type { Tournament, Match, MatchCourt } from '../types'

const ME = 'p1'
const OPP = 'p2'

function confirmedMatch(court?: MatchCourt): Match {
  return {
    id: 'm1',
    round: 1,
    position: 0,
    player1Id: ME,
    player2Id: OPP,
    score1: [],
    score2: [],
    winnerId: null,
    completed: false,
    schedule: {
      status: 'confirmed',
      proposals: [],
      confirmedSlot: { day: 'saturday', startHour: 9, endHour: 11 },
      createdAt: '2026-06-20T00:00:00Z',
      escalationDay: 0,
      lastEscalation: '2026-06-20T00:00:00Z',
      court,
    },
  } as Match
}

function tournamentWith(match: Match, county = 'Marin County, CA', mode?: 'singles' | 'doubles'): Tournament {
  return {
    id: 't1',
    name: 'Cup',
    county,
    mode,
    status: 'in-progress',
    players: [{ id: ME, name: 'Pat One' }, { id: OPP, name: 'Sam Two' }],
    matches: [match],
    createdAt: '2026-06-15T00:00:00Z',
  } as unknown as Tournament
}

// Approved variant A: confirmed time + no court → primary swaps to "Pick a court".
describe('collapsed-card court entry (variant A)', () => {
  it('swaps the primary to Pick a court when Marin match has no venue', () => {
    const m = confirmedMatch(undefined)
    const view = getMatchCardView(tournamentWith(m), m, ME)
    expect(view.primaryActionLabel).toBe('Pick a court')
    expect(view.courtNeeded).toBe(true)
    expect(view.supporting).toContain('grab a court')
  })

  it('swaps when a captain exists but venue is still null', () => {
    const m = confirmedMatch({ venueId: null, captainId: ME, status: 'assigned', assignedBy: ME, assignedAt: 'x' })
    const view = getMatchCardView(tournamentWith(m), m, ME)
    expect(view.primaryActionLabel).toBe('Pick a court')
  })

  it('keeps Change time once a venue is set, with the court summary line', () => {
    const m = confirmedMatch({ venueId: 'boyle-park', captainId: ME, status: 'assigned', assignedBy: ME, assignedAt: 'x' })
    const view = getMatchCardView(tournamentWith(m), m, ME)
    expect(view.primaryActionLabel).toBe('Change time')
    expect(view.courtNeeded).toBeUndefined()
    expect(view.courtSummary).toContain('Boyle Park')
  })

  it('does not swap outside Marin or for doubles', () => {
    const m1 = confirmedMatch(undefined)
    expect(getMatchCardView(tournamentWith(m1, 'Napa County, CA'), m1, ME).primaryActionLabel).toBe('Change time')
    const m2 = confirmedMatch(undefined)
    expect(getMatchCardView(tournamentWith(m2, 'Marin County, CA', 'doubles'), m2, ME).primaryActionLabel).toBe('Change time')
  })

  it('does not swap for a non-participant viewer', () => {
    const m = confirmedMatch(undefined)
    const view = getMatchCardView(tournamentWith(m), m, 'someone-else')
    expect(view.primaryActionLabel).toBe('View time')
    expect(view.courtNeeded).toBeUndefined()
  })
})
