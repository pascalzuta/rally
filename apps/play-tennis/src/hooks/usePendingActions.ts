/**
 * usePendingActions — Derives "Needs You" state for Home + tab badges.
 *
 * Single source of truth for pending user actions across the app.
 * Consumed by:
 *   - NeedsYouBlock on Home (displays rows)
 *   - ScoreConfirmBanner on Home (urgency banner when <6h to expiry)
 *   - Tab badge on Bracket (total count)
 *
 * Classification is delegated to getMatchCardView so we don't fork the
 * state machine. We just aggregate what it already knows.
 *
 * Memoization boundary: tournaments (from context) + playerId + unread msg
 * count. Does NOT re-derive on every Supabase event — only when one of
 * these changes.
 *
 * Score-confirm rule: a match where the OTHER player reported and I must
 * confirm within 48h of scoreReportedAt. `urgent` flips at <6h remaining.
 * This is the high-stakes, time-sensitive action — never silently hidden.
 */
import { useMemo } from 'react'
import { useRallyData } from '../context/RallyDataProvider'
import { getMatchCardView } from '../matchCardModel'
import { getUnreadMessageCount } from '../store'
import type { Tournament, Match } from '../types'

const SCORE_CONFIRM_WINDOW_MS = 48 * 60 * 60 * 1000
const URGENT_THRESHOLD_MS = 6 * 60 * 60 * 1000

export interface ScoreConfirmEntry {
  matchId: string
  tournamentId: string
  opponentName: string
  expiresAt: string // ISO
  msRemaining: number
  urgent: boolean // msRemaining < 6h
}

export interface PendingActions {
  needsScheduling: number // matches with no time set, involving me
  needsAccept: number // proposed time from opponent, awaiting my response
  scoreConfirmPending: ScoreConfirmEntry[]
  unreadMessages: number
  /** Total count for tab badge. Excludes unread messages (those have their own top-icon badge). */
  bracketBadgeCount: number
  /** True when any scoreConfirmPending entry is urgent (<6h). Drives banner + orange accent. */
  hasUrgentScoreConfirm: boolean
}

function isMyMatch(match: Match, playerId: string): boolean {
  return match.player1Id === playerId || match.player2Id === playerId
}

function getOpponentName(tournament: Tournament, match: Match, playerId: string): string {
  const opponentId = match.player1Id === playerId ? match.player2Id : match.player1Id
  if (!opponentId) return 'your opponent'
  const opp = tournament.players.find(p => p.id === opponentId)
  return opp?.name ?? 'your opponent'
}

/**
 * Pure derivation — no React. Exported for testing.
 *
 * Classification delegated to getMatchCardView (same state machine used
 * everywhere else in the app). We aggregate counts and add expiry math
 * for score confirmations.
 */
export function derivePendingActions(
  tournaments: Tournament[],
  playerId: string,
  unreadMessages: number,
  nowMs: number,
): PendingActions {
  let needsScheduling = 0
  let needsAccept = 0
  const scoreConfirmPending: ScoreConfirmEntry[] = []

  for (const tournament of tournaments) {
    if (tournament.status !== 'in-progress' && tournament.status !== 'setup') continue
    for (const match of tournament.matches) {
      if (!isMyMatch(match, playerId)) continue
      if (!match.player1Id || !match.player2Id) continue
      if (match.completed) continue

      const view = getMatchCardView(tournament, match, playerId)

      // needsScheduling: no time set yet and I'm a player
      if (view.key === 'needs-scheduling' || view.key === 'needs-new-time') {
        needsScheduling++
        continue
      }

      // needsAccept: opponent proposed, I haven't responded
      // 'respond-now' and 'needs-response' cover both initial proposals
      // and reschedule requests. 'reschedule-requested' is waiting on me.
      if (
        view.key === 'respond-now' ||
        view.key === 'needs-response' ||
        view.key === 'reschedule-requested'
      ) {
        needsAccept++
        continue
      }

      // scoreConfirmPending: opponent reported, I need to confirm
      if (
        view.key === 'confirm-score' &&
        match.scoreReportedBy &&
        match.scoreReportedBy !== playerId &&
        match.scoreReportedAt
      ) {
        const reportedMs = new Date(match.scoreReportedAt).getTime()
        const expiresAtMs = reportedMs + SCORE_CONFIRM_WINDOW_MS
        const msRemaining = expiresAtMs - nowMs
        if (msRemaining > 0) {
          scoreConfirmPending.push({
            matchId: match.id,
            tournamentId: tournament.id,
            opponentName: getOpponentName(tournament, match, playerId),
            expiresAt: new Date(expiresAtMs).toISOString(),
            msRemaining,
            urgent: msRemaining < URGENT_THRESHOLD_MS,
          })
        }
      }
    }
  }

  // Most-urgent score-confirm first (smallest msRemaining)
  scoreConfirmPending.sort((a, b) => a.msRemaining - b.msRemaining)

  const hasUrgentScoreConfirm = scoreConfirmPending.some(e => e.urgent)
  const bracketBadgeCount = needsScheduling + needsAccept + scoreConfirmPending.length

  return {
    needsScheduling,
    needsAccept,
    scoreConfirmPending,
    unreadMessages,
    bracketBadgeCount,
    hasUrgentScoreConfirm,
  }
}

/**
 * React hook wrapper. Memoizes on tournaments + playerId + unread msg count.
 *
 * @param playerId - Current player's stable id (authId).
 * @param now - Injectable clock for tests. Defaults to Date.now().
 */
export function usePendingActions(playerId: string, now: () => number = Date.now): PendingActions {
  const { tournaments } = useRallyData()

  // Unread messages is an independent input. Read it eagerly; the memo
  // below does not re-run on Supabase events unless tournaments change,
  // so message updates need their own signal via parent re-render.
  const unreadMessages = getUnreadMessageCount(playerId)

  return useMemo(
    () => derivePendingActions(tournaments, playerId, unreadMessages, now()),
    // `now` intentionally NOT in deps — a clock ref shouldn't retrigger
    // memo. For live countdown display, the consumer renders on its own
    // interval and the `msRemaining` snapshot is "fresh enough" per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tournaments, playerId, unreadMessages],
  )
}
