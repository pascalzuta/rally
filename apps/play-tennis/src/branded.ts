/**
 * Branded types — make IDs nominally typed so you can't accidentally pass
 * a TournamentId where a PlayerId is expected.
 *
 * Usage:
 *   const pid: PlayerId = asPlayerId(someString)
 *   function join(pid: PlayerId) { ... }
 *   join(tournament.id)  // ❌ Type error
 *   join(pid)            // ✅
 *
 * This is opt-in — existing string IDs still work. New code in mutations.ts
 * and RPCs should use branded types for critical ID parameters.
 */

export type PlayerId = string & { readonly __brand: 'PlayerId' }
export type TournamentId = string & { readonly __brand: 'TournamentId' }
export type MatchId = string & { readonly __brand: 'MatchId' }
export type CountyKey = string & { readonly __brand: 'CountyKey' }

/** Unsafe casts — use at boundaries where you trust the input */
export const asPlayerId = (s: string): PlayerId => s as PlayerId
export const asTournamentId = (s: string): TournamentId => s as TournamentId
export const asMatchId = (s: string): MatchId => s as MatchId

/** Normalizes + brands county (always lowercase) */
export const asCountyKey = (s: string): CountyKey => s.trim().toLowerCase() as CountyKey

/** Type guards */
export const isPlayerId = (s: unknown): s is PlayerId =>
  typeof s === 'string' && s.length > 0
export const isTournamentId = (s: unknown): s is TournamentId =>
  typeof s === 'string' && s.length > 0
