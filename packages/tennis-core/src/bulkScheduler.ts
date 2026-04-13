/**
 * Bulk Auto-Scheduler
 *
 * Assigns concrete time slots to all round-robin matches in one pass.
 * Uses constraint satisfaction with backtracking to maximize auto-confirmed matches.
 */

// Simple availability slot (matches play-tennis app format)
export interface SimpleAvailabilitySlot {
  day: string        // 'monday' | 'tuesday' | ... | 'sunday'
  startHour: number  // 0-23
  endHour: number    // 1-24
}

export interface MatchToSchedule {
  matchId: string
  player1Id: string
  player2Id: string
}

export interface SchedulingConstraints {
  /** Minimum hours between matches for the same player (default: 24 = 1 day) */
  restHours: number
  /** Maximum matches per player per week (default: 2) */
  weeklyCapPerPlayer: number
  /** Match duration in hours (default: 2) */
  matchDurationHours: number
  /** Maximum backtracking depth (default: 2) */
  maxBacktrackDepth: number
}

export interface ScheduledSlot {
  day: string
  startHour: number
  endHour: number
  /** Week number (1-based) from tournament start */
  week: number
}

export interface BulkScheduleResult {
  /** Matches with auto-assigned times (both players available) */
  confirmed: Array<{ matchId: string; slot: ScheduledSlot }>
  /** Matches with a suggested time needing one player's accept */
  needsAccept: Array<{ matchId: string; slot: ScheduledSlot }>
  /** Matches with no viable overlap — need manual negotiation */
  needsNegotiation: Array<{ matchId: string }>
}

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const WEEKEND_DAYS = new Set(['saturday', 'sunday'])

const DEFAULT_CONSTRAINTS: SchedulingConstraints = {
  restHours: 24,
  weeklyCapPerPlayer: 2,
  matchDurationHours: 2,
  maxBacktrackDepth: 2,
}

interface CandidateSlot {
  day: string
  startHour: number
  endHour: number
  week: number
  score: number // higher = more preferred
}

/**
 * Compute 2-hour match windows where both players are available.
 */
function computeOverlapWindows(
  slots1: SimpleAvailabilitySlot[],
  slots2: SimpleAvailabilitySlot[],
  matchDuration: number,
  weeks: number,
): CandidateSlot[] {
  const candidates: CandidateSlot[] = []

  for (const s1 of slots1) {
    for (const s2 of slots2) {
      if (s1.day !== s2.day) continue
      const overlapStart = Math.max(s1.startHour, s2.startHour)
      const overlapEnd = Math.min(s1.endHour, s2.endHour)
      if (overlapEnd - overlapStart < matchDuration) continue

      // Split into match-duration windows
      for (let start = overlapStart; start + matchDuration <= overlapEnd; start++) {
        // Create a candidate for each week
        for (let week = 1; week <= weeks; week++) {
          const isWeekend = WEEKEND_DAYS.has(s1.day)
          candidates.push({
            day: s1.day,
            startHour: start,
            endHour: start + matchDuration,
            week,
            score: (isWeekend ? 10 : 0) + (start >= 8 && start <= 18 ? 5 : 0),
          })
        }
      }
    }
  }

  // Sort by score descending (prefer weekends, daytime)
  candidates.sort((a, b) => b.score - a.score)
  return candidates
}

/**
 * Check if assigning a slot to a match conflicts with existing assignments.
 */
function hasConflict(
  slot: CandidateSlot,
  player1Id: string,
  player2Id: string,
  assignments: Map<string, { matchId: string; slot: CandidateSlot; player1Id: string; player2Id: string }>,
  constraints: SchedulingConstraints,
): boolean {
  // Count weekly matches per player
  const weeklyCount: Record<string, number> = {}

  for (const [, a] of assignments) {
    if (a.slot.week !== slot.week) continue

    // Check same-day conflict: only one match per player per day
    if (a.slot.day === slot.day) {
      if (a.player1Id === player1Id || a.player1Id === player2Id ||
          a.player2Id === player1Id || a.player2Id === player2Id) {
        return true
      }
    }

    // Check rest day: no matches on adjacent days for same player
    const dayIdx1 = DAY_ORDER.indexOf(a.slot.day)
    const dayIdx2 = DAY_ORDER.indexOf(slot.day)
    if (dayIdx1 !== dayIdx2 && Math.abs(dayIdx1 - dayIdx2) < Math.ceil(constraints.restHours / 24)) {
      if (a.player1Id === player1Id || a.player1Id === player2Id ||
          a.player2Id === player1Id || a.player2Id === player2Id) {
        return true
      }
    }

    // Count weekly matches
    for (const pid of [a.player1Id, a.player2Id]) {
      weeklyCount[pid] = (weeklyCount[pid] ?? 0) + 1
    }
  }

  // Check weekly cap
  for (const pid of [player1Id, player2Id]) {
    if ((weeklyCount[pid] ?? 0) >= constraints.weeklyCapPerPlayer) {
      return true
    }
  }

  return false
}

