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

const SCORE_CONFIRMATION_WINDOW_MS = 48 * 60 * 60 * 1000

export type MatchCardTone = 'confirmed' | 'respond' | 'schedule' | 'confirm-score' | 'escalated' | 'completed'
export type MatchCardExpansionKind = 'schedule' | 'score-confirmation' | null

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

function formatScoreSummary(match: Match): string | null {
  if (!match.score1.length || match.score1.length !== match.score2.length) return null
  return match.score1.map((s, index) => `${s}-${match.score2[index]}`).join(', ')
}

function resolveNextDate(dayOfWeek: string): Date {
  const target = DAY_INDEX[dayOfWeek] ?? 1
  const now = new Date()
  const diff = (target - now.getDay() + 7) % 7
  const date = new Date(now)
  date.setDate(now.getDate() + diff)
  return date
}

function formatSlotMeta(slot: Pick<MatchSlot, 'day' | 'startHour'> | Pick<MatchProposal, 'day' | 'startHour'>): string {
  const date = resolveNextDate(slot.day)
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
  const scoreSummary = formatScoreSummary(match)
  const rescheduleUiState = getRescheduleUiState(match, currentPlayerId)
  const pendingProposal = getPendingProposal(match, currentPlayerId)
  const pendingProposalMeta = pendingProposal ? formatSlotMeta(pendingProposal) : null
  const confirmedSlotMeta = match.schedule?.confirmedSlot ? formatSlotMeta(match.schedule.confirmedSlot) : null
  const countdownMeta = formatScoreConfirmationTimeLeft(match.scoreReportedAt)

  if (match.completed) {
    return {
      key: 'completed',
      tone: 'completed',
      statusLabel: 'COMPLETED',
      title,
      supporting: scoreSummary ?? 'Match completed.',
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
      statusLabel: match.resolution.type === 'walkover' ? 'WALKOVER' : match.resolution.type === 'double-loss' ? 'CANCELED' : 'RESOLVED',
      title,
      supporting:
        match.resolution.type === 'walkover'
          ? 'Recorded as a walkover.'
          : match.resolution.type === 'double-loss'
            ? 'Recorded as canceled.'
            : 'Result was resolved by Rally.',
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
        statusLabel: 'REVIEW DISPUTE',
        title,
        supporting: 'Your opponent requested a correction.',
        supportingTone: 'danger',
        metaLabel: countdownMeta,
        primaryActionLabel: 'Review Dispute',
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
      statusLabel: 'CORRECTION SUBMITTED',
      title,
      supporting: 'Waiting for your opponent to review the correction.',
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
      statusLabel: 'UNDER REVIEW',
      title,
      supporting: 'Rally is reviewing the reported result.',
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
      statusLabel: 'CONFIRM SCORE',
      title,
      supporting: scoreSummary ? `Reported ${scoreSummary}. Review and confirm.` : 'Review the reported result and confirm it.',
      metaLabel: countdownMeta,
      primaryActionLabel: 'Confirm Score',
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
      statusLabel: 'SCORE REPORTED',
      title,
      supporting: scoreSummary ? `Reported ${scoreSummary}. Waiting for opponent confirmation.` : 'Waiting for opponent confirmation.',
      metaLabel: countdownMeta,
      primaryActionLabel: null,
      expansionKind: null,
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
        statusLabel: 'RESCHEDULE REQUESTED',
        title,
        supporting: 'Waiting for your opponent to respond to the change request.',
        metaLabel: confirmedSlotMeta,
        primaryActionLabel: 'View Match',
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
        statusLabel: 'NEEDS RESPONSE',
        title,
        supporting: 'Your opponent asked to move the current time.',
        metaLabel: pendingProposalMeta ?? confirmedSlotMeta,
        primaryActionLabel: 'Change Time',
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
      statusLabel: 'NEEDS NEW TIME',
      title,
      supporting: 'This match needs a new confirmed time.',
      metaLabel: pendingProposalMeta,
      primaryActionLabel: 'Pick Time',
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
      statusLabel: 'RESPOND NOW',
      title,
      supporting: mine ? 'Scheduling needs your response.' : 'Scheduling needs organizer help.',
      metaLabel: pendingProposalMeta,
      primaryActionLabel: mine ? 'Respond Now' : null,
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
      statusLabel: 'CONFIRMED',
      title,
      supporting: mine ? 'Confirmed and ready to play.' : 'Confirmed match time.',
      metaLabel: confirmedSlotMeta,
      infoTooltipLabel: hasAutoMatchedOverlap(match) ? 'How Rally matched this' : undefined,
      infoTooltipText: hasAutoMatchedOverlap(match)
        ? 'Rally matched this time because you and your opponent both showed overlapping availability.'
        : undefined,
      primaryActionLabel: mine ? 'View Match' : 'View Time',
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
      statusLabel: 'NEEDS RESPONSE',
      title,
      supporting: 'Review the proposed time and confirm if it works.',
      metaLabel: pendingProposalMeta,
      primaryActionLabel: 'Confirm Time',
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
      statusLabel: 'NEEDS SCHEDULING',
      title,
      supporting: 'Set a time with your opponent.',
      metaLabel: null,
      primaryActionLabel: 'Pick Time',
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
    statusLabel: 'PENDING',
    title,
    supporting: mine ? 'Rally is still creating a match time.' : 'Waiting for a match time.',
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
