/**
 * usePendingActions — regression tests for the "Needs You" derivation.
 *
 * Focus: score-confirmation surfacing (CRITICAL — replaces a UI path that
 * was previously always-visible on Home), needsAccept/needsScheduling
 * counts, and urgency flag.
 *
 * Tests the pure `derivePendingActions` function, which is what the hook
 * runs inside useMemo. No React harness needed.
 */
import { describe, it, expect } from 'vitest'
import { derivePendingActions } from './usePendingActions'
import type { Tournament, Match, Player } from '../types'

const ME = 'player-me'
const OPP = 'player-opp'
const NOW_MS = new Date('2026-04-23T12:00:00Z').getTime()

function player(id: string, name: string): Player {
  return { id, name }
}

function emptyMatch(id: string, overrides: Partial<Match> = {}): Match {
  return {
    id,
    round: 1,
    position: 0,
    player1Id: ME,
    player2Id: OPP,
    score1: [],
    score2: [],
    winnerId: null,
    completed: false,
    ...overrides,
  }
}

function tournament(matches: Match[], status: Tournament['status'] = 'in-progress'): Tournament {
  return {
    id: 't1',
    name: 'Test Cup',
    county: 'testville',
    status,
    players: [player(ME, 'Me'), player(OPP, 'Sam')],
    matches,
    createdAt: '2026-04-20T00:00:00Z',
  } as Tournament
}

