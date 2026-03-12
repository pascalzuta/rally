import { useMemo, useRef, useState } from 'react'
import { getPlayerName, getPlayerSeed, getAvailability, getPlayerRating, getCountyLeaderboard, getTournamentsByCounty, getIncomingOffers, getOutgoingOffers, saveMatchScore, getSeeds, winProbability, getRecentResults } from '../store'
import { PlayerProfile, Tournament, Match } from '../types'
import Lobby from './Lobby'
import MatchSchedulePanel from './MatchSchedulePanel'

interface Props {
  profile: PlayerProfile
  tournaments: Tournament[]
  autoJoin?: boolean
  onAutoJoinConsumed?: () => void
  onTournamentCreated: (id: string) => void
  onViewTournament: (id: string) => void
  onViewMatch: (tournamentId: string, matchId: string) => void
  onViewLeaderboard?: () => void
  onViewOffers?: () => void
  onDataChanged?: () => void
}

// --- Onboarding ---

interface ActivationStep {
  label: string
  completed: boolean
}

function getActivationSteps(
  profile: PlayerProfile,
  tournaments: Tournament[],
  hasAvailability: boolean,
  hasPlayedMatch: boolean
): ActivationStep[] {
  const inTournament = tournaments.some(t =>
    (t.status === 'setup' || t.status === 'in-progress') &&
    t.players.some(p => p.id === profile.id)
  )

  return [
    { label: 'Create profile', completed: true },
    { label: 'Start or join tournament', completed: inTournament || hasPlayedMatch },
    { label: 'Add availability', completed: hasAvailability },
    { label: 'Play your first match', completed: hasPlayedMatch },
  ]
}

function getInviteLink(county: string): string {
  const url = new URL(window.location.href)
  url.search = ''
  url.searchParams.set('join', county)
  return url.toString()
}

function handleInvite(county: string) {
  const link = getInviteLink(county)
  const message = `Join the Rally tennis tournament in ${county}. Let's start competing.\n${link}`
  if (navigator.share) {
    navigator.share({ title: 'Rally Tennis', text: message, url: link }).catch(() => {
      window.open(`sms:?body=${encodeURIComponent(message)}`, '_self')
    })
  } else {
    window.open(`sms:?body=${encodeURIComponent(message)}`, '_self')
  }
}

type ActionType = 'score' | 'respond' | 'schedule' | 'escalated'

interface ActionCard {
  type: ActionType
  label: string
  detail: string
  opponentName: string
  tournamentId: string
  matchId: string
  priority: number
}

function isPlayerInTournament(tournament: Tournament, playerId: string): boolean {
  return tournament.players.some(p => p.id === playerId)
}

function isMyMatch(match: Match, playerId: string): boolean {
  return match.player1Id === playerId || match.player2Id === playerId
}

function getOpponentId(match: Match, playerId: string): string | null {
  if (match.player1Id === playerId) return match.player2Id
  if (match.player2Id === playerId) return match.player1Id
  return null
}

function playerNameWithSeed(tournament: Tournament, playerId: string | null): string {
  const name = getPlayerName(tournament, playerId)
  const seed = getPlayerSeed(tournament, playerId)
  return seed != null ? `${name} (${seed})` : name
}