/**
 * Bulk-schedule all matches in a round-robin tournament.
 *
 * Algorithm:
 * 1. Compute overlap windows for each match
 * 2. Sort matches by fewest candidate slots (hardest first)
 * 3. Greedy assignment with backtracking
 * 4. Classify unresolved matches as needsAccept or needsNegotiation
 */
export function bulkScheduleMatches(
  matches: MatchToSchedule[],
  availability: Record<string, SimpleAvailabilitySlot[]>,
  constraintsInput?: Partial<SchedulingConstraints>,
): BulkScheduleResult {
  const constraints = { ...DEFAULT_CONSTRAINTS, ...constraintsInput }
  // Calculate weeks based on actual player count: with N players and cap K,
  // at most N*K/2 matches can happen per week (each match uses 2 player slots)
  const playerIds = new Set<string>()
  for (const m of matches) { playerIds.add(m.player1Id); playerIds.add(m.player2Id) }
  const playerCount = playerIds.size
  const matchesPerWeek = Math.max(1, Math.floor(playerCount * constraints.weeklyCapPerPlayer / 2))
  const weeks = Math.max(3, Math.ceil(matches.length / matchesPerWeek))

  // Filter out bye matches (missing player IDs)
  const validMatches = matches.filter(m => m.player1Id && m.player2Id)

  // Step 1: Compute candidate slots for each match
  const matchCandidates = new Map<string, { match: MatchToSchedule; candidates: CandidateSlot[] }>()
  const zeroOverlap: MatchToSchedule[] = []
  for (const match of validMatches) {
    const slots1 = availability[match.player1Id] ?? []
    const slots2 = availability[match.player2Id] ?? []
    const candidates = computeOverlapWindows(slots1, slots2, constraints.matchDurationHours, weeks)
    if (candidates.length === 0) {
      // No shared windows — honestly mark this as negotiation. Critically,
      // we must NOT include zero-candidate matches in the backtracking pool:
      // 3+ unfeasible matches at the front of the sorted list exhaust the
      // backtrack budget and cause the DFS to return zero assignments overall.
      zeroOverlap.push(match)
      continue
    }
    matchCandidates.set(match.matchId, { match, candidates })
  }

  // Step 2: Sort by fewest candidates (hardest to schedule first)
  const sorted = [...matchCandidates.entries()]
    .sort(([, a], [, b]) => a.candidates.length - b.candidates.length)

  // Step 3: Greedy assignment with backtracking (iteration-limited)
  const assignments = new Map<string, { matchId: string; slot: CandidateSlot; player1Id: string; player2Id: string }>()
  const MAX_ITERATIONS = 50_000
  let iterations = 0

  function tryAssign(matchIdx: number, backtrackDepth: number): boolean {
    if (++iterations > MAX_ITERATIONS) return false // safety valve
    if (matchIdx >= sorted.length) return true

    const [matchId, { match, candidates }] = sorted[matchIdx]!

    for (const slot of candidates) {
      if (iterations > MAX_ITERATIONS) return false
      if (!hasConflict(slot, match.player1Id, match.player2Id, assignments, constraints)) {
        assignments.set(matchId, { matchId, slot, player1Id: match.player1Id, player2Id: match.player2Id })

        if (tryAssign(matchIdx + 1, backtrackDepth)) return true

        assignments.delete(matchId)
      }
    }

    // If no slot works and we haven't exceeded backtrack depth, skip this match
    if (backtrackDepth < constraints.maxBacktrackDepth) {
      return tryAssign(matchIdx + 1, backtrackDepth + 1)
    }

    return false
  }

  tryAssign(0, 0)

  // Step 4: Classify results
  const result: BulkScheduleResult = {
    confirmed: [],
    needsAccept: [],
    needsNegotiation: [],
  }

  for (const [matchId, { candidates }] of matchCandidates) {
    const assignment = assignments.get(matchId)
    if (assignment) {
      result.confirmed.push({
        matchId,
        slot: {
          day: assignment.slot.day,
          startHour: assignment.slot.startHour,
          endHour: assignment.slot.endHour,
          week: assignment.slot.week,
        },
      })
    } else if (candidates.length > 0) {
      // Has overlap but couldn't fit due to constraints — suggest best non-conflicting slot
      const nonConflicting = candidates.find(c => !hasConflict(c, match.player1Id, match.player2Id, assignments, constraints))
      const best = nonConflicting ?? candidates[0]!

      result.needsAccept.push({
        matchId,
        slot: {
          day: best.day,
          startHour: best.startHour,
          endHour: best.endHour,
          week: best.week,
        },
      })
    }
  }

  // Zero-overlap matches: classified up front in step 1. These are matches
  // where the two players literally share no time windows. Suggesting one
  // player's slot would be a lie (the other player can't make it), so we
  // honestly mark them as needsNegotiation — the players will see this in
  // the schedule summary and can coordinate manually.
  for (const match of zeroOverlap) {
    result.needsNegotiation.push({ matchId: match.matchId })
  }

  return result
}
