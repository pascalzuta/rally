import { useState, useEffect, useRef } from 'react'
import { getTournament, getPlayerName, getPlayerRating, getSeeds, getGroupStandings, winProbability, getPlayerActiveBroadcast, leaveTournament, getRescheduleUiState } from '../store'
import { Tournament, Match } from '../types'
import InlineScoreEntry from './InlineScoreEntry'
import MatchSchedulePanel from './MatchSchedulePanel'
import Standings from './Standings'
import BroadcastPanel from './BroadcastPanel'

interface Props {
  tournamentId: string
  currentPlayerId: string
  onBack: () => void
}

const DAY_INDEX: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
}

function resolveNextDate(dayOfWeek: string): Date {
  const today = new Date()
  const target = DAY_INDEX[dayOfWeek] ?? 1
  const current = today.getDay()
  const diff = (target - current + 7) % 7
  const result = new Date(today)
  result.setDate(today.getDate() + diff)
  return result
}

function formatStartTime(slot: { day: string; startHour: number }): { day: string; time: string } {
  const date = resolveNextDate(slot.day)
  const day = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const period = slot.startHour >= 12 ? 'pm' : 'am'
  const hour = slot.startHour % 12 || 12
  return { day, time: `${hour}${period}` }
}

function matchSortPriority(match: Match, currentPlayerId: string): number {
  const isMyMatch = match.player1Id === currentPlayerId || match.player2Id === currentPlayerId
  const rescheduleUiState = getRescheduleUiState(match, currentPlayerId)
  if (match.completed) return 5
  if (!match.player1Id || !match.player2Id) return 4
  const s = match.schedule
  if (isMyMatch && (rescheduleUiState === 'soft_request_received' || rescheduleUiState === 'hard_request_received')) return 0.25
  if (isMyMatch && rescheduleUiState === 'hard_request_sent') return 0.75
  if (isMyMatch && rescheduleUiState === 'soft_request_sent') return 1
  if (isMyMatch && s?.status === 'confirmed') return 0
  if (isMyMatch && s?.status === 'escalated') return 0.5
  if (isMyMatch && s?.status === 'proposed') return 1
  if (isMyMatch && (!s || s.status === 'unscheduled')) return 1.5
  if (s?.status === 'confirmed') return 2
  return 3
}

function getMatchEyebrow(match: Match, isMyMatch: boolean, canScore: boolean, currentPlayerId: string): { label: string } | null {
  const rescheduleUiState = getRescheduleUiState(match, currentPlayerId)
  if (match.completed) return { label: 'Completed' }
  if (match.resolution) {
    if (match.resolution.type === 'walkover') return { label: 'Walkover' }
    if (match.resolution.type === 'double-loss') return { label: 'Canceled' }
    return { label: 'Resolved' }
  }
  if (match.schedule?.activeRescheduleRequest) {
    if (rescheduleUiState === 'soft_request_sent') return { label: 'Reschedule Requested' }
    if (rescheduleUiState === 'soft_request_received') return { label: 'Change Requested' }
    return { label: 'Needs New Time' }
  }
  if (canScore) return { label: 'Report Score' }
  if (!match.schedule) return { label: 'Waiting on players' }
  if (match.schedule.status === 'confirmed') return { label: 'Confirmed' }
  if (match.schedule.status === 'escalated') return { label: 'Escalated' }
  if (match.schedule.status === 'proposed' && isMyMatch) return { label: 'Rally Suggested' }
  if (match.schedule.status === 'unscheduled' && isMyMatch) return { label: 'Schedule' }
  return { label: 'Waiting on players' }
}