function buildActionCards(
  tournaments: Tournament[],
  playerId: string
): ActionCard[] {
  const cards: ActionCard[] = []

  for (const tournament of tournaments) {
    for (const match of tournament.matches) {
      if (match.completed) continue
      if (!isMyMatch(match, playerId)) continue
      if (!match.player1Id || !match.player2Id) continue

      const opponentId = getOpponentId(match, playerId)
      const opponentName = playerNameWithSeed(tournament, opponentId)
      const schedule = match.schedule

      // Escalated matches
      if (schedule?.status === 'escalated') {
        cards.push({
          type: 'escalated',
          label: 'Urgent',
          detail: `Escalation day ${schedule.escalationDay} — respond now`,
          opponentName,
          tournamentId: tournament.id,
          matchId: match.id,
          priority: 0,
        })
        continue
      }

      // Matches needing scoring: confirmed + not completed + is my match
      if (schedule?.status === 'confirmed' && schedule.confirmedSlot) {
        cards.push({
          type: 'score',
          label: 'Score Match',
          detail: 'Match confirmed — enter result',
          opponentName,
          tournamentId: tournament.id,
          matchId: match.id,
          priority: 1,
        })
        continue
      }

      // Matches with pending proposals from opponent (not from me)
      if (schedule?.status === 'proposed') {
        const pendingFromOpponent = schedule.proposals.filter(
          p => p.status === 'pending' && p.proposedBy !== playerId && p.proposedBy !== 'system'
        )
        // Also count system proposals as needing a response
        const pendingSystem = schedule.proposals.filter(
          p => p.status === 'pending' && p.proposedBy === 'system'
        )
        const respondableCount = pendingFromOpponent.length + pendingSystem.length

        if (respondableCount > 0) {
          cards.push({
            type: 'respond',
            label: 'Respond',
            detail: `${respondableCount} time slot${respondableCount === 1 ? '' : 's'} proposed`,
            opponentName,
            tournamentId: tournament.id,
            matchId: match.id,
            priority: 2,
          })
          continue
        }
      }

      // Unscheduled matches or proposed with no acceptable proposals
      if (
        !schedule ||
        schedule.status === 'unscheduled' ||
        (schedule.status === 'proposed' &&
          schedule.proposals.every(p => p.status === 'rejected' || p.proposedBy === playerId))
      ) {
        cards.push({
          type: 'schedule',
          label: 'Schedule',
          detail: 'Find a time to play',
          opponentName,
          tournamentId: tournament.id,
          matchId: match.id,
          priority: 3,
        })
        continue
      }
    }
  }

  cards.sort((a, b) => a.priority - b.priority)
  return cards
}

function getProgressText(tournament: Tournament): string {
  if (tournament.format === 'single-elimination') {
    const totalRounds = Math.max(...tournament.matches.map(m => m.round), 1)
    const completedRounds = tournament.matches.reduce((max, m) => {
      if (!m.completed) return max
      return Math.max(max, m.round)
    }, 0)
    const incompleteMatches = tournament.matches.filter(m => !m.completed && m.player1Id && m.player2Id)
    const currentRound = incompleteMatches.length > 0
      ? Math.min(...incompleteMatches.map(m => m.round))
      : completedRounds
    return `Round ${currentRound} of ${totalRounds}`
  }

  if (tournament.format === 'group-knockout') {
    const groupMatches = tournament.matches.filter(m => m.phase === 'group')
    const groupDone = groupMatches.filter(m => m.completed).length
    if (!tournament.groupPhaseComplete) {
      return `Group stage: ${groupDone} of ${groupMatches.length} matches`
    }
    const knockoutMatches = tournament.matches.filter(m => m.phase === 'knockout')
    const knockoutDone = knockoutMatches.filter(m => m.completed).length
    if (knockoutDone === 0) return 'Semifinals'
    if (knockoutDone < knockoutMatches.length) return 'Final'
    return 'Completed'
  }

  const completed = tournament.matches.filter(m => m.completed).length
  const total = tournament.matches.length
  return `${completed} of ${total} matches played`
}

function getUpNextMatch(
  tournaments: Tournament[],
  playerId: string
): { tournament: Tournament; match: Match } | null {
  for (const tournament of tournaments) {
    for (const match of tournament.matches) {
      if (
        !match.completed &&
        isMyMatch(match, playerId) &&
        match.schedule?.status === 'confirmed' &&
        match.schedule.confirmedSlot
      ) {
        return { tournament, match }
      }
    }
  }
  return null
}

// --- Inline Score Entry ---

function isValidSet(s1: number, s2: number): boolean {
  if (s1 === 6 && s2 <= 4) return true
  if (s2 === 6 && s1 <= 4) return true
  if (s1 === 7 && s2 === 5) return true
  if (s2 === 7 && s1 === 5) return true
  if (s1 === 7 && s2 === 6) return true
  if (s2 === 7 && s1 === 6) return true
  return false
}

