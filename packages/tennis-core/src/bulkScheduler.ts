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
 *
 * Enforces three constraints:
 * 1. No time overlap — a player can't be in two matches at once
 * 2. Rest period  — minimum gap between matches for the same player (restHours).
 *    With the default 24h, a player can play at most once per calendar day.
 * 3. Weekly cap   — maximum matches per player per week
 */
function hasConflict(
  slot: CandidateSlot,
  player1Id: string,
  player2Id: string,
  assignments: Map<string, { matchId: string; slot: CandidateSlot; player1Id: string; player2Id: string }>,
  constraints: SchedulingConstraints,
): boolean {
  const weeklyCount: Record<string, number> = {}
  const restDays = Math.ceil(constraints.restHours / 24)

  for (const [, a] of assignments) {
    if (a.slot.week !== slot.week) continue

    // Does this assignment involve any of the same players?
    const sharesPlayer =
      a.player1Id === player1Id || a.player1Id === player2Id ||
      a.player2Id === player1Id || a.player2Id === player2Id

    if (sharesPlayer) {
      const dayIdxA = DAY_ORDER.indexOf(a.slot.day)
      const dayIdxB = DAY_ORDER.indexOf(slot.day)
      const dayGap = Math.abs(dayIdxA - dayIdxB)

      if (dayGap === 0) {
        // Same day: any second match on the same day violates restHours >= 24
        // (even non-overlapping times are at most ~12h apart, less than 24h)
        if (restDays >= 1) return true
      } else if (dayGap < restDays) {
        // Adjacent days within rest window (e.g., Mon+Tue with restHours=48)
        return true
      }
    }

    // Count weekly matches per player
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
  // Calculate weeks needed to fit all matches given constraints.
  // With N players and cap K, at most N*K/2 matches can happen per week.
  // But the per-day rest constraint may reduce this further — if players
  // share only 1 available day, each player can play at most once per week.
  const playerIds = new Set<string>()
  for (const m of matches) { playerIds.add(m.player1Id); playerIds.add(m.player2Id) }
  const playerCount = playerIds.size

  // Count distinct available days across all players
  const allDays = new Set<string>()
  for (const pid of playerIds) {
    for (const s of (availability[pid] ?? [])) allDays.add(s.day)
  }
  const availableDays = Math.max(1, allDays.size)
  const restDays = Math.ceil(constraints.restHours / 24)

  // Effective matches per player per week is min of weekly cap and available day slots
  const slotsPerPlayerPerWeek = Math.min(
    constraints.weeklyCapPerPlayer,
    Math.max(1, Math.floor(availableDays / restDays))
  )
  const matchesPerWeek = Math.max(1, Math.floor(playerCount * slotsPerPlayerPerWeek / 2))
  const weeks = Math.max(4, Math.ceil(matches.length / matchesPerWeek))

  // Filter out bye matches (missing player IDs)
  const validMatches = matches.filter(m => m.player1Id && m.player2Id)

  // Step 1: Compute candidate slots for each match
  const matchCandidates = new Map<string, { match: MatchToSchedule; candidates: CandidateSlot[] }>()
  for (const match of validMatches) {
    const slots1 = availability[match.player1Id] ?? []
    const slots2 = availability[match.player2Id] ?? []
    const candidates = computeOverlapWindows(slots1, slots2, constraints.matchDurationHours, weeks)
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

  for (const [matchId, { match, candidates }] of matchCandidates) {
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
      // Has overlap but couldn't fit due to constraints — suggest best slot
      result.needsAccept.push({
        matchId,
        slot: {
          day: candidates[0]!.day,
          startHour: candidates[0]!.startHour,
          endHour: candidates[0]!.endHour,
          week: candidates[0]!.week,
        },
      })
    } else {
      // No overlap at all — check if either player has availability
      const slots1 = availability[match.player1Id] ?? []
      const slots2 = availability[match.player2Id] ?? []
      if (slots1.length > 0 || slots2.length > 0) {
        // At least one player has availability — suggest from the player with more slots
        const bestSlots = slots1.length >= slots2.length ? slots1 : slots2
        if (bestSlots.length > 0) {
          const s = bestSlots[0]!
          result.needsAccept.push({
            matchId,
            slot: { day: s.day, startHour: s.startHour, endHour: s.startHour + constraints.matchDurationHours, week: 1 },
          })
        } else {
          result.needsNegotiation.push({ matchId })
        }
      } else {
        result.needsNegotiation.push({ matchId })
      }
    }
  }

  return result
}
