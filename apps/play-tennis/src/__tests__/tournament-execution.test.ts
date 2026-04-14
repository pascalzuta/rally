/**
 * Strategy A: end-to-end logic test for the tournament lifecycle.
 *
 * Runs the full flow through store.ts without a browser or network:
 *   profile → seed lobby → start → generate bracket → schedule →
 *   score group phase → auto-generate knockouts → score semis → score final → completed
 *
 * Asserts invariants at every transition. Any failure here is a bug that would
 * show up as "the tournament doesn't work" for a real player.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import './setup'
import {
  createProfile,
  joinLobby,
  seedLobby,
  getLobbyByCounty,
  startTournamentFromLobby,
  getSetupTournamentForCounty,
  forceStartTournament,
  getTournament,
  simulateRoundScores,
  autoConfirmAllSchedules,
  getTestProfiles,
  switchProfile,
  getProfile,
  saveAvailability,
  getAvailability,
  saveMatchScore,
  confirmMatchScore,
  getPlayerRating,
} from '../store'
import type { Tournament, AvailabilitySlot } from '../types'
import { clear as clearMemoryStore } from '../memoryStore'

const COUNTY = 'testville'

function clearStorage() {
  localStorage.clear()
  clearMemoryStore()
}

/** Build a simple 2h/day availability so clustering has something to chew on. */
function defaultAvail(): AvailabilitySlot[] {
  return [
    { day: 'monday', startHour: 18, endHour: 21 },
    { day: 'wednesday', startHour: 18, endHour: 21 },
    { day: 'saturday', startHour: 10, endHour: 14 },
  ]
}

/** Invariants that must always hold on a tournament object. */
function assertStructuralInvariants(t: Tournament, context: string) {
  // Players
  expect(t.players.length, `${context}: player count`).toBeGreaterThanOrEqual(2)
  const ids = new Set(t.players.map(p => p.id))
  expect(ids.size, `${context}: unique player ids`).toBe(t.players.length)

  // Matches
  const matchIds = new Set(t.matches.map(m => m.id))
  expect(matchIds.size, `${context}: unique match ids`).toBe(t.matches.length)

  for (const m of t.matches) {
    if (m.completed) {
      expect(m.winnerId, `${context}: completed match ${m.id} has winner`).toBeTruthy()
      expect(m.score1?.length, `${context}: completed match ${m.id} has score1`).toBeGreaterThan(0)
      expect(m.score2?.length, `${context}: completed match ${m.id} has score2`).toBeGreaterThan(0)
      if (m.winnerId) {
        expect([m.player1Id, m.player2Id], `${context}: winner is a participant`).toContain(m.winnerId)
      }
    }
    if (m.player1Id && m.player2Id) {
      expect(m.player1Id, `${context}: ${m.id} player1 ≠ player2`).not.toBe(m.player2Id)
      expect(ids.has(m.player1Id) || m.phase === 'knockout', `${context}: ${m.id} player1 in tournament`).toBeTruthy()
    }
  }

  // Bracket-specific checks only apply after the bracket has been generated.
  // In 'setup' state, t.matches is still empty — no pairings to validate yet.
  if ((t.format === 'round-robin' || t.format === 'group-knockout') && t.status !== 'setup') {
    const pairs = new Set<string>()
    for (const m of t.matches.filter(x => x.phase === 'group')) {
      if (!m.player1Id || !m.player2Id) continue
      const key = [m.player1Id, m.player2Id].sort().join('|')
      expect(pairs.has(key), `${context}: duplicate group pairing ${key}`).toBe(false)
      pairs.add(key)
    }

    // Expected group match count is n choose 2
    const n = t.players.length
    const expectedGroupMatches = (n * (n - 1)) / 2
    const actualGroupMatches = t.matches.filter(m => m.phase === 'group').length
    expect(actualGroupMatches, `${context}: group match count`).toBe(expectedGroupMatches)
  }
}