function getMatchActionLabel(match: Match, isMyMatch: boolean, canScore: boolean, currentPlayerId: string): string | null {
  if (match.completed) return null
  if (canScore) return 'Enter Score'
  if (!match.schedule) return null
  const request = match.schedule.activeRescheduleRequest
  if (request) {
    if (!isMyMatch) return 'View Time'
    if (request.intent === 'soft') {
      return request.requestedBy === currentPlayerId ? null : 'Respond'
    }
    return 'Find a time'
  }
  if (match.schedule.status === 'confirmed') return isMyMatch ? 'Change Time' : 'View Time'
  if (!isMyMatch) return null
  if (match.schedule.status === 'proposed') return 'Confirm Time'
  if (match.schedule.status === 'escalated') return 'Confirm Time'
  if (match.schedule.status === 'unscheduled') return 'Schedule Match'
  return null
}

function scheduleStatusClass(match: Match): string {
  if (match.resolution) {
    switch (match.resolution.type) {
      case 'walkover': return 'sched-walkover'
      case 'forced-match': return 'sched-forced'
      case 'double-loss': return 'sched-double-loss'
    }
  }
  if (!match.schedule || match.completed) return ''
  switch (match.schedule.status) {
    case 'confirmed': return 'sched-confirmed'
    case 'proposed': return 'sched-proposed'
    case 'escalated': return 'sched-escalated'
    case 'resolved': return 'sched-resolved'
    default: return 'sched-unscheduled'
  }
}

type MatchFilterMode = 'upcoming' | 'completed' | 'all'

