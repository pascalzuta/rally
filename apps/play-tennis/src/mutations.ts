/**
 * Mutations — the only API components should use for user actions.
 *
 * Why this exists:
 * store.ts has 80+ exported functions with optional parameters. Components
 * kept forgetting to pass required context (e.g. county, weeklyCap), causing
 * silent writes to only localStorage. This layer wraps store.ts with
 * parameter-complete functions that pull context from the current profile.
 *
 * Rules:
 * 1. Every mutation returns a discriminated union Result<T>
 * 2. Every mutation pulls required context from getProfile() internally
 * 3. Callers cannot forget a parameter — TypeScript enforces the shape
 * 4. All errors are caught and returned as { ok: false, error }
 * 5. Callers MUST check result.ok before using result.data
 */

import {
  saveAvailability,
  joinLobby as storeJoinLobby,
  leaveLobby as storeLeaveLobby,
  saveMatchScore as storeSaveMatchScore,
  confirmMatchScore as storeConfirmMatchScore,
  leaveTournament as storeLeaveTournament,
  joinFriendTournament as storeJoinFriendTournament,
  getProfile,
} from './store'
import type { AvailabilitySlot, Tournament, LobbyEntry } from './types'

// ── Result type (discriminated union) ──

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

const ok = <T,>(data: T): Result<T> => ({ ok: true, data })
const fail = <T,>(error: string): Result<T> => ({ ok: false, error })

async function safely<T>(fn: () => Promise<T>, errorPrefix = 'Operation failed'): Promise<Result<T>> {
  try {
    const data = await fn()
    return ok(data)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[Rally] ${errorPrefix}:`, msg)
    return fail(`${errorPrefix}: ${msg}`)
  }
}

// ── Mutations ──

/**
 * Update the current user's availability.
 * Pulls playerId, county, and weeklyCap from the current profile automatically.
 * Callers just provide the slots.
 */
export async function updateMyAvailability(slots: AvailabilitySlot[]): Promise<Result<void>> {
  const profile = getProfile()
  if (!profile) return fail('Not signed in')
  if (!profile.county) return fail('Profile is missing county')

  return safely(
    () => saveAvailability(profile.id, slots, profile.county, profile.weeklyCap ?? 2),
    'Could not save availability'
  )
}

/**
 * Join the lobby for the current user's county.
 * Pulls profile from auth context automatically.
 */
export async function joinMyLobby(): Promise<Result<LobbyEntry[]>> {
  const profile = getProfile()
  if (!profile) return fail('Not signed in')
  return safely(() => storeJoinLobby(profile), 'Could not join lobby')
}

/**
 * Leave the lobby.
 */
export async function leaveMyLobby(): Promise<Result<void>> {
  const profile = getProfile()
  if (!profile) return fail('Not signed in')
  return safely(() => storeLeaveLobby(profile.id), 'Could not leave lobby')
}

/**
 * Report a match score. Called by the player who won.
 * Returns the updated tournament on success.
 */
export async function reportMatchScore(
  tournamentId: string,
  matchId: string,
  score1: number[],
  score2: number[],
  winnerId: string
): Promise<Result<Tournament | undefined>> {
  const profile = getProfile()
  if (!profile) return fail('Not signed in')
  if (!Array.isArray(score1) || !Array.isArray(score2) || score1.length !== score2.length) {
    return fail('Score arrays must be equal length')
  }
  if (score1.length === 0 || score1.length > 5) {
    return fail('A match has 1-5 sets')
  }
  return safely(
    () => storeSaveMatchScore(tournamentId, matchId, score1, score2, winnerId, profile.id),
    'Could not save score'
  )
}

/**
 * Confirm the opponent's reported score.
 */
export async function confirmOpponentScore(
  tournamentId: string,
  matchId: string
): Promise<Result<Tournament | undefined>> {
  const profile = getProfile()
  if (!profile) return fail('Not signed in')
  return safely(
    () => storeConfirmMatchScore(tournamentId, matchId, profile.id),
    'Could not confirm score'
  )
}

/**
 * Forfeit/leave a tournament.
 */
export async function forfeitTournament(tournamentId: string): Promise<Result<boolean>> {
  const profile = getProfile()
  if (!profile) return fail('Not signed in')
  return safely(
    () => storeLeaveTournament(tournamentId, profile.id),
    'Could not leave tournament'
  )
}

/**
 * Join a friend tournament via invite code.
 */
export async function joinFriendTournamentByCode(inviteCode: string): Promise<Result<Tournament | null>> {
  const profile = getProfile()
  if (!profile) return fail('Not signed in')
  return safely(
    () => storeJoinFriendTournament(inviteCode, profile),
    'Could not join tournament'
  )
}
