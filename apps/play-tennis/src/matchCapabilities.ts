import { Match } from './types'

export function isMatchParticipant(match: Match, currentPlayerId: string): boolean {
  return match.player1Id === currentPlayerId || match.player2Id === currentPlayerId
}

export function canEnterScore(match: Match, currentPlayerId: string): boolean {
  return Boolean(
    match.player1Id &&
    match.player2Id &&
    !match.completed &&
    isMatchParticipant(match, currentPlayerId) &&
    match.schedule?.status === 'confirmed' &&
    match.schedule?.confirmedSlot &&
    !match.schedule?.activeRescheduleRequest &&
    !match.scoreReportedBy &&
    !match.scoreDispute
  )
}

export function canCorrectScore(match: Match, currentPlayerId: string): boolean {
  return Boolean(
    !match.completed &&
    match.scoreReportedBy === currentPlayerId &&
    !match.scoreConfirmedAt &&
    !match.scoreDispute
  )
}

export function canExpandMatch(match: Match, currentPlayerId: string): boolean {
  if (match.completed || !match.schedule || !match.player1Id || !match.player2Id) return false
  if (isMatchParticipant(match, currentPlayerId)) return true
  return match.schedule.status === 'confirmed' && Boolean(match.schedule.confirmedSlot)
}
