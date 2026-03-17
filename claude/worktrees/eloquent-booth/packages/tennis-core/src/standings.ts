import type { Match, StandingEntry } from "./types.js";

/**
 * Compute tournament standings from a list of player IDs and completed matches.
 *
 * Tiebreak order:
 *  1. Wins (descending)
 *  2. Head-to-head result (2-way only; skip if tied or no direct match)
 *  3. Set difference (descending)
 *  4. Game difference (descending)
 *  5. Deterministic hash tiebreak (FNV-1a hash of sorted player IDs + month)
 */
export function computeStandings(
  playerIds: string[],
  matches: Match[],
  month?: string
): StandingEntry[] {
  // Initialize entries
  const entryMap = new Map<string, StandingEntry>();
  for (const pid of playerIds) {
    entryMap.set(pid, {
      playerId: pid,
      played: 0,
      wins: 0,
      losses: 0,
      setsWon: 0,
      setsLost: 0,
      setDiff: 0,
      gamesWon: 0,
      gamesLost: 0,
      gameDiff: 0,
      headToHead: {},
    });
  }

  // Initialize headToHead as "pending" for all pairs
  for (const pid of playerIds) {
    const entry = entryMap.get(pid)!;
    for (const other of playerIds) {
      if (other !== pid) {
        entry.headToHead[other] = "pending";
      }
    }
  }

  // Process completed matches
  const completedMatches = matches.filter(
    (m) => m.status === "completed" && m.result
  );

  for (const match of completedMatches) {
    const { challengerId, opponentId, result } = match;
    if (!result) continue;

    const challengerEntry = entryMap.get(challengerId);
    const opponentEntry = entryMap.get(opponentId);
    if (!challengerEntry || !opponentEntry) continue;

    // Determine winner/loser
    const winnerId = result.winnerId;
    const loserId = winnerId === challengerId ? opponentId : challengerId;
    const winnerEntry = entryMap.get(winnerId)!;
    const loserEntry = entryMap.get(loserId)!;

    // Increment played
    winnerEntry.played++;
    loserEntry.played++;

    // Wins/losses
    winnerEntry.wins++;
    loserEntry.losses++;

    // Head-to-head
    winnerEntry.headToHead[loserId] = "win";
    loserEntry.headToHead[winnerId] = "loss";

    // Process set scores if available
    if (result.sets && result.sets.length > 0) {
      // "a" is challenger, "b" is opponent in SetScore
      for (const set of result.sets) {
        // Challenger stats
        challengerEntry.gamesWon += set.aGames;
        challengerEntry.gamesLost += set.bGames;
        if (set.aGames > set.bGames) {
          challengerEntry.setsWon++;
          opponentEntry.setsLost++;
        } else {
          challengerEntry.setsLost++;
          opponentEntry.setsWon++;
        }

        // Opponent stats
        opponentEntry.gamesWon += set.bGames;
        opponentEntry.gamesLost += set.aGames;
      }
    }
  }

  // Compute diffs
  for (const entry of entryMap.values()) {
    entry.setDiff = entry.setsWon - entry.setsLost;
    entry.gameDiff = entry.gamesWon - entry.gamesLost;
  }

  // Sort with tiebreaks
  const entries = Array.from(entryMap.values());
  entries.sort((a, b) => {
    // 1. Wins descending
    if (b.wins !== a.wins) return b.wins - a.wins;

    // 2. Head-to-head (2-way only)
    const h2h = resolveHeadToHead(a, b);
    if (h2h !== 0) return h2h;

    // 3. Set difference descending
    if (b.setDiff !== a.setDiff) return b.setDiff - a.setDiff;

    // 4. Game difference descending
    if (b.gameDiff !== a.gameDiff) return b.gameDiff - a.gameDiff;

    // 5. Deterministic hash tiebreak
    return deterministicTiebreak(a.playerId, b.playerId, month);
  });

  return entries;
}

/**
 * Resolve head-to-head between exactly two players.
 * Returns negative if a should rank higher, positive if b should.
 * Returns 0 if no direct result or tied.
 */
function resolveHeadToHead(a: StandingEntry, b: StandingEntry): number {
  const aVsB = a.headToHead[b.playerId];
  if (aVsB === "win") return -1; // a ranks higher
  if (aVsB === "loss") return 1; // b ranks higher
  return 0; // pending or no match
}

/**
 * Deterministic tiebreak using hash of sorted player IDs + month.
 * Uses FNV-1a hash for a fast, synchronous, deterministic comparison.
 */
export function deterministicTiebreak(idA: string, idB: string, month = ""): number {
  const sorted = [idA, idB].sort();
  const keyA = fnv1a(`${sorted[0]}:${sorted[1]}:${month}:${idA}`);
  const keyB = fnv1a(`${sorted[0]}:${sorted[1]}:${month}:${idB}`);
  return keyA - keyB;
}

/** FNV-1a 32-bit hash */
function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash;
}