describe('Tournament execution — full lifecycle (Strategy A)', () => {
  beforeEach(() => {
    clearStorage()
  })

  it('1. creates a profile and joins the lobby', async () => {
    const profile = createProfile('Pascal Test', COUNTY, { gender: 'male', skillLevel: 'intermediate' })
    expect(profile.name).toBe('Pascal Test')
    expect(profile.county).toBe(COUNTY)
    saveAvailability(profile.id, defaultAvail())
    expect(getAvailability(profile.id).length).toBe(3)

    await joinLobby(profile)
    const lobby = getLobbyByCounty(COUNTY)
    expect(lobby.length).toBe(1)
    expect(lobby[0].playerId).toBe(profile.id)
  })

  it('2. seeds 5 more players and forms a 6-player lobby', async () => {
    const profile = createProfile('Pascal Test', COUNTY, { gender: 'male', skillLevel: 'intermediate' })
    saveAvailability(profile.id, defaultAvail())
    await joinLobby(profile)

    const seeded = await seedLobby(COUNTY, 5)
    expect(seeded.length).toBeGreaterThanOrEqual(6)
    const lobby = getLobbyByCounty(COUNTY)
    expect(lobby.length).toBe(6)
  })

  it('3. startTournamentFromLobby creates a setup tournament with all 6 players', async () => {
    const profile = createProfile('Pascal Test', COUNTY, { gender: 'male', skillLevel: 'intermediate' })
    saveAvailability(profile.id, defaultAvail())
    await joinLobby(profile)
    await seedLobby(COUNTY, 5)

    const result = await startTournamentFromLobby(COUNTY)
    // Depending on clustering, startTournamentFromLobby may return a tournament in setup
    // state, OR none (if cluster overlap is insufficient). Either way, we should find
    // a setup tournament after this call.
    const setup = getSetupTournamentForCounty(COUNTY, 'male', 'intermediate')
    expect(setup, 'setup tournament created').toBeTruthy()
    if (setup) {
      expect(setup.players.length).toBeGreaterThanOrEqual(6)
      expect(setup.status).toBe('setup')
      expect(setup.format).toBe('round-robin')
      assertStructuralInvariants(setup, 'after startTournamentFromLobby')
    }
    // result can legitimately be null if the function returns the first created
    // tournament and the lobby flow took a different branch; don't assert on result.
    void result
  })

  it('4. forceStartTournament generates the full round-robin bracket + schedules', async () => {
    const profile = createProfile('Pascal Test', COUNTY, { gender: 'male', skillLevel: 'intermediate' })
    saveAvailability(profile.id, defaultAvail())
    await joinLobby(profile)
    await seedLobby(COUNTY, 5)
    await startTournamentFromLobby(COUNTY)
    const setup = getSetupTournamentForCounty(COUNTY, 'male', 'intermediate')
    expect(setup, 'setup tournament exists').toBeTruthy()
    if (!setup) return

    const started = await forceStartTournament(setup.id)
    expect(started, 'forceStartTournament returned a tournament').toBeTruthy()
    if (!started) return

    expect(started.status).toBe('in-progress')
    assertStructuralInvariants(started, 'after forceStartTournament')

    // Round-robin for 6 players: 15 group matches
    const groupMatches = started.matches.filter(m => m.phase === 'group')
    expect(groupMatches.length).toBe(15)

    // Every group match has both players and a schedule (either confirmed, proposed,
    // or negotiation) — no match should be left "raw" after bulk scheduling.
    for (const m of groupMatches) {
      expect(m.player1Id, `match ${m.id} player1`).toBeTruthy()
      expect(m.player2Id, `match ${m.id} player2`).toBeTruthy()
      expect(m.schedule, `match ${m.id} has schedule`).toBeTruthy()
      if (m.schedule) {
        expect(['auto', 'needs-accept', 'needs-negotiation']).toContain(m.schedule.schedulingTier)
      }
    }

    // Scheduling summary should account for all group matches
    expect(started.schedulingSummary, 'scheduling summary set').toBeTruthy()
    if (started.schedulingSummary) {
      const total =
        started.schedulingSummary.confirmed +
        started.schedulingSummary.needsAccept +
        started.schedulingSummary.needsNegotiation
      expect(total).toBe(groupMatches.length)
    }
  })

  it('5. autoConfirmAllSchedules flips every pending proposal to confirmed', async () => {
    const profile = createProfile('Pascal Test', COUNTY, { gender: 'male', skillLevel: 'intermediate' })
    saveAvailability(profile.id, defaultAvail())
    await joinLobby(profile)
    await seedLobby(COUNTY, 5)
    await startTournamentFromLobby(COUNTY)
    const setup = getSetupTournamentForCounty(COUNTY, 'male', 'intermediate')!
    const started = await forceStartTournament(setup.id)
    expect(started).toBeTruthy()
    if (!started) return

    const confirmed = await autoConfirmAllSchedules(started.id)
    expect(confirmed).toBeTruthy()
    if (!confirmed) return

    // Any match that started as proposed/needs-accept with pending proposals
    // should now be confirmed with a confirmedSlot.
    const schedulable = confirmed.matches.filter(m => m.schedule)
    for (const m of schedulable) {
      if (!m.schedule) continue
      // needs-negotiation may stay in its own state if it had no pending proposals
      if (m.schedule.proposals.some(p => p.status === 'accepted')) {
        expect(m.schedule.confirmedSlot, `match ${m.id} confirmedSlot`).toBeTruthy()
      }
    }
  })

  it('6. simulateRoundScores completes the group phase and auto-generates knockouts', async () => {
    const profile = createProfile('Pascal Test', COUNTY, { gender: 'male', skillLevel: 'intermediate' })
    saveAvailability(profile.id, defaultAvail())
    await joinLobby(profile)
    await seedLobby(COUNTY, 5)
    await startTournamentFromLobby(COUNTY)
    const setup = getSetupTournamentForCounty(COUNTY, 'male', 'intermediate')!
    const started = await forceStartTournament(setup.id)
    expect(started).toBeTruthy()
    if (!started) return

    // Score round 1 (all group matches)
    const afterR1 = await simulateRoundScores(started.id)
    expect(afterR1, 'round 1 simulated').toBeTruthy()
    if (!afterR1) return

    const groupMatches = afterR1.matches.filter(m => m.phase === 'group')
    expect(groupMatches.every(m => m.completed), 'all group matches complete').toBe(true)
    expect(afterR1.groupPhaseComplete, 'groupPhaseComplete flag set').toBe(true)
    assertStructuralInvariants(afterR1, 'after round 1')

    // Knockouts should have been auto-generated: 2 semis + 1 final
    const knockouts = afterR1.matches.filter(m => m.phase === 'knockout')
    expect(knockouts.length, 'knockout matches count').toBe(3)

    const semis = knockouts.filter(m => m.round === 2)
    const finals = knockouts.filter(m => m.round === 3)
    expect(semis.length).toBe(2)
    expect(finals.length).toBe(1)

    // Semis should have both players assigned (top 4 from standings)
    for (const s of semis) {
      expect(s.player1Id, `semi ${s.id} player1`).toBeTruthy()
      expect(s.player2Id, `semi ${s.id} player2`).toBeTruthy()
    }

    // Final should be empty until semis are played
    expect(finals[0].player1Id).toBeFalsy()
    expect(finals[0].player2Id).toBeFalsy()
  })

  it('7. simulateRoundScores advances semis and fills the final', async () => {
    const profile = createProfile('Pascal Test', COUNTY, { gender: 'male', skillLevel: 'intermediate' })
    saveAvailability(profile.id, defaultAvail())
    await joinLobby(profile)
    await seedLobby(COUNTY, 5)
    await startTournamentFromLobby(COUNTY)
    const setup = getSetupTournamentForCounty(COUNTY, 'male', 'intermediate')!
    const started = await forceStartTournament(setup.id)
    if (!started) return

    await simulateRoundScores(started.id) // round 1 (group)
    const afterSemis = await simulateRoundScores(started.id) // round 2 (semis)
    expect(afterSemis).toBeTruthy()
    if (!afterSemis) return

    const semis = afterSemis.matches.filter(m => m.phase === 'knockout' && m.round === 2)
    expect(semis.every(m => m.completed), 'all semis complete').toBe(true)

    const final = afterSemis.matches.find(m => m.phase === 'knockout' && m.round === 3)
    expect(final, 'final exists').toBeTruthy()
    if (!final) return
    expect(final.player1Id, 'final player1 filled after semis').toBeTruthy()
    expect(final.player2Id, 'final player2 filled after semis').toBeTruthy()
    expect(final.completed, 'final not yet played').toBe(false)

    // Final players should be semi winners
    const semiWinners = new Set(semis.map(s => s.winnerId))
    expect(semiWinners.has(final.player1Id)).toBe(true)
    expect(semiWinners.has(final.player2Id)).toBe(true)

    assertStructuralInvariants(afterSemis, 'after semis')
  })

  it('8. simulateRoundScores finishes the final and marks tournament completed', async () => {
    const profile = createProfile('Pascal Test', COUNTY, { gender: 'male', skillLevel: 'intermediate' })
    saveAvailability(profile.id, defaultAvail())
    await joinLobby(profile)
    await seedLobby(COUNTY, 5)
    await startTournamentFromLobby(COUNTY)
    const setup = getSetupTournamentForCounty(COUNTY, 'male', 'intermediate')!
    const started = await forceStartTournament(setup.id)
    if (!started) return

    await simulateRoundScores(started.id) // group
    await simulateRoundScores(started.id) // semis
    const afterFinal = await simulateRoundScores(started.id) // final
    expect(afterFinal).toBeTruthy()
    if (!afterFinal) return

    expect(afterFinal.status, 'tournament completed').toBe('completed')
    expect(afterFinal.matches.every(m => m.completed), 'every match complete').toBe(true)
    assertStructuralInvariants(afterFinal, 'after final')

    const final = afterFinal.matches.find(m => m.phase === 'knockout' && m.round === 3)!
    expect(final.winnerId, 'final has a winner').toBeTruthy()
    expect([final.player1Id, final.player2Id]).toContain(final.winnerId)
  })

  it('9. switchProfile lets us act as a different seeded player', async () => {
    const profile = createProfile('Pascal Test', COUNTY, { gender: 'male', skillLevel: 'intermediate' })
    saveAvailability(profile.id, defaultAvail())
    await joinLobby(profile)
    await seedLobby(COUNTY, 5)

    const testProfiles = getTestProfiles(COUNTY)
    expect(testProfiles.length).toBeGreaterThan(0)

    const other = testProfiles.find(p => p.name !== profile.name)
    expect(other, 'a different test profile exists').toBeTruthy()
    if (!other) return

    switchProfile(other)
    const now = getProfile()
    expect(now?.name).toBe(other.name)
    expect(now?.id).toBe(other.id)
  })

  // Strategy A verification of Finding #11 (rating not visibly updating).
  // The Strategy B run drove scoring through devCompleteMatch which bypasses
  // the real reportScore/confirmScore + updateRatings code path. This test
  // exercises the REAL flow and asserts ratings actually change.
  it('11. real reportScore + confirmScore flow updates both players ratings', async () => {
    const profile = createProfile('Pascal Test', COUNTY, { gender: 'male', skillLevel: 'intermediate' })
    saveAvailability(profile.id, defaultAvail())
    await joinLobby(profile)
    await seedLobby(COUNTY, 5)
    await startTournamentFromLobby(COUNTY)
    const setup = getSetupTournamentForCounty(COUNTY, 'male', 'intermediate')!
    const started = await forceStartTournament(setup.id)
    expect(started).toBeTruthy()
    if (!started) return

    // Pick the first match that has both players assigned
    const match = started.matches.find(m => m.player1Id && m.player2Id && m.phase === 'group')
    expect(match, 'has a playable match').toBeTruthy()
    if (!match) return
    const p1Id = match.player1Id!
    const p2Id = match.player2Id!

    const before1 = getPlayerRating(p1Id)
    const before2 = getPlayerRating(p2Id)
    const beforeMatches1 = before1.matchesPlayed
    const beforeMatches2 = before2.matchesPlayed

    // Phase 1: reporter (p1) submits the score, picks themselves as winner
    const afterReport = await saveMatchScore(started.id, match.id, [6, 6], [4, 3], p1Id, p1Id)
    expect(afterReport, 'saveMatchScore returned tournament').toBeTruthy()

    // Phase 2: confirmer (p2) confirms the score
    const afterConfirm = await confirmMatchScore(started.id, match.id, p2Id)
    expect(afterConfirm, 'confirmMatchScore returned tournament').toBeTruthy()
    if (!afterConfirm) return

    // Match must be marked completed
    const completedMatch = afterConfirm.matches.find(m => m.id === match.id)!
    expect(completedMatch.completed, 'match completed after confirm').toBe(true)
    expect(completedMatch.winnerId).toBe(p1Id)

    // Ratings must have changed for both players
    const after1 = getPlayerRating(p1Id)
    const after2 = getPlayerRating(p2Id)
    expect(after1.rating, `p1 rating changed (was ${before1.rating}, now ${after1.rating})`).not.toBe(before1.rating)
    expect(after2.rating, `p2 rating changed (was ${before2.rating}, now ${after2.rating})`).not.toBe(before2.rating)
    // Winner should gain, loser should lose
    expect(after1.rating, 'winner rating > before').toBeGreaterThan(before1.rating)
    expect(after2.rating, 'loser rating < before').toBeLessThan(before2.rating)

    // Match counters must increment by EXACTLY 1 (not 2 — guards against the
    // double-update bug where saveMatchScore + confirmMatchScore both call
    // updateRatings non-idempotently).
    expect(after1.matchesPlayed - beforeMatches1, 'p1 matchesPlayed +1').toBe(1)
    expect(after2.matchesPlayed - beforeMatches2, 'p2 matchesPlayed +1').toBe(1)
  })

  it('10. regression: tournament can be re-scored without corrupting prior matches', async () => {
    const profile = createProfile('Pascal Test', COUNTY, { gender: 'male', skillLevel: 'intermediate' })
    saveAvailability(profile.id, defaultAvail())
    await joinLobby(profile)
    await seedLobby(COUNTY, 5)
    await startTournamentFromLobby(COUNTY)
    const setup = getSetupTournamentForCounty(COUNTY, 'male', 'intermediate')!
    const started = await forceStartTournament(setup.id)
    if (!started) return

    await simulateRoundScores(started.id) // group
    // Structured-clone the snapshot: store mutates tournaments in place so a
    // plain reference would silently track future changes.
    const afterGroup = structuredClone(getTournament(started.id)!)
    const groupCompletedIds = new Set(
      afterGroup.matches.filter(m => m.completed).map(m => m.id),
    )

    await simulateRoundScores(started.id) // semis
    const afterSemis = getTournament(started.id)!

    // Every match that was completed before should still be completed after.
    const stillCompleted = afterSemis.matches.filter(
      m => groupCompletedIds.has(m.id) && m.completed,
    )
    expect(stillCompleted.length, 'previously completed matches stay completed').toBe(groupCompletedIds.size)
  })
})
