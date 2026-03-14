/**
 * Availability-Clustered Grouping
 *
 * Groups players by schedule overlap so that within each group,
 * every pair of players shares enough common time windows for
 * the bulk scheduler to auto-confirm most matches.
 */

import type { SimpleAvailabilitySlot } from "./bulkScheduler.js";

export interface PlayerAvailability {
  playerId: string
  playerName: string
  slots: SimpleAvailabilitySlot[]
}

export interface ClusterGroup {
  players: Array<{ playerId: string; playerName: string }>
}

export interface ClusterResult {
  groups: ClusterGroup[]
  /** Players who couldn't be placed in any compatible group */
  waitlisted: Array<{ playerId: string; playerName: string }>
}

const MIN_GROUP_SIZE = 4
const MAX_GROUP_SIZE = 8
const MIN_OVERLAP_THRESHOLD = 3  // minimum shared 2-hour windows per week

/**
 * Compute the number of shared 2-hour match windows per week
 * between two players' availability.
 */
export function computeOverlapScore(
  slots1: SimpleAvailabilitySlot[],
  slots2: SimpleAvailabilitySlot[],
  matchDuration = 2,
): number {
  let count = 0
  for (const s1 of slots1) {
    for (const s2 of slots2) {
      if (s1.day !== s2.day) continue
      const overlapStart = Math.max(s1.startHour, s2.startHour)
      const overlapEnd = Math.min(s1.endHour, s2.endHour)
      // Count how many match-duration windows fit
      for (let start = overlapStart; start + matchDuration <= overlapEnd; start++) {
        count++
      }
    }
  }
  return count
}

/**
 * Build an overlap graph: for each pair of players, compute their overlap score.
 */
function buildOverlapGraph(
  players: PlayerAvailability[],
): Map<string, Map<string, number>> {
  const graph = new Map<string, Map<string, number>>()

  for (const p of players) {
    graph.set(p.playerId, new Map())
  }

  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const score = computeOverlapScore(players[i]!.slots, players[j]!.slots)
      graph.get(players[i]!.playerId)!.set(players[j]!.playerId, score)
      graph.get(players[j]!.playerId)!.set(players[i]!.playerId, score)
    }
  }

  return graph
}

/**
 * Check if a player is compatible with all members of a group
 * (shares >= threshold overlap windows with every member).
 */
function isCompatibleWithGroup(
  playerId: string,
  group: ClusterGroup,
  graph: Map<string, Map<string, number>>,
  threshold: number,
): boolean {
  const playerEdges = graph.get(playerId)
  if (!playerEdges) return false

  for (const member of group.players) {
    const score = playerEdges.get(member.playerId) ?? 0
    if (score < threshold) return false
  }
  return true
}

/**
 * Compute average overlap between a player and all members of a group.
 */
function averageOverlap(
  playerId: string,
  group: ClusterGroup,
  graph: Map<string, Map<string, number>>,
): number {
  if (group.players.length === 0) return 0
  const playerEdges = graph.get(playerId)
  if (!playerEdges) return 0

  let sum = 0
  for (const member of group.players) {
    sum += playerEdges.get(member.playerId) ?? 0
  }
  return sum / group.players.length
}

/**
 * Cluster players into groups of 4-8 based on availability overlap.
 *
 * Algorithm:
 * 1. Build overlap graph
 * 2. Sort players by total overlap ascending (hardest to place first)
 * 3. Greedy assignment: place each player in the best compatible group
 * 4. Post-process: merge undersized groups or waitlist remainders
 */
export function clusterPlayersByAvailability(
  players: PlayerAvailability[],
  options?: { minOverlap?: number; minGroupSize?: number; maxGroupSize?: number },
): ClusterResult {
  const threshold = options?.minOverlap ?? MIN_OVERLAP_THRESHOLD
  const minSize = options?.minGroupSize ?? MIN_GROUP_SIZE
  const maxSize = options?.maxGroupSize ?? MAX_GROUP_SIZE

  if (players.length <= maxSize) {
    // Small enough for a single group — no clustering needed
    return {
      groups: [{
        players: players.map(p => ({ playerId: p.playerId, playerName: p.playerName })),
      }],
      waitlisted: [],
    }
  }

  const graph = buildOverlapGraph(players)

  // Sort by total overlap ascending (hardest to place first)
  const sorted = [...players].sort((a, b) => {
    const totalA = [...(graph.get(a.playerId)?.values() ?? [])].reduce((s, v) => s + v, 0)
    const totalB = [...(graph.get(b.playerId)?.values() ?? [])].reduce((s, v) => s + v, 0)
    return totalA - totalB
  })

  const groups: ClusterGroup[] = []
  const assigned = new Set<string>()

  for (const player of sorted) {
    if (assigned.has(player.playerId)) continue

    // Find best compatible group
    let bestGroup: ClusterGroup | null = null
    let bestAvgOverlap = -1

    for (const group of groups) {
      if (group.players.length >= maxSize) continue
      if (!isCompatibleWithGroup(player.playerId, group, graph, threshold)) continue

      const avg = averageOverlap(player.playerId, group, graph)
      if (avg > bestAvgOverlap) {
        bestAvgOverlap = avg
        bestGroup = group
      }
    }

    if (bestGroup) {
      bestGroup.players.push({ playerId: player.playerId, playerName: player.playerName })
    } else {
      // Create new group
      groups.push({
        players: [{ playerId: player.playerId, playerName: player.playerName }],
      })
    }
    assigned.add(player.playerId)
  }

  // Post-process: merge undersized groups
  const validGroups: ClusterGroup[] = []
  const undersize: ClusterGroup[] = []

  for (const group of groups) {
    if (group.players.length >= minSize) {
      validGroups.push(group)
    } else {
      undersize.push(group)
    }
  }

  // Try to merge undersized groups with each other
  const waitlisted: Array<{ playerId: string; playerName: string }> = []
  const mergedUndersized: ClusterGroup[] = []

  for (const small of undersize) {
    let merged = false
    for (const target of mergedUndersized) {
      if (target.players.length + small.players.length <= maxSize) {
        target.players.push(...small.players)
        merged = true
        break
      }
    }
    if (!merged) {
      mergedUndersized.push({ players: [...small.players] })
    }
  }

  for (const group of mergedUndersized) {
    if (group.players.length >= minSize) {
      validGroups.push(group)
    } else {
      // Try to distribute into existing valid groups
      for (const player of group.players) {
        let placed = false
        for (const vg of validGroups) {
          if (vg.players.length < maxSize) {
            vg.players.push(player)
            placed = true
            break
          }
        }
        if (!placed) {
          waitlisted.push(player)
        }
      }
    }
  }

  return { groups: validGroups, waitlisted }
}