function InlineScoreEntry({ tournament, matchId, onSaved }: {
  tournament: Tournament
  matchId: string
  onSaved: () => void
}) {
  const match = tournament.matches.find(m => m.id === matchId)!
  const p1Name = getPlayerName(tournament, match.player1Id)
  const p2Name = getPlayerName(tournament, match.player2Id)
  const seeds = getSeeds(tournament)
  const seed1 = match.player1Id ? seeds.get(match.player1Id) : null
  const seed2 = match.player2Id ? seeds.get(match.player2Id) : null

  const r1 = getPlayerRating(match.player1Id!, p1Name)
  const r2 = getPlayerRating(match.player2Id!, p2Name)
  const p1WinProb = winProbability(r1.rating, r2.rating)

  const [sets, setSets] = useState<Array<[string, string]>>([['', ''], ['', ''], ['', '']])
  // Refs for auto-advance: order is p1-set0, p2-set0, p1-set1, p2-set1, p1-set2, p2-set2
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  function getScores(): { score1: number[]; score2: number[] } | null {
    const score1: number[] = []
    const score2: number[] = []
    for (const [s1, s2] of sets) {
      if (s1 === '' && s2 === '') continue
      const n1 = parseInt(s1, 10)
      const n2 = parseInt(s2, 10)
      if (isNaN(n1) || isNaN(n2) || n1 < 0 || n2 < 0) return null
      if (!isValidSet(n1, n2)) return null
      score1.push(n1)
      score2.push(n2)
    }
    return score1.length > 0 ? { score1, score2 } : null
  }

  function determineWinner(score1: number[], score2: number[]): string | null {
    let sets1 = 0
    let sets2 = 0
    for (let i = 0; i < score1.length; i++) {
      if (score1[i] > score2[i]) sets1++
      else if (score2[i] > score1[i]) sets2++
    }
    if (sets1 >= 2) return match.player1Id
    if (sets2 >= 2) return match.player2Id
    return null
  }

  function updateSet(setIndex: number, playerIndex: 0 | 1, value: string) {
    const updated = [...sets] as Array<[string, string]>
    updated[setIndex] = [...updated[setIndex]] as [string, string]
    updated[setIndex][playerIndex] = value
    setSets(updated)

    // Auto-advance: if a digit was entered, jump to the next input
    // Order: p1-set0(0), p2-set0(1), p1-set1(2), p2-set1(3), p1-set2(4), p2-set2(5)
    if (value.length === 1) {
      const currentIdx = setIndex * 2 + playerIndex
      const nextRef = inputRefs.current[currentIdx + 1]
      if (nextRef) {
        nextRef.focus()
        nextRef.select()
      }
    }
  }

  function setValidation(setIndex: number): string | null {
    const [s1, s2] = sets[setIndex]
    if (s1 === '' && s2 === '') return null
    if (s1 === '' || s2 === '') return 'Enter both scores'
    const n1 = parseInt(s1, 10)
    const n2 = parseInt(s2, 10)
    if (isNaN(n1) || isNaN(n2)) return 'Invalid number'
    if (!isValidSet(n1, n2)) return 'Invalid score (e.g. 6-4, 7-5, 7-6)'
    return null
  }

  const scores = getScores()
  const winnerId = scores ? determineWinner(scores.score1, scores.score2) : null
  const canSave = scores && winnerId

  const showThirdSet = (() => {
    const s1a = parseInt(sets[0][0], 10)
    const s1b = parseInt(sets[0][1], 10)
    const s2a = parseInt(sets[1][0], 10)
    const s2b = parseInt(sets[1][1], 10)
    if (isNaN(s1a) || isNaN(s1b) || isNaN(s2a) || isNaN(s2b)) return false
    if (!isValidSet(s1a, s1b) || !isValidSet(s2a, s2b)) return false
    return (s1a > s1b ? 1 : 2) !== (s2a > s2b ? 1 : 2)
  })()

  const visibleSets = showThirdSet ? 3 : 2

  function handleSave() {
    if (!scores || !winnerId) return
    saveMatchScore(tournament.id, matchId, scores.score1, scores.score2, winnerId)
    onSaved()
  }

  return (
    <div className="inline-score-entry">
      <div className="prob-split">
        <span className="prob-split-label prob-split-p1">{Math.round(p1WinProb * 100)}%</span>
        <div className="prob-split-bar">
          <div className="prob-split-fill-left" style={{ width: `${Math.round(p1WinProb * 100)}%` }} />
          <div className="prob-split-fill-right" style={{ width: `${Math.round((1 - p1WinProb) * 100)}%` }} />
        </div>
        <span className="prob-split-label prob-split-p2">{Math.round((1 - p1WinProb) * 100)}%</span>
      </div>

      <div className="score-grid" style={{ gridTemplateColumns: `1fr repeat(${visibleSets}, 60px)` }}>
        <div className="score-header"></div>
        {sets.slice(0, visibleSets).map((_, i) => (
          <div key={i} className="score-header">Set {i + 1}</div>
        ))}

        <div className="score-player-name">{p1Name}{seed1 != null && <span className="seed-label"> ({seed1})</span>}</div>
        {sets.slice(0, visibleSets).map((set, i) => (
          <input
            key={`p1-${i}`}
            ref={el => { inputRefs.current[i * 2] = el }}
            type="number"
            min="0"
            max="7"
            className={`score-input ${setValidation(i) ? 'score-invalid' : ''}`}
            value={set[0]}
            onChange={e => updateSet(i, 0, e.target.value)}
            inputMode="numeric"
          />
        ))}

        <div className="score-player-name">{p2Name}{seed2 != null && <span className="seed-label"> ({seed2})</span>}</div>
        {sets.slice(0, visibleSets).map((set, i) => (
          <input
            key={`p2-${i}`}
            ref={el => { inputRefs.current[i * 2 + 1] = el }}
            type="number"
            min="0"
            max="7"
            className={`score-input ${setValidation(i) ? 'score-invalid' : ''}`}
            value={set[1]}
            onChange={e => updateSet(i, 1, e.target.value)}
            inputMode="numeric"
          />
        ))}
      </div>

      {sets.slice(0, visibleSets).map((_, i) => {
        const err = setValidation(i)
        return err ? <div key={i} className="score-error">Set {i + 1}: {err}</div> : null
      })}

      {winnerId && (
        <div className="winner-preview">
          Winner: <strong>{getPlayerName(tournament, winnerId)}{winnerId && seeds.get(winnerId) != null && <span className="seed-label"> ({seeds.get(winnerId)})</span>}</strong>
        </div>
      )}

      <button className="btn btn-primary" onClick={handleSave} disabled={!canSave} style={{ width: '100%', marginTop: '0.5rem' }}>
        Save Score
      </button>
    </div>
  )
}

