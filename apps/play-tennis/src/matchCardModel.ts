import { formatDateCompact, formatHourCompact } from './dateUtils'
import { getPlayerName, getRescheduleUiState } from './store'
import { Match, MatchProposal, MatchSlot, Tournament } from './types'

const DAY_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
}

/** Compute the Monday of week 1 from the tournament's startsAt date */
function getWeekOneMonday(tournament: { startsAt?: string; date?: string; createdAt?: string }): Date | null {
  const ref = tournament.startsAt ?? tournament.date ?? tournament.createdAt
  if (!ref) return null
  const d = new Date(ref)
  // Find the Monday of that week
  const dayOfWeek = d.getDay() // 0=Sun, 1=Mon, ...
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

const DAY_TO_INDEX: Record<string, number> = {
  monday: 0, tuesday: 1, wednesday: 2, thursday: 3,
  friday: 4, saturday: 5, sunday: 6,
}

const SCORE_CONFIRMATION_WINDOW_MS = 48 * 60 * 60 * 1000

export type MatchCardTone = 'confirmed' | 'respond' | 'schedule' | 'confirm-score' | 'escalated' | 'completed'
export type MatchCardExpansionKind = 'schedule' | 'score-confirmation' | 'score-correction' | null

export interface MatchCardView {
  key:
    | 'confirmed'
    | 'needs-response'
    | 'reschedule-requested'
    | 'needs-new-time'
    | 'needs-scheduling'
    | 'respond-now'
    | 'confirm-score'
    | 'score-reported'
    | 'review-dispute'
    | 'correction-submitted'
    | 'under-review'
    | 'completed'
    | 'resolved'
    | 'pending'
  tone: MatchCardTone
  statusLabel: string
  title: string
  supporting: string | null
  supportingTone?: 'default' | 'danger'
  metaLabel: string | null
  infoTooltipLabel?: string
  infoTooltipText?: string
  primaryActionLabel: string | null
  expansionKind: MatchCardExpansionKind
  priority: number
  isMyMatch: boolean
  opponentId: string | null
  opponentName: string | null
  showOnHome: boolean
}

function hasAutoMatchedOverlap(match: Match): boolean {
  return Boolean(
    match.schedule?.status === 'confirmed' &&
    match.schedule?.schedulingTier === 'auto' &&
    match.schedule.proposals.some(
      proposal => proposal.status === 'accepted' && proposal.proposedBy === 'system'
    )
  )
}

function isMyMatch(match: Match, currentPlayerId: string): boolean {
  return match.player1Id === currentPlayerId || match.player2Id === currentPlayerId
}

function getOpponentId(match: Match, currentPlayerId: string): string | null {
  if (match.player1Id === currentPlayerId) return match.player2Id
  if (match.player2Id === currentPlayerId) return match.player1Id
  return null
}

function formatScoreSummary(match: Match, currentPlayerId?: string): string | null {
  if (!match.score1.length || match.score1.length !== match.score2.length) return null
  // Show current user's score first (e.g., "6-3, 6-4" not "3-6, 4-6")
  const isPlayer2 = currentPlayerId && match.player2Id === currentPlayerId
  const myScores = isPlayer2 ? match.score2 : match.score1
  const oppScores = isPlayer2 ? match.score1 : match.score2
  return myScores.map((s, i) => `${s}-${oppScores[i]}`).join(', ')
}

function resolveNextDate(dayOfWeek: string): Date {
  const target = DAY_INDEX[dayOfWeek] ?? 1
  const now = new Date()
  const diff = (target - now.getDay() + 7) % 7
  const date = new Date(now)
  date.setDate(now.getDate() + diff)
  return date
}

function formatSlotMeta(slot: Pick<MatchSlot, 'day' | 'startHour'> | Pick<MatchProposal, 'day' | 'startHour'>, weekOneMonday?: Date | null): string {
  let date: Date
  const slotWeek = 'week' in slot ? (slot as { week?: number }).week : undefined
  if (weekOneMonday && slotWeek) {
    const dayIdx = DAY_TO_INDEX[slot.day.toLowerCase()] ?? 0
    date = new Date(weekOneMonday)
    date.setDate(weekOneMonday.getDate() + ((slotWeek - 1) * 7) + dayIdx)
  } else {
    date = resolveNextDate(slot.day)
  }
  return `${formatDateCompact(date)} ${formatHourCompact(slot.startHour)}`
}

function formatScoreConfirmationTimeLeft(reportedAt: string | null | undefined): string | null {
  if (!reportedAt) return null
  const remainingMs = Math.max(0, new Date(reportedAt).getTime() + SCORE_CONFIRMATION_WINDOW_MS - Date.now())
  const totalMinutes = Math.ceil(remainingMs / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    const remainingHours = hours % 24
    return `${days}d ${remainingHours}h left`
  }
  if (hours > 0) return `${hours}h ${minutes}m left`
  return `${Math.max(0, totalMinutes)}m left`
}

function getPendingProposal(match: Match, currentPlayerId: string): MatchProposal | null {
  const proposals = match.schedule?.proposals ?? []
  return (
    proposals.find(proposal => proposal.status === 'pending' && proposal.proposedBy === 'system') ??
    proposals.find(
      proposal => proposal.status === 'pending' && proposal.proposedBy !== currentPlayerId
    ) ??
    proposals.find(proposal => proposal.status === 'pending') ??
    null
  )
}

function buildTitle(tournament: Tournament, match: Match, currentPlayerId: string, mine: boolean): string {
  if (mine) {
    const opponentId = getOpponentId(match, currentPlayerId)
    return `vs ${getPlayerName(tournament, opponentId)}`
  }

  const playerOne = getPlayerName(tournament, match.player1Id)
  const playerTwo = getPlayerName(tournament, match.player2Id)
  return `${playerOne} vs ${playerTwo}`
}

export function getMatchCardView(
  tournament: Tournament,
  match: Match,
  currentPlayerId: string
): MatchCardView {
  const mine = isMyMatch(match, currentPlayerId)
  const opponentId = mine ? getOpponentId(match, currentPlayerId) : null
  const opponentName = opponentId ? getPlayerName(tournament, opponentId) : null
  const title = buildTitle(tournament, match, currentPlayerId, mine)
  const scoreSummary = formatScoreSummary(match, currentPlayerId)
  const rescheduleUiState = getRescheduleUiState(match, currentPlayerId)
  const pendingProposal = getPendingProposal(match, currentPlayerId)
  const weekOneMonday = getWeekOneMonday(tournament)
  const pendingProposalMeta = pendingProposal ? formatSlotMeta(pendingProposal, weekOneMonday) : null
  const confirmedSlotMeta = match.schedule?.confirmedSlot ? formatSlotMeta(match.schedule.confirmedSlot, weekOneMonday) : null
  const countdownMeta = formatScoreConfirmationTimeLeft(match.scoreReportedAt)

  if (match.completed) {
    return {
      key: 'completed',
      tone: 'completed',
      statusLabel: 'Completed',
      title,
      supporting: scoreSummary ?? 'Match complete.',
      metaLabel: match.scoreReportedAt ? formatDateCompact(new Date(match.scoreReportedAt)) : null,
      primaryActionLabel: null,
      expansionKind: null,
      priority: 99,
      isMyMatch: mine,
      opponentId,
      opponentName,
      showOnHome: false,
    }
  }

  if (match.resolution) {
    return {
      key: 'resolved',
      tone: 'completed',
      statusLabel: match.resolution.type === 'walkover' ? 'Walkover' : match.resolution.type === 'double-loss' ? 'Canceled' : 'Resolved',
      title,
      supporting:
        match.resolution.type === 'walkover'
          ? 'Recorded as a walkover.'
          : match.resolution.type === 'double-loss'
            ? 'Recorded as canceled.'
            : 'Resolved by Rally.',
      metaLabel: confirmedSlotMeta,
      primaryActionLabel: null,
      expansionKind: null,
      priority: 98,
      isMyMatch: mine,
      opponentId,
      opponentName,
      showOnHome: false,
    }
  }

  if (match.scoreDispute?.status === 'pending') {
    if (match.scoreReportedBy === currentPlayerId) {
      return {
        key: 'review-dispute',
        tone: 'confirm-score',
        statusLabel: 'Review dispute',
        title,
        supporting: 'Your opponent requested a score correction.',
        supportingTone: 'danger',
        metaLabel: countdownMeta,
        primaryActionLabel: 'Review dispute',
        expansionKind: 'score-confirmation',
        priority: 0,
        isMyMatch: mine,
        opponentId,
        opponentName,
        showOnHome: mine,
      }
    }

    return {
      key: 'correction-submitted',
      tone: 'confirm-score',
      statusLabel: 'Correction sent',
      title,
      supporting: 'Waiting on your opponent to review.',
      metaLabel: countdownMeta,
      primaryActionLabel: null,
      expansionKind: null,
      priority: 1,
      isMyMatch: mine,
      opponentId,
      opponentName,
      showOnHome: false,
    }
  }

  if (match.scoreDispute?.status === 'admin-review') {
    return {
      key: 'under-review',
      tone: 'completed',
      statusLabel: 'Under review',
      title,
      supporting: 'Rally is reviewing the result.',
      metaLabel: null,
      primaryActionLabel: null,
      expansionKind: null,
      priority: 2,
      isMyMatch: mine,
      opponentId,
      opponentName,
      showOnHome: false,
    }
  }

  if (match.scoreReportedBy && match.scoreReportedBy !== currentPlayerId) {
    return {
      key: 'confirm-score',
      tone: 'confirm-score',
      statusLabel: 'Confirm score',
      title,
      supporting: scoreSummary ? `Reported ${scoreSummary}. Confirm to record it.` : 'Review the score and confirm.',
      metaLabel: countdownMeta,
      primaryActionLabel: 'Confirm score',
      expansionKind: 'score-confirmation',
      priority: 0.5,
      isMyMatch: mine,
      opponentId,
      opponentName,
      showOnHome: mine,
    }
  }

  if (match.scoreReportedBy && match.scoreReportedBy === currentPlayerId) {
    return {
      key: 'score-reported',
      tone: 'confirm-score',
      statusLabel: 'Score reported',
      title,
      supporting: scoreSummary ? `Reported ${scoreSummary}. Waiting on your opponent.` : 'Waiting on your opponent to confirm.',
      metaLabel: countdownMeta,
      primaryActionLabel: 'Correct score',
      expansionKind: 'score-correction' as MatchCardExpansionKind,
      priority: 2,
      isMyMatch: mine,
      opponentId,
      opponentName,
      showOnHome: false,
    }
  }

  if (match.schedule?.activeRescheduleRequest) {
    if (rescheduleUiState === 'soft_request_sent') {
      return {
        key: 'reschedule-requested',
        tone: 'respond',
        statusLabel: 'Reschedule sent',
        title,
        supporting: 'Waiting on your opponent to respond.',
        metaLabel: confirmedSlotMeta,
        primaryActionLabel: 'View match',
        expansionKind: 'schedule',
        priority: 1.5,
        isMyMatch: mine,
        opponentId,
        opponentName,
        showOnHome: mine,
      }
    }

    if (rescheduleUiState === 'soft_request_received') {
      return {
        key: 'needs-response',
        tone: 'respond',
        statusLabel: 'Needs response',
        title,
        supporting: 'Your opponent wants to move the time.',
        metaLabel: pendingProposalMeta ?? confirmedSlotMeta,
        primaryActionLabel: 'Change time',
        expansionKind: 'schedule',
        priority: 1,
        isMyMatch: mine,
        opponentId,
        opponentName,
        showOnHome: mine,
      }
    }

    return {
      key: 'needs-new-time',
      tone: 'schedule',
      statusLabel: 'Needs new time',
      title,
      supporting: 'Pick a new time to confirm.',
      metaLabel: pendingProposalMeta,
      primaryActionLabel: 'Pick time',
      expansionKind: 'schedule',
      priority: rescheduleUiState === 'hard_request_sent' ? 1.5 : 1,
      isMyMatch: mine,
      opponentId,
      opponentName,
      showOnHome: mine,
    }
  }

  if (match.schedule?.status === 'escalated') {
    return {
      key: 'respond-now',
      tone: 'escalated',
      statusLabel: 'Respond now',
      title,
      supporting: mine ? 'This match needs your response.' : 'Needs organizer help.',
      metaLabel: pendingProposalMeta,
      primaryActionLabel: mine ? 'Respond now' : null,
      expansionKind: mine ? 'schedule' : null,
      priority: 0,
      isMyMatch: mine,
      opponentId,
      opponentName,
      showOnHome: mine,
    }
  }

  if (match.schedule?.status === 'confirmed' && match.schedule.confirmedSlot) {
    return {
      key: 'confirmed',
      tone: 'confirmed',
      statusLabel: 'Confirmed',
      title,
      supporting: mine ? 'Locked in. See you on court.' : 'Time confirmed.',
      metaLabel: confirmedSlotMeta,
      infoTooltipLabel: hasAutoMatchedOverlap(match) ? 'How Rally matched this' : undefined,
      infoTooltipText: hasAutoMatchedOverlap(match)
        ? 'You and your opponent both had this time open, so Rally booked it.'
        : undefined,
      primaryActionLabel: mine ? 'View match' : 'View time',
      expansionKind: 'schedule',
      priority: 3,
      isMyMatch: mine,
      opponentId,
      opponentName,
      showOnHome: mine,
    }
  }

  if (match.schedule?.status === 'proposed' && mine && pendingProposal) {
    return {
      key: 'needs-response',
      tone: 'respond',
      statusLabel: 'Needs response',
      title,
      supporting: 'Review the proposed time and confirm if it works.',
      metaLabel: pendingProposalMeta,
      primaryActionLabel: 'Confirm time',
      expansionKind: 'schedule',
      priority: 2,
      isMyMatch: mine,
      opponentId,
      opponentName,
      showOnHome: true,
    }
  }

  if (
    mine &&
    (
      !match.schedule ||
      match.schedule.status === 'unscheduled' ||
      (match.schedule.status === 'proposed' &&
        (match.schedule.proposals ?? []).every(
          proposal => proposal.status === 'rejected' || proposal.proposedBy === currentPlayerId
        ))
    )
  ) {
    return {
      key: 'needs-scheduling',
      tone: 'schedule',
      statusLabel: 'Needs scheduling',
      title,
      supporting: 'Pick a time with your opponent.',
      metaLabel: null,
      primaryActionLabel: 'Pick time',
      expansionKind: 'schedule',
      priority: 4,
      isMyMatch: mine,
      opponentId,
      opponentName,
      showOnHome: true,
    }
  }

  return {
    key: 'pending',
    tone: 'completed',
    statusLabel: 'Pending',
    title,
    supporting: mine ? 'Rally is finding a time.' : 'Waiting on a match time.',
    metaLabel: null,
    primaryActionLabel: null,
    expansionKind: null,
    priority: 10,
    isMyMatch: mine,
    opponentId,
    opponentName,
    showOnHome: false,
  }
}
