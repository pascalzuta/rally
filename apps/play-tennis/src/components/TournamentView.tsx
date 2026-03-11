import { useState, useEffect, useRef } from 'react'
import { getTournament, getPlayerName, getPlayerRating, getSeeds, getGroupStandings, winProbability, getPlayerActiveBroadcast, leaveTournament } from '../store'
import { Tournament, Match } from '../types'
import MatchScoreModal from './MatchScoreModal'
import MatchSchedulePanel from './MatchSchedulePanel'
import Standings from './Standings'
import BroadcastPanel from './BroadcastPanel'

interface Props {
  tournamentId: string
  currentPlayerId: string
  onBack: () => void
}

function formatSlot(slot: { day: string; startHour: number; endHour: number }): string {
  const day = slot.day.charAt(0).toUpperCase() + slot.day.slice(1)
  const fmt = (h: number) => {
    const period = h >= 12 ? 'pm' : 'am'
    const hour = h % 12 || 12
    return `${hour}${period}`
  }
  return `${day} ${fmt(slot.startHour)}–${fmt(slot.endHour)}`
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

export default function TournamentView({ tournamentId, currentPlayerId, onBack }: Props) {
  const [tournament, setTournament] = useState<Tournament | undefined>()
  const [scoringMatchId, setScoringMatchId] = useState<string | null>(null)
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null)
  const [tab, setTab] = useState<'matches' | 'standings'>('matches')
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const broadcastRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setTournament(getTournament(tournamentId))
  }, [tournamentId])

  if (!tournament) return <div className="screen"><p>Tournament not found</p></div>

  function refresh() {
    setTournament(getTournament(tournamentId))
  }

  function handleScoreSaved() {
    setScoringMatchId(null)
    refresh()
  }

  function handleLeave() {
    leaveTournament(tournamentId, currentPlayerId)
    setShowLeaveConfirm(false)
    onBack()
  }

  function handleMatchClick(match: Match, canScore: boolean, isMyMatch: boolean) {
    if (canScore && match.schedule?.status === 'confirmed') {
      setScoringMatchId(match.id)
    } else if (isMyMatch && !match.completed && match.schedule && match.player1Id && match.player2Id) {
      setExpandedMatchId(expandedMatchId === match.id ? null : match.id)
    } else if (canScore) {
      setScoringMatchId(match.id)
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

  // Group-knockout specific
  const groupMatches = tournament.format === 'group-knockout'
    ? tournament.matches.filter(m => m.phase === 'group')
    : []
  const knockoutMatches = tournament.format === 'group-knockout'
    ? tournament.matches.filter(m => m.phase === 'knockout')
    : []
  const groupComplete = tournament.format === 'group-knockout' && tournament.groupPhaseComplete
  const groupStandings = tournament.format === 'group-knockout' ? getGroupStandings(tournament) : []
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

  function renderMatchCard(match: Match, isFinal = false) {
    const p1 = getPlayerName(tournament!, match.player1Id)
    const p2 = getPlayerName(tournament!, match.player2Id)
    const r1 = match.player1Id ? getPlayerRating(match.player1Id, p1) : null
    const r2 = match.player2Id ? getPlayerRating(match.player2Id, p2) : null
    const seed1 = match.player1Id ? seeds.get(match.player1Id) : null
    const seed2 = match.player2Id ? seeds.get(match.player2Id) : null
    const isMyMatch = match.player1Id === currentPlayerId || match.player2Id === currentPlayerId
    const hasSchedule = match.schedule && match.player1Id && match.player2Id
    const isConfirmed = match.schedule?.status === 'confirmed'
    const canScore = match.player1Id && match.player2Id && !match.completed && isMyMatch && (!hasSchedule || isConfirmed)
    const isBye = (!match.player1Id || !match.player2Id) && match.completed
    const isExpanded = expandedMatchId === match.id
    const onWinnerPath = winnerPath.has(match.id)

    // Win probability for unplayed matches with both players
    const showWinProb = !match.completed && match.player1Id && match.player2Id && r1 && r2
    const p1WinProb = (showWinProb && r1 && r2) ? winProbability(r1.rating, r2.rating) : 0.5

    const tapHint = match.completed ? null
      : canScore ? 'Tap to score'
      : (isMyMatch && hasSchedule && !isConfirmed) ? 'Tap to schedule'
      : null

    // Formatted scores
    const formattedScores = match.completed && match.score1.length > 0
      ? formatMatchScores(match.score1, match.score2)
      : null

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
            <div className={`match-player ${match.winnerId === match.player1Id ? 'winner' : ''}`}>
              <span className="match-player-name">
                {p1}{seed1 && <span className="seed-label"> ({seed1})</span>}
              </span>
              {formattedScores && <span className="match-score">{formattedScores.p1}</span>}
              {match.completed && match.resolution?.type === 'walkover' && match.winnerId === match.player1Id && <span className="match-score">W/O</span>}
            </div>
            <div className="match-vs">vs</div>
            <div className={`match-player ${match.winnerId === match.player2Id ? 'winner' : ''}`}>
              <span className="match-player-name">
                {p2}{seed2 && <span className="seed-label"> ({seed2})</span>}
              </span>
              {formattedScores && <span className="match-score">{formattedScores.p2}</span>}
              {match.completed && match.resolution?.type === 'walkover' && match.winnerId === match.player2Id && <span className="match-score">W/O</span>}
            </div>

            {/* Win probability bar for upcoming matches */}
            {showWinProb && (
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
                {match.resolution.type === 'walkover' ? '⊘ Walkover' :
                 match.resolution.type === 'forced-match'
                   ? `⚑ ${match.resolution.forcedSlot ? formatSlot(match.resolution.forcedSlot) : 'Final Match Assigned'}`
                   : '✕ Match Canceled'}
              </div>
            )}

            {/* Inline scheduling status indicator — only actionable text on your matches */}
            {!match.completed && !match.resolution && hasSchedule && (
              <div className={`schedule-indicator ${match.schedule!.status}`}>
                {match.schedule!.status === 'confirmed' && match.schedule!.confirmedSlot
                  ? `✓ ${formatSlot(match.schedule!.confirmedSlot)}`
                  : match.schedule!.status === 'confirmed' ? '✓ Scheduled'
                  : match.schedule!.status === 'escalated' ? '⚠ Escalated'
                  : isMyMatch ? (match.schedule!.status === 'proposed' ? '◷ Pick a time' : '○ Unscheduled')
                  : '◷ Pending'}
              </div>
            )}

            {tapHint && <div className="tap-hint">{tapHint}</div>}

            {/* Expanded scheduling panel */}
            {isExpanded && !match.completed && match.schedule && (
              <MatchSchedulePanel
                tournament={tournament!}
                match={match}
                currentPlayerId={currentPlayerId}
                onUpdated={refresh}
              />
            )}
          </>
        )}
      </div>
    )
  }

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

          <div className="bracket">
            {tournament.format === 'single-elimination' ? (
              rounds.map((round, roundIdx) => {
                const isFinalRound = round === rounds.length
                const roundMatches = tournament.matches.filter(m => m.round === round)
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
                  {groupMatches.map(m => renderMatchCard(m))}
                </div>

                {groupMatches.some(m => m.completed) && (
                  <div className="group-standings-inline">
                    <h3 className="round-label">Standings</h3>
                    <table className="group-standings-table">
                      <thead>
                        <tr>
                          <th>#</th>
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
                      {knockoutMatches.filter(m => m.round === 2).map(m => renderMatchCard(m))}
                    </div>
                    <div className="bracket-connector">
                      <div className="bracket-connector-line" />
                    </div>
                    <div className="round round-final">
                      <h3 className="round-label">Final</h3>
                      {knockoutMatches.filter(m => m.round === 3).map(m => renderMatchCard(m, true))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="round">
                <h3 className="round-label">All Matches</h3>
                {tournament.matches.map(m => renderMatchCard(m))}
              </div>
            )}
          </div>
          </>
        )}

        {tab === 'standings' && (tournament.format === 'round-robin' || tournament.format === 'group-knockout') && (
          <Standings tournament={tournament} />
        )}
      </main>

      {scoringMatchId && (
        <MatchScoreModal
          tournament={tournament}
          matchId={scoringMatchId}
          onClose={() => setScoringMatchId(null)}
          onSaved={handleScoreSaved}
        />
      )}

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
