import type { TournamentRound, RoundRobinPairing } from "./types.js";

/**
 * Generate a round-robin schedule using the circle method.
 *
 * For N players (padded to N+1 if odd, with bye index -1):
 * - Fix player 0, rotate positions 1..N-1 each round
 * - Produces (N-1) rounds for even N, N rounds for odd N
 * - Each round has N/2 pairings
 *
 * Target weeks are spread evenly across 4 weeks.
 *
 * @param playerCount Number of players (4-8)
 * @returns Array of TournamentRound
 */
export function generateRoundRobin(playerCount: number): TournamentRound[] {
  if (playerCount < 4 || playerCount > 8) {
    throw new Error(`playerCount must be 4-8, got ${playerCount}`);
  }

  // Pad to even number (add a "bye" slot)
  const n = playerCount % 2 === 0 ? playerCount : playerCount + 1;
  const totalRounds = n - 1;
  const halfN = n / 2;

  // Indices: 0 is fixed, 1..(n-1) rotate
  // If we padded, index (n-1) represents the bye
  const hasBye = playerCount % 2 !== 0;
  const byeIndex = hasBye ? n - 1 : -1;

  // Build the initial list of rotating positions
  const rotating: number[] = [];
  for (let i = 1; i < n; i++) {
    rotating.push(i);
  }

  const rounds: TournamentRound[] = [];

  for (let round = 0; round < totalRounds; round++) {
    const pairings: RoundRobinPairing[] = [];

    // First pairing: fixed player 0 vs first in rotation
    const first = rotating[0]!;
    pairings.push(toPairing(0, first, hasBye, byeIndex));

    // Remaining pairings: pair from outside-in
    for (let i = 1; i < halfN; i++) {
      const home = rotating[i]!;
      const away = rotating[rotating.length - i]!;
      pairings.push(toPairing(home, away, hasBye, byeIndex));
    }

    rounds.push({
      roundNumber: round + 1,
      targetWeek: 0, // assigned below
      pairings,
    });

    // Rotate: move last element to front of rotating array
    const last = rotating.pop()!;
    rotating.unshift(last);
  }

  // Assign target weeks spread across 4 weeks
  assignTargetWeeks(rounds);

  return rounds;
}

/**
 * Convert a pair of indices into a RoundRobinPairing.
 * If either index is the bye slot, map it to -1 in the pairing.
 */
function toPairing(
  a: number,
  b: number,
  hasBye: boolean,
  byeIndex: number
): RoundRobinPairing {
  const homeIndex = hasBye && a === byeIndex ? -1 : a;
  const awayIndex = hasBye && b === byeIndex ? -1 : b;
  return { homeIndex, awayIndex, matchId: null };
}

/**
 * Distribute rounds evenly across 4 target weeks.
 * For 7 rounds -> weeks 1,1,2,2,3,3,4
 * For 5 rounds -> weeks 1,1,2,3,4
 * etc.
 */
function assignTargetWeeks(rounds: TournamentRound[]): void {
  const total = rounds.length;
  for (let i = 0; i < total; i++) {
    // Evenly distribute: week = floor(i * 4 / total) + 1
    rounds[i]!.targetWeek = Math.floor((i * 4) / total) + 1;
  }
}