describe('derivePendingActions', () => {
  describe('empty states', () => {
    it('returns zero counts when no tournaments', () => {
      const result = derivePendingActions([], ME, 0, NOW_MS)
      expect(result.needsScheduling).toBe(0)
      expect(result.needsAccept).toBe(0)
      expect(result.scoreConfirmPending).toEqual([])
      expect(result.bracketBadgeCount).toBe(0)
      expect(result.hasUrgentScoreConfirm).toBe(false)
    })

    it('skips tournaments player is not in', () => {
      const t = tournament([emptyMatch('m1', { schedule: undefined })])
      t.players = [player('someone-else', 'Other'), player(OPP, 'Sam')]
      const m = t.matches[0]
      m.player1Id = 'someone-else'
      const result = derivePendingActions([t], ME, 0, NOW_MS)
      expect(result.bracketBadgeCount).toBe(0)
    })

    it('skips completed matches', () => {
      const t = tournament([emptyMatch('m1', { completed: true, winnerId: ME, score1: [6], score2: [4] })])
      const result = derivePendingActions([t], ME, 0, NOW_MS)
      expect(result.bracketBadgeCount).toBe(0)
    })

    it('skips completed tournaments', () => {
      const t = tournament([emptyMatch('m1')], 'completed' as Tournament['status'])
      const result = derivePendingActions([t], ME, 0, NOW_MS)
      expect(result.bracketBadgeCount).toBe(0)
    })
  })

  describe('score-confirm pending (CRITICAL — 48h window regression)', () => {
    it('surfaces when opponent reported and I have not confirmed', () => {
      const reportedAt = new Date(NOW_MS - 10 * 60 * 60 * 1000).toISOString() // 10h ago
      const t = tournament([
        emptyMatch('m1', {
          scoreReportedBy: OPP,
          scoreReportedAt: reportedAt,
          score1: [6, 4, 6],
          score2: [3, 6, 2],
        }),
      ])
      const result = derivePendingActions([t], ME, 0, NOW_MS)
      expect(result.scoreConfirmPending).toHaveLength(1)
      expect(result.scoreConfirmPending[0].opponentName).toBe('Sam')
      expect(result.scoreConfirmPending[0].msRemaining).toBeGreaterThan(0)
      expect(result.scoreConfirmPending[0].urgent).toBe(false) // 38h left
    })

    it('flags urgent when <6h to expiry', () => {
      const reportedAt = new Date(NOW_MS - 44 * 60 * 60 * 1000).toISOString() // 44h ago → 4h left
      const t = tournament([
        emptyMatch('m1', {
          scoreReportedBy: OPP,
          scoreReportedAt: reportedAt,
          score1: [6], score2: [3],
        }),
      ])
      const result = derivePendingActions([t], ME, 0, NOW_MS)
      expect(result.scoreConfirmPending).toHaveLength(1)
      expect(result.scoreConfirmPending[0].urgent).toBe(true)
      expect(result.hasUrgentScoreConfirm).toBe(true)
    })

    it('does NOT surface when I reported (waiting on opponent, not me)', () => {
      const t = tournament([
        emptyMatch('m1', {
          scoreReportedBy: ME,
          scoreReportedAt: new Date(NOW_MS - 10 * 60 * 60 * 1000).toISOString(),
          score1: [6], score2: [3],
        }),
      ])
      const result = derivePendingActions([t], ME, 0, NOW_MS)
      expect(result.scoreConfirmPending).toHaveLength(0)
    })

    it('drops entries that are already past the 48h window', () => {
      const reportedAt = new Date(NOW_MS - 50 * 60 * 60 * 1000).toISOString() // 50h ago — expired
      const t = tournament([
        emptyMatch('m1', {
          scoreReportedBy: OPP,
          scoreReportedAt: reportedAt,
          score1: [6], score2: [3],
        }),
      ])
      const result = derivePendingActions([t], ME, 0, NOW_MS)
      expect(result.scoreConfirmPending).toHaveLength(0)
    })

    it('sorts most-urgent first', () => {
      const t = tournament([
        emptyMatch('m1', {
          scoreReportedBy: OPP,
          scoreReportedAt: new Date(NOW_MS - 10 * 60 * 60 * 1000).toISOString(), // 38h left
          score1: [6], score2: [3],
        }),
        emptyMatch('m2', {
          player1Id: ME,
          player2Id: 'player-third',
          scoreReportedBy: 'player-third',
          scoreReportedAt: new Date(NOW_MS - 46 * 60 * 60 * 1000).toISOString(), // 2h left
          score1: [6], score2: [4],
        }),
      ])
      t.players.push(player('player-third', 'Alex'))
      const result = derivePendingActions([t], ME, 0, NOW_MS)
      expect(result.scoreConfirmPending).toHaveLength(2)
      expect(result.scoreConfirmPending[0].matchId).toBe('m2') // most urgent first
      expect(result.scoreConfirmPending[0].urgent).toBe(true)
      expect(result.scoreConfirmPending[1].matchId).toBe('m1')
      expect(result.scoreConfirmPending[1].urgent).toBe(false)
    })

    it('surfaces regardless of tournament status (setup or in-progress)', () => {
      // Override rule: score-confirm is time-sensitive, must appear even
      // during pre-active states. This is the defense-in-depth test.
      const reportedAt = new Date(NOW_MS - 10 * 60 * 60 * 1000).toISOString()
      const t = tournament(
        [
          emptyMatch('m1', {
            scoreReportedBy: OPP,
            scoreReportedAt: reportedAt,
            score1: [6], score2: [3],
          }),
        ],
        'setup',
      )
      const result = derivePendingActions([t], ME, 0, NOW_MS)
      expect(result.scoreConfirmPending).toHaveLength(1)
    })
  })

  describe('unreadMessages passthrough', () => {
    it('passes unreadMessages through to output', () => {
      const result = derivePendingActions([], ME, 7, NOW_MS)
      expect(result.unreadMessages).toBe(7)
    })

    it('does NOT include unread messages in bracketBadgeCount', () => {
      // Rationale: unread messages have their own top-icon badge.
      // The Bracket tab badge is only for bracket-actionable items.
      const result = derivePendingActions([], ME, 42, NOW_MS)
      expect(result.bracketBadgeCount).toBe(0)
    })
  })

  describe('bracketBadgeCount', () => {
    it('sums needsScheduling + needsAccept + scoreConfirmPending', () => {
      const reportedAt = new Date(NOW_MS - 10 * 60 * 60 * 1000).toISOString()
      const t = tournament([
        emptyMatch('m1', {
          scoreReportedBy: OPP,
          scoreReportedAt: reportedAt,
          score1: [6], score2: [3],
        }),
      ])
      const result = derivePendingActions([t], ME, 0, NOW_MS)
      // Exactly one score confirm → badge = 1 (scheduling/accept counts
      // depend on getMatchCardView classification which we don't control
      // in this minimal fixture — just verify score-confirm contributes).
      expect(result.bracketBadgeCount).toBeGreaterThanOrEqual(1)
      expect(result.bracketBadgeCount).toBe(
        result.needsScheduling + result.needsAccept + result.scoreConfirmPending.length,
      )
    })
  })
})