export default function TournamentView({ tournamentId, currentPlayerId, onBack }: Props) {
  const [tournament, setTournament] = useState<Tournament | undefined>()
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null)
  const [tab, setTab] = useState<'matches' | 'standings'>('matches')
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [matchFilter, setMatchFilter] = useState<MatchFilterMode>('upcoming')
  const [showDetails, setShowDetails] = useState(() => { try { return localStorage.getItem('rally-show-details') === 'true' } catch { return false } })
  const broadcastRef = useRef<HTMLDivElement>(null)
  // R-05: Track rendered match IDs to prevent duplicates
  const renderedMatchIds = useRef<Set<string>>(new Set())

  useEffect(() => {
    setTournament(getTournament(tournamentId))
  }, [tournamentId])

  if (!tournament) return <div className="screen"><p>Tournament not found</p></div>

  function refresh() {
    setTournament(getTournament(tournamentId))
  }

  async function handleLeave() {
    await leaveTournament(tournamentId, currentPlayerId)
    setShowLeaveConfirm(false)
    onBack()
  }

  function handleMatchClick(match: Match, canScore: boolean, isMyMatch: boolean) {
    const canOpenSchedule = Boolean(
      !match.completed &&
      match.schedule &&
      match.player1Id &&
      match.player2Id &&
      (isMyMatch || (match.schedule.status === 'confirmed' && match.schedule.confirmedSlot))
    )

    if (canScore || canOpenSchedule) {
      setExpandedMatchId(expandedMatchId === match.id ? null : match.id)
    }
  }

  const winner = tournament.status === 'completed' && (tournament.format === 'single-elimination' || tournament.format === 'group-knockout')
    ? tournament.matches[tournament.matches.length - 1]?.winnerId
    : null

  const rounds = tournament.format === 'single-elimination'
    ? [...new Set(tournament.matches.map(m => m.round))].sort((a, b) => a - b)
    : tournament.format === 'group-knockout'
    ? [...new Set(tournament.matches.filter(m => m.phase === 'knockout').map(m => m.round))].sort((a, b) => a - b)
    : [0]

  // Group + knockout phase data (applies to group-knockout AND round-robin)
  const hasGroupPhase = tournament.format === 'group-knockout' || tournament.format === 'round-robin'
  const groupMatches = hasGroupPhase
    ? tournament.matches.filter(m => m.phase === 'group')
    : []
  const knockoutMatches = hasGroupPhase
    ? tournament.matches.filter(m => m.phase === 'knockout')
    : []
  const groupComplete = hasGroupPhase && !!tournament.groupPhaseComplete
  const groupStandings = hasGroupPhase ? getGroupStandings(tournament) : []
  const groupMatchesCompleted = groupMatches.filter(m => m.completed).length
  const groupMatchesTotal = groupMatches.length

  const roundLabel = (round: number, totalRounds: number) => {
    if (round === totalRounds) return 'Final'
    if (round === totalRounds - 1) return 'Semifinal'
    if (round === totalRounds - 2) return 'Quarterfinal'
    return `Round ${round}`
  }

  const seeds = getSeeds(tournament)

  // Round progress: which round is currently active?
  const roundStatus = (round: number) => {
    const roundMatches = tournament.matches.filter(m => m.round === round)
    const allDone = roundMatches.every(m => m.completed)
    const anyStarted = roundMatches.some(m => m.completed || (m.player1Id && m.player2Id))
    if (allDone) return 'completed'
    if (anyStarted) return 'active'
    return 'upcoming'
  }

  // Format score as tennis notation: "6-4  7-5"
  function formatScore(scores: number[]): string {
    return scores.map((s, i) => `${s}`).join(' ')
  }
  function formatMatchScores(score1: number[], score2: number[]): { p1: string; p2: string } {
    return {
      p1: score1.map((s, i) => `${s}-${score2[i]}`).join('  '),
      p2: score2.map((s, i) => `${s}-${score1[i]}`).join('  '),
    }
  }

  // Winner's path: match IDs the winner won
  const winnerPath = new Set<string>()
  if (winner) {
    tournament.matches.forEach(m => {
      if (m.winnerId === winner) winnerPath.add(m.id)
    })
  }

  // R-17: Filter matches based on matchFilter mode
  function filterMatch(m: Match): boolean {
    if (matchFilter === 'upcoming') return !m.completed
    if (matchFilter === 'completed') return m.completed
    return true
  }

  function renderMatchCard(match: Match, isFinal = false) {
    // R-05: Skip if this match was already rendered
    if (renderedMatchIds.current.has(match.id)) return null
    renderedMatchIds.current.add(match.id)

    const p1 = getPlayerName(tournament!, match.player1Id)
    const p2 = getPlayerName(tournament!, match.player2Id)
    const r1 = match.player1Id ? getPlayerRating(match.player1Id, p1) : null
    const r2 = match.player2Id ? getPlayerRating(match.player2Id, p2) : null
    const seed1 = match.player1Id ? seeds.get(match.player1Id) : null
    const seed2 = match.player2Id ? seeds.get(match.player2Id) : null
    const isMyMatch = match.player1Id === currentPlayerId || match.player2Id === currentPlayerId
    const hasSchedule = match.schedule && match.player1Id && match.player2Id
    const isConfirmed = match.schedule?.status === 'confirmed'
    const canScore = Boolean(
      match.player1Id &&
      match.player2Id &&
      !match.completed &&
      isMyMatch &&
      match.schedule?.status === 'confirmed' &&
      match.schedule?.confirmedSlot &&
      !match.schedule?.activeRescheduleRequest
    )
    const isBye = (!match.player1Id || !match.player2Id) && match.completed
    const isExpanded = expandedMatchId === match.id
    const onWinnerPath = winnerPath.has(match.id)

    // Win probability for unplayed matches with both players
    const showWinProb = !match.completed && match.player1Id && match.player2Id && r1 && r2
    const p1WinProb = (showWinProb && r1 && r2) ? winProbability(r1.rating, r2.rating) : 0.5

    // Formatted scores
    const formattedScores = match.completed && match.score1.length > 0
      ? formatMatchScores(match.score1, match.score2)
      : null

    const eyebrow = getMatchEyebrow(match, isMyMatch, !!canScore, currentPlayerId)
    const actionLabel = getMatchActionLabel(match, isMyMatch, !!canScore, currentPlayerId)

    return (
      <div
        key={match.id}
        className={`match-card ${match.completed ? 'completed' : ''} ${canScore ? 'scoreable' : ''} ${isMyMatch && !match.completed ? 'my-match' : ''} ${isFinal ? 'match-card-final' : ''} ${onWinnerPath ? 'winner-path' : ''} ${scheduleStatusClass(match)}`}
        onClick={() => {
          if (isBye) return
          handleMatchClick(match, !!canScore, isMyMatch)
        }}
      >
        {isBye ? (
          <div className="bye-label">BYE</div>
        ) : (
          <>
            {/* Eyebrow label */}
            {eyebrow && <div className="match-card-eyebrow">{eyebrow.label}</div>}

            <div className="match-players-row">
              <div className="match-players-names">
                <div className={`match-player ${match.winnerId === match.player1Id ? 'winner' : ''}`}>
                  <span className="match-player-name">
                    {p1}{showDetails && seed1 && <span className="seed-label"> ({seed1})</span>}
                  </span>
                  {formattedScores && <span className="match-score">{formattedScores.p1}</span>}
                  {match.completed && match.resolution?.type === 'walkover' && match.winnerId === match.player1Id && <span className="match-score">W/O</span>}
                </div>
                <div className="match-vs">vs</div>
                <div className={`match-player ${match.winnerId === match.player2Id ? 'winner' : ''}`}>
                  <span className="match-player-name">
                    {p2}{showDetails && seed2 && <span className="seed-label"> ({seed2})</span>}
                  </span>
                  {formattedScores && <span className="match-score">{formattedScores.p2}</span>}
                  {match.completed && match.resolution?.type === 'walkover' && match.winnerId === match.player2Id && <span className="match-score">W/O</span>}
                </div>
              </div>
              {!match.completed && isConfirmed && match.schedule?.confirmedSlot && (() => {
                const st = formatStartTime(match.schedule!.confirmedSlot!)
                return (
                  <div className="match-time-slot">
                    <span className="match-time-day">{st.day}</span>
                    <span className="match-time-hour">{st.time}</span>
                  </div>
                )
              })()}
            </div>

            {/* Completed match summary */}
            {match.completed && match.winnerId && (
              <div className="match-completed-summary">
                <span className="match-completed-winner">Winner: {getPlayerName(tournament!, match.winnerId)}</span>
                {match.schedule?.confirmedSlot && (
                  <span className="match-completed-date">
                    {formatStartTime(match.schedule.confirmedSlot).day}
                  </span>
                )}
              </div>
            )}

            {/* Win probability bar for upcoming matches — shown only in detailed view */}
            {showDetails && showWinProb && (
              <div className="match-prob-bar">
                <div className="match-prob-fill" style={{ width: `${Math.round(p1WinProb * 100)}%` }} />
                <div className="match-prob-labels">
                  <span>{Math.round(p1WinProb * 100)}%</span>
                  <span>{Math.round((1 - p1WinProb) * 100)}%</span>
                </div>
              </div>
            )}

            {/* Resolution indicator */}
            {match.resolution && (
              <div className={`resolution-indicator resolution-${match.resolution.type}`}>
                {match.resolution.type === 'walkover' ? 'Walkover' :
                 match.resolution.type === 'forced-match' ? 'Final Match Assigned' :
                 'Match Canceled'}
              </div>
            )}

            {/* Action button */}
            {actionLabel && (
              <button
                className="match-card-action-btn"
                onClick={e => {
                  e.stopPropagation()
                  setExpandedMatchId(expandedMatchId === match.id ? null : match.id)
                }}
              >
                {actionLabel}
              </button>
            )}

            {/* Expanded inline scoring or scheduling panel */}
            {isExpanded && !match.completed && (
              <div onClick={e => e.stopPropagation()}>
                {canScore ? (
                  <InlineScoreEntry
                    tournament={tournament!}
                    matchId={match.id}
                    onSaved={() => {
                      setExpandedMatchId(null)
                      refresh()
                    }}
                  />
                ) : match.schedule ? (
                  <MatchSchedulePanel
                    tournament={tournament!}
                    match={match}
                    currentPlayerId={currentPlayerId}
                    onUpdated={refresh}
                  />
                ) : null}
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  // R-05: Clear rendered IDs before each render pass
  renderedMatchIds.current.clear()

  // R-18: Tournament progress calculations
  const totalMatches = tournament.matches.filter(m => m.player1Id && m.player2Id).length
  const completedMatchCount = tournament.matches.filter(m => m.completed).length
  const completionPct = totalMatches > 0 ? Math.round((completedMatchCount / totalMatches) * 100) : 0
  const tournamentStartDate = tournament.createdAt ? new Date(tournament.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null
  const estimatedWeeksRemaining = totalMatches > 0 ? Math.max(1, Math.ceil((totalMatches - completedMatchCount) / 2)) : 0
  const estimatedEndDate = (() => {
    if (completedMatchCount >= totalMatches) return null
    const d = new Date()
    d.setDate(d.getDate() + estimatedWeeksRemaining * 7)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  })()

  return (
    <div className="screen">
      <header className="header">
        <button className="btn-back" onClick={onBack}>← Back</button>
        <div className="header-row">
          <h1>{tournament.name}</h1>
          {tournament.players.some(p => p.id === currentPlayerId) && tournament.status !== 'completed' && (
            <button className="btn-leave" onClick={() => setShowLeaveConfirm(true)}>Leave</button>
          )}
        </div>
      </header>

      <main className="content">
        {winner && (
          <div className="winner-banner">
            <div className="winner-trophy">🏆</div>
            <div className="winner-name">{getPlayerName(tournament, winner)}{seeds.get(winner!) != null && <span className="seed-label"> ({seeds.get(winner!)})</span>}</div>
            <div className="winner-subtitle">Tournament Champion</div>
          </div>
        )}

        {(tournament.format === 'round-robin' || tournament.format === 'group-knockout') && (
          <div className="tab-bar">
            <button className={`tab ${tab === 'matches' ? 'active' : ''}`} onClick={() => setTab('matches')}>Matches</button>
            <button className={`tab ${tab === 'standings' ? 'active' : ''}`} onClick={() => setTab('standings')}>Standings</button>
          </div>
        )}

        {/* Show details toggle (R-27) */}
        {tab === 'matches' && (
          <div className="details-toggle-row">
            <button className="btn-link details-toggle-btn" onClick={(e) => { e.stopPropagation(); const next = !showDetails; setShowDetails(next); try { localStorage.setItem('rally-show-details', String(next)) } catch {} }}>
              {showDetails ? 'Hide Advanced Stats' : 'Show Advanced Stats'}
            </button>
          </div>
        )}

        {/* R-17: Match filter toggle */}
        {tab === 'matches' && (
          <div className="match-filter-toggle">
            {(['upcoming', 'completed', 'all'] as MatchFilterMode[]).map(mode => (
              <button
                key={mode}
                className={`match-filter-btn ${matchFilter === mode ? 'selected' : ''}`}
                onClick={() => setMatchFilter(mode)}
              >
                {mode === 'upcoming' ? 'Upcoming' : mode === 'completed' ? 'Completed' : 'All'}
                {mode === 'completed' && tournament.matches.filter(m => m.completed).length > 0 && (
                  <span className="match-filter-count">{tournament.matches.filter(m => m.completed).length}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {tab === 'matches' && (
          <>
          <div ref={broadcastRef}>
            <BroadcastPanel
              tournament={tournament}
              currentPlayerId={currentPlayerId}
              onMatchConfirmed={refresh}
            />
          </div>
          {/* Round progress stepper */}
          {tournament.format === 'single-elimination' && rounds.length > 1 && (
            <div className="round-progress">
              {rounds.map((round, i) => {
                const status = roundStatus(round)
                return (
                  <div key={round} className="round-progress-item">
                    <div className={`round-progress-dot ${status}`} />
                    <span className={`round-progress-label ${status}`}>
                      {roundLabel(round, rounds.length)}
                    </span>
                    {i < rounds.length - 1 && <div className={`round-progress-line ${status === 'completed' ? 'completed' : ''}`} />}
                  </div>
                )
              })}
            </div>
          )}

          {/* Round-robin / group-knockout progress stepper */}
          {hasGroupPhase && (
            <div className="round-progress">
              <div className="round-progress-item">
                <div className={`round-progress-dot ${groupComplete ? 'completed' : 'active'}`} />
                <span className={`round-progress-label ${groupComplete ? 'completed' : 'active'}`}>
                  Round Robin ({groupMatchesCompleted}/{groupMatchesTotal})
                </span>
                <div className={`round-progress-line ${groupComplete ? 'completed' : ''}`} />
              </div>
              <div className="round-progress-item">
                <div className={`round-progress-dot ${groupComplete ? (knockoutMatches.filter(m => m.round === 2).every(m => m.completed) ? 'completed' : 'active') : 'upcoming'}`} />
                <span className={`round-progress-label ${groupComplete ? 'active' : 'upcoming'}`}>
                  Semifinals
                </span>
                <div className={`round-progress-line ${knockoutMatches.filter(m => m.round === 2).every(m => m.completed) ? 'completed' : ''}`} />
              </div>
              <div className="round-progress-item">
                <div className={`round-progress-dot ${tournament.status === 'completed' ? 'completed' : knockoutMatches.some(m => m.round === 3 && m.player1Id && m.player2Id) ? 'active' : 'upcoming'}`} />
                <span className={`round-progress-label ${knockoutMatches.some(m => m.round === 3 && m.player1Id && m.player2Id) ? 'active' : 'upcoming'}`}>
                  Final
                </span>
              </div>
            </div>
          )}

          <div className="bracket">
            {tournament.format === 'single-elimination' ? (
              rounds.map((round, roundIdx) => {
                const isFinalRound = round === rounds.length
                const roundMatches = tournament.matches
                  .filter(m => m.round === round)
                  .filter(filterMatch)
                  .sort((a, b) => matchSortPriority(a, currentPlayerId) - matchSortPriority(b, currentPlayerId))
                return (
                  <div key={round} className={`round ${isFinalRound ? 'round-final' : ''}`}>
                    <h3 className="round-label">{roundLabel(round, rounds.length)}</h3>
                    {roundMatches.map(m => renderMatchCard(m, isFinalRound))}
                    {roundIdx < rounds.length - 1 && (
                      <div className="bracket-connector">
                        <div className="bracket-connector-line" />
                      </div>
                    )}
                  </div>
                )
              })
            ) : tournament.format === 'group-knockout' ? (
              <>
                <div className="round">
                  <h3 className="round-label">Group Stage</h3>
                  {groupMatches.filter(filterMatch).map(m => renderMatchCard(m))}
                </div>

                {groupMatches.some(m => m.completed) && (
                  <div className="group-standings-inline">
                    <h3 className="round-label">Standings</h3>
                    <table className="group-standings-table">
                      <thead>
                        <tr>
                          <th>Rank</th>
                          <th>Player</th>
                          <th>W</th>
                          <th>L</th>
                          <th>Sets</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupStandings.map((s, i) => {
                          const seed = seeds.get(s.id)
                          const qualifies = i < 4
                          return (
                            <tr key={s.id} className={qualifies ? 'qualifies' : ''}>
                              <td className="rank">{i + 1}</td>
                              <td className="player-cell">{s.name}{seed != null && <span className="seed-label"> ({seed})</span>}</td>
                              <td className="stat-cell">{s.wins}</td>
                              <td className="stat-cell">{s.losses}</td>
                              <td className="stat-cell">{s.setsWon}-{s.setsLost}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    {!groupComplete && <div className="qualification-hint">Top 4 advance to semifinals</div>}
                  </div>
                )}

                {groupComplete && knockoutMatches.length > 0 && (
                  <>
                    <div className="round">
                      <h3 className="round-label">Semifinals</h3>
                      {knockoutMatches.filter(m => m.round === 2).filter(filterMatch).map(m => renderMatchCard(m))}
                    </div>
                    <div className="bracket-connector">
                      <div className="bracket-connector-line" />
                    </div>
                    <div className="round round-final">
                      <h3 className="round-label">Final</h3>
                      {knockoutMatches.filter(m => m.round === 3).filter(filterMatch).map(m => renderMatchCard(m, true))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                <div className="round">
                  <h3 className="round-label">All Matches <span style={{ fontSize: '0.75em', color: 'var(--color-text-secondary)' }}>(Round Robin)</span></h3>
                  {groupMatches.filter(filterMatch).sort((a, b) => matchSortPriority(a, currentPlayerId) - matchSortPriority(b, currentPlayerId)).map(m => renderMatchCard(m))}
                </div>

                {groupMatches.some(m => m.completed) && (
                  <div className="group-standings-inline">
                    <h3 className="round-label">Standings</h3>
                    <table className="group-standings-table">
                      <thead>
                        <tr>
                          <th>Rank</th>
                          <th>Player</th>
                          <th>W</th>
                          <th>L</th>
                          <th>Sets</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupStandings.map((s, i) => {
                          const seed = seeds.get(s.id)
                          const qualifies = i < 4
                          return (
                            <tr key={s.id} className={qualifies ? 'qualifies' : ''}>
                              <td className="rank">{i + 1}</td>
                              <td className="player-cell">{s.name}{seed != null && <span className="seed-label"> ({seed})</span>}</td>
                              <td className="stat-cell">{s.wins}</td>
                              <td className="stat-cell">{s.losses}</td>
                              <td className="stat-cell">{s.setsWon}-{s.setsLost}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    {!groupComplete && <div className="qualification-hint">Top 4 advance to semifinals</div>}
                  </div>
                )}

                {groupComplete && knockoutMatches.length > 0 && (
                  <>
                    <div className="round">
                      <h3 className="round-label">Semifinals</h3>
                      {knockoutMatches.filter(m => m.round === 2).filter(filterMatch).map(m => renderMatchCard(m))}
                    </div>
                    <div className="bracket-connector">
                      <div className="bracket-connector-line" />
                    </div>
                    <div className="round round-final">
                      <h3 className="round-label">Final</h3>
                      {knockoutMatches.filter(m => m.round === 3).filter(filterMatch).map(m => renderMatchCard(m, true))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
          </>
        )}

        {tab === 'standings' && (tournament.format === 'round-robin' || tournament.format === 'group-knockout') && (
          <Standings tournament={tournament} />
        )}
      </main>

      {/* Leave tournament confirmation */}
      {showLeaveConfirm && (
        <div className="leave-overlay" onClick={() => setShowLeaveConfirm(false)}>
          <div className="leave-modal" onClick={e => e.stopPropagation()}>
            <h3 className="leave-title">Leave Tournament?</h3>
            <p className="leave-message">
              {tournament.status === 'in-progress'
                ? 'All your remaining matches will be forfeited and your opponents will receive walkovers. This cannot be undone.'
                : 'You will be removed from this tournament. This cannot be undone.'}
            </p>
            <div className="leave-actions">
              <button className="btn" onClick={() => setShowLeaveConfirm(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleLeave}>Leave Tournament</button>
            </div>
          </div>
        </div>
      )}

      {/* Floating action buttons */}
      {tournament.status === 'in-progress' && (
        <div className="broadcast-fab-group">
          <button
            className="broadcast-fab broadcast-fab-secondary"
            onClick={() => {
              setTab('matches')
              setTimeout(() => {
                broadcastRef.current?.scrollIntoView({ behavior: 'smooth' })
                const btn = broadcastRef.current?.querySelector('.availability-toggle-btn') as HTMLElement
                btn?.click()
              }, 100)
            }}
          >
            Who's Free?
          </button>
          {!getPlayerActiveBroadcast(currentPlayerId) && (
            <button
              className="broadcast-fab"
              onClick={() => {
                setTab('matches')
                setTimeout(() => {
                  broadcastRef.current?.scrollIntoView({ behavior: 'smooth' })
                  const btn = broadcastRef.current?.querySelector('.broadcast-play-now-btn') as HTMLElement
                  btn?.click()
                }, 100)
              }}
            >
              <span>&#9889;</span> Play
            </button>
          )}
        </div>
      )}
    </div>
  )
}