export default function Home({
  profile,
  tournaments,
  autoJoin,
  onAutoJoinConsumed,
  onTournamentCreated,
  onViewTournament,
  onViewMatch,
  onViewLeaderboard,
  onViewOffers,
  onDataChanged,
}: Props) {
  const [expandedCardKey, setExpandedCardKey] = useState<string | null>(null)

  const activeTournaments = useMemo(
    () => tournaments.filter(
      t => t.status === 'in-progress' && isPlayerInTournament(t, profile.id)
    ),
    [tournaments, profile.id]
  )

  const setupTournaments = useMemo(
    () => tournaments.filter(
      t => t.status === 'setup' && isPlayerInTournament(t, profile.id)
    ),
    [tournaments, profile.id]
  )

  const actionCards = useMemo(
    () => buildActionCards(activeTournaments, profile.id),
    [activeTournaments, profile.id]
  )

  const upNext = useMemo(
    () => getUpNextMatch(activeTournaments, profile.id),
    [activeTournaments, profile.id]
  )

  // Onboarding state
  const hasAvailability = getAvailability(profile.id).length > 0
  const hasPlayedMatch = tournaments.some(t =>
    t.matches.some(m =>
      m.completed &&
      (m.player1Id === profile.id || m.player2Id === profile.id)
    )
  )
  const activationSteps = getActivationSteps(profile, tournaments, hasAvailability, hasPlayedMatch)
  const showOnboarding = !activationSteps.every(s => s.completed)

  // Leaderboard teaser
  const leaderboard = useMemo(() => getCountyLeaderboard(profile.county), [profile.county, tournaments])
  const topPlayers = leaderboard.slice(0, 3)

  // Player's own leaderboard entry (for personalized leaderboard)
  const myLeaderboardEntry = leaderboard.find(
    e => e.name.toLowerCase() === profile.name.toLowerCase()
  )
  const myRating = getPlayerRating(profile.id, profile.name)

  const recentResults = useMemo(() => getRecentResults(profile.county, 5), [profile.county, tournaments])

  // No active or setup tournament: show lobby + status + leaderboard
  if (activeTournaments.length === 0 && setupTournaments.length === 0) {
    return (
      <div className="home-section home-section-spaced">
        <Lobby profile={profile} autoJoin={autoJoin} onAutoJoinConsumed={onAutoJoinConsumed} onTournamentCreated={onTournamentCreated} />

        {/* User Status Block */}
        <div className="card user-status-card">
          <div className="user-status-row">
            <div className="user-status-info">
              <div className="user-status-headline">Not in a tournament</div>
              <div className="user-status-sub">Join the lobby above to start competing</div>
            </div>
            <div className="user-status-rating">
              <span className="user-status-rating-value">{Math.round(myRating.rating)}</span>
              <span className="user-status-rating-label">Elo</span>
            </div>
          </div>
        </div>

        {/* Leaderboard Block */}
        {topPlayers.length > 1 && (
          <div className="card leaderboard-teaser" onClick={onViewLeaderboard}>
            <h3 className="leaderboard-teaser-title">Top Players in {profile.county}</h3>
            {topPlayers.map(entry => (
              <div key={entry.name} className={`leaderboard-teaser-row ${entry.name.toLowerCase() === profile.name.toLowerCase() ? 'is-me' : ''}`}>
                <span className="leaderboard-rank">#{entry.rank}</span>
                <span className="leaderboard-name">{entry.name}{entry.name.toLowerCase() === profile.name.toLowerCase() ? ' (You)' : ''}</span>
                <span className="leaderboard-rating">{Math.round(entry.rating)}</span>
              </div>
            ))}
            {/* Show user's own rank if not in top 3 */}
            {myLeaderboardEntry && !topPlayers.some(e => e.name.toLowerCase() === profile.name.toLowerCase()) && (
              <>
                <div className="leaderboard-teaser-divider" />
                <div className="leaderboard-teaser-row is-me">
                  <span className="leaderboard-rank">#{myLeaderboardEntry.rank}</span>
                  <span className="leaderboard-name">You</span>
                  <span className="leaderboard-rating">{Math.round(myLeaderboardEntry.rating)}</span>
                </div>
              </>
            )}
            {!myLeaderboardEntry && (
              <>
                <div className="leaderboard-teaser-divider" />
                <div className="leaderboard-teaser-row is-me">
                  <span className="leaderboard-rank">—</span>
                  <span className="leaderboard-name">You</span>
                  <span className="leaderboard-rating">{Math.round(myRating.rating)}</span>
                </div>
              </>
            )}
            <button className="btn-link leaderboard-see-all">See full leaderboard</button>
          </div>
        )}

        {/* Recent Activity Feed */}
        {recentResults.length > 0 && (
          <div className="card recent-activity">
            <div className="card-eyebrow" style={{ color: 'var(--color-text-secondary)' }}>Recent Matches</div>
            <div className="recent-results-list">
              {recentResults.map(result => (
                <div key={result.matchId} className="recent-result-item" onClick={() => onViewTournament(result.tournamentId)}>
                  <div className="recent-result-players">
                    <span className={`recent-result-name ${result.winnerId === profile.id ? 'is-me' : ''}`}>{result.winnerName}</span>
                    <span className="recent-result-def">def.</span>
                    <span className={`recent-result-name ${result.loserId === profile.id ? 'is-me' : ''}`}>{result.loserName}</span>
                  </div>
                  <div className="recent-result-score">{result.score}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Setup tournament: show lobby + status + leaderboard
  if (activeTournaments.length === 0 && setupTournaments.length > 0) {
    return (
      <div className="home-section home-section-spaced">
        <Lobby profile={profile} autoJoin={autoJoin} onAutoJoinConsumed={onAutoJoinConsumed} onTournamentCreated={onTournamentCreated} />

        {/* User Status Block */}
        <div className="card user-status-card">
          <div className="user-status-row">
            <div className="user-status-info">
              <div className="user-status-headline">Tournament forming</div>
              <div className="user-status-sub">Waiting for more players to join</div>
            </div>
            <div className="user-status-rating">
              <span className="user-status-rating-value">{Math.round(myRating.rating)}</span>
              <span className="user-status-rating-label">Elo</span>
            </div>
          </div>
        </div>

        {/* Leaderboard Block */}
        {topPlayers.length > 1 && (
          <div className="card leaderboard-teaser" onClick={onViewLeaderboard}>
            <h3 className="leaderboard-teaser-title">Top Players in {profile.county}</h3>
            {topPlayers.map(entry => (
              <div key={entry.name} className={`leaderboard-teaser-row ${entry.name.toLowerCase() === profile.name.toLowerCase() ? 'is-me' : ''}`}>
                <span className="leaderboard-rank">#{entry.rank}</span>
                <span className="leaderboard-name">{entry.name}{entry.name.toLowerCase() === profile.name.toLowerCase() ? ' (You)' : ''}</span>
                <span className="leaderboard-rating">{Math.round(entry.rating)}</span>
              </div>
            ))}
            {myLeaderboardEntry && !topPlayers.some(e => e.name.toLowerCase() === profile.name.toLowerCase()) && (
              <>
                <div className="leaderboard-teaser-divider" />
                <div className="leaderboard-teaser-row is-me">
                  <span className="leaderboard-rank">#{myLeaderboardEntry.rank}</span>
                  <span className="leaderboard-name">You</span>
                  <span className="leaderboard-rating">{Math.round(myLeaderboardEntry.rating)}</span>
                </div>
              </>
            )}
            <button className="btn-link leaderboard-see-all">See full leaderboard</button>
          </div>
        )}
      </div>
    )
  }

  // Active tournament dashboard
  return (
    <div className="home-section">
      {/* Onboarding (shows until all steps complete) */}
      {showOnboarding && (
        <div className="card onboarding-card">
          <h3 className="onboarding-title">Welcome to Rally</h3>
          <p className="onboarding-subtitle">Your next steps</p>
          <div className="onboarding-steps">
            {activationSteps.map((step, i) => (
              <div key={i} className={`onboarding-step ${step.completed ? 'completed' : ''}`}>
                <span className="onboarding-step-icon">
                  {step.completed ? (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="8" fill="var(--color-positive-primary)" />
                      <path d="M5 8l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="7.5" stroke="var(--color-divider)" />
                    </svg>
                  )}
                </span>
                <span className="onboarding-step-label">{step.label}</span>
              </div>
            ))}
          </div>
          <button className="btn btn-primary onboarding-cta" onClick={() => handleInvite(profile.county)}>Invite Players</button>
        </div>
      )}

      {/* Tournament Summary Card */}
      {activeTournaments.map(tournament => {
        const totalMatches = tournament.matches.filter(m => m.player1Id && m.player2Id).length
        const completedMatches = tournament.matches.filter(m => m.completed).length
        const progressPct = totalMatches > 0 ? Math.round((completedMatches / totalMatches) * 100) : 0
        return (
          <div key={tournament.id} className="card tournament-card" onClick={() => onViewTournament(tournament.id)}>
            <div className="card-eyebrow" style={{ color: 'var(--color-text-secondary)' }}>Tournament</div>
            <div className="card-title">{tournament.name}</div>
            <div className="card-secondary">
              {tournament.format === 'single-elimination' ? 'Knockout' : tournament.format === 'group-knockout' ? 'Group + Knockout' : 'Round Robin'} · {tournament.players.length} players · {getProgressText(tournament)}
            </div>
            <div className="tournament-progress-bar">
              <div className="tournament-progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        )
      })}

      {/* Match Offers (incoming + outgoing) */}
      {(() => {
        const incoming = getIncomingOffers(profile.id)
        const outgoing = getOutgoingOffers(profile.id)
        if (incoming.length === 0 && outgoing.length === 0) return null
        return (
          <div className="action-cards">
            {incoming.map(offer => (
              <div
                key={offer.offerId}
                className="action-card action-respond"
                onClick={onViewOffers}
              >
                <div className="action-card-type">Respond</div>
                <div className="action-card-opponent">{offer.senderName}</div>
                <div className="action-card-detail">{offer.proposedTime} · {offer.proposedDate}</div>
                <button className="action-card-btn" onClick={e => { e.stopPropagation(); onViewOffers?.() }}>View Offer</button>
              </div>
            ))}
            {outgoing.map(offer => (
              <div
                key={offer.offerId}
                className="action-card action-schedule"
                onClick={onViewOffers}
              >
                <div className="action-card-type">Pending</div>
                <div className="action-card-opponent">to {offer.recipientName}</div>
                <div className="action-card-detail">{offer.proposedTime} · Waiting for response</div>
              </div>
            ))}
          </div>
        )
      })()}

      {/* Action Cards */}
      {actionCards.length > 0 ? (
        <div className="action-cards">
          {actionCards.map(card => {
            const cardKey = `${card.tournamentId}-${card.matchId}`
            const isExpanded = expandedCardKey === cardKey
            const cardTournament = activeTournaments.find(t => t.id === card.tournamentId)
            const cardMatch = cardTournament?.matches.find(m => m.id === card.matchId)

            return (
              <div
                key={cardKey}
                className={`action-card action-${card.type}`}
                onClick={() => setExpandedCardKey(isExpanded ? null : cardKey)}
              >
                <div className="action-card-type">{card.label}</div>
                <div className="action-card-opponent">vs {card.opponentName}</div>
                <div className="action-card-detail">{card.detail}</div>
                {!isExpanded && (
                  <button className="action-card-btn" onClick={e => {
                    e.stopPropagation()
                    setExpandedCardKey(cardKey)
                  }}>
                    {card.type === 'score' ? 'Enter Score' : card.type === 'respond' ? 'Pick Time' : card.type === 'escalated' ? 'Respond Now' : 'Schedule Match'}
                  </button>
                )}
                {isExpanded && cardTournament && cardMatch && (
                  <div onClick={e => e.stopPropagation()}>
                    {card.type === 'score' ? (
                      <InlineScoreEntry
                        tournament={cardTournament}
                        matchId={cardMatch.id}
                        onSaved={() => {
                          setExpandedCardKey(null)
                          onDataChanged?.()
                        }}
                      />
                    ) : cardMatch.schedule ? (
                      <MatchSchedulePanel
                        tournament={cardTournament}
                        match={cardMatch}
                        currentPlayerId={profile.id}
                        onUpdated={() => {
                          setExpandedCardKey(null)
                          onDataChanged?.()
                        }}
                      />
                    ) : null}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="card" style={{ cursor: 'default' }}>
          <div className="caught-up">
            <p>You're all caught up</p>
            <p className="caught-up-sub">No matches need your attention right now</p>
          </div>
        </div>
      )}

      {/* Up Next Card */}
      {upNext && upNext.match.schedule?.confirmedSlot && (() => {
        const slot = upNext.match.schedule!.confirmedSlot!
        const day = slot.day.charAt(0).toUpperCase() + slot.day.slice(1, 3)
        const period = slot.startHour >= 12 ? 'pm' : 'am'
        const hour = slot.startHour % 12 || 12
        const upNextKey = `${upNext.tournament.id}-${upNext.match.id}`
        const upNextExpanded = expandedCardKey === upNextKey
        return (
          <div className="card upnext-card" onClick={() => setExpandedCardKey(upNextExpanded ? null : upNextKey)}>
            <div>
              <div className="upnext-label">Confirmed</div>
              <div className="upnext-opponent">
                vs {playerNameWithSeed(upNext.tournament, getOpponentId(upNext.match, profile.id))}
              </div>
            </div>
            <div className="upnext-time">
              <span className="upnext-time-day">{day}</span>
              <span className="upnext-time-hour">{hour}{period}</span>
            </div>
            {upNextExpanded && (
              <div onClick={e => e.stopPropagation()} style={{ gridColumn: '1 / -1' }}>
                <InlineScoreEntry
                  tournament={upNext.tournament}
                  matchId={upNext.match.id}
                  onSaved={() => {
                    setExpandedCardKey(null)
                    onDataChanged?.()
                  }}
                />
              </div>
            )}
          </div>
        )
      })()}

      {/* Leaderboard Teaser */}
      {topPlayers.length > 1 && (
        <div className="card leaderboard-teaser" onClick={onViewLeaderboard}>
          <div className="card-eyebrow" style={{ color: 'var(--color-text-secondary)' }}>Leaderboard</div>
          {topPlayers.map(entry => (
            <div key={entry.name} className={`leaderboard-teaser-row ${entry.name.toLowerCase() === profile.name.toLowerCase() ? 'is-me' : ''}`}>
              <span className="leaderboard-rank">#{entry.rank}</span>
              <span className="leaderboard-name">{entry.name}</span>
              <span className="leaderboard-rating">{Math.round(entry.rating)}</span>
            </div>
          ))}
          <button className="btn-link leaderboard-see-all">See full leaderboard</button>
        </div>
      )}

      {/* View All */}
      <div className="home-view-all">
        <button className="btn-link" onClick={() => onViewTournament(activeTournaments[0].id)}>
          View bracket
        </button>
      </div>
    </div>
  )
}
