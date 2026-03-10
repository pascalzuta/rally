import { useState } from 'react'
import { Tournament, Match } from '../types'
import { getPlayerName, getPlayerRating, leaveTournament } from '../store'
import MatchScoreModal from './MatchScoreModal'
import MatchSchedulePanel from './MatchSchedulePanel'
import Standings from './Standings'

interface Props {
  tournament: Tournament | null
  currentPlayerId: string
  onTournamentUpdated: () => void
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

export default function BracketTab({ tournament, currentPlayerId, onTournamentUpdated }: Props) {
  const [scoringMatchId, setScoringMatchId] = useState<string | null>(null)
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null)
  const [tab, setTab] = useState<'matches' | 'standings'>('matches')
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)

  if (!tournament) {
    return (
      <div className="bracket-tab">
        <div className="card">
          <div className="caught-up">
            <p>No active tournament</p>
            <p className="caught-up-sub">Join a tournament from the Home tab to see the bracket</p>
          </div>
        </div>
      </div>
    )
  }

  if (tournament.status === 'setup') {
    return (
      <div className="bracket-tab">
        <div className="bracket-tab-header">
          <h2>{tournament.name}</h2>
          <div className="bracket-tab-meta">Setting up · {tournament.players.length} players</div>
        </div>
        <div className="card">
          <div className="setup-roster-title">Players</div>
          <ul className="player-list">
            {tournament.players.map(p => (
              <li key={p.id}><span className="player-name">{p.name}</span></li>
            ))}
          </ul>
        </div>
      </div>
    )
  }

  function refresh() {
    onTournamentUpdated()
  }

  function handleScoreSaved() {
    setScoringMatchId(null)
    refresh()
  }

  function handleLeave() {
    leaveTournament(tournament!.id, currentPlayerId)
    setShowLeaveConfirm(false)
    refresh()
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

  const winner = tournament.status === 'completed' && tournament.format === 'single-elimination'
    ? tournament.matches[tournament.matches.length - 1]?.winnerId
    : null

  const rounds = tournament.format === 'single-elimination'
    ? [...new Set(tournament.matches.map(m => m.round))].sort((a, b) => a - b)
    : [0]

  const roundLabel = (round: number, totalRounds: number) => {
    if (round === totalRounds) return 'Final'
    if (round === totalRounds - 1) return 'Semifinal'
    if (round === totalRounds - 2) return 'Quarterfinal'
    return `Round ${round}`
  }

  function renderMatchCard(match: Match) {
    const p1 = getPlayerName(tournament!, match.player1Id)
    const p2 = getPlayerName(tournament!, match.player2Id)
    const r1 = match.player1Id ? getPlayerRating(p1) : null
    const r2 = match.player2Id ? getPlayerRating(p2) : null
    const isMyMatch = match.player1Id === currentPlayerId || match.player2Id === currentPlayerId
    const hasSchedule = match.schedule && match.player1Id && match.player2Id
    const isConfirmed = match.schedule?.status === 'confirmed'
    const canScore = match.player1Id && match.player2Id && !match.completed && isMyMatch && (!hasSchedule || isConfirmed)
    const isBye = (!match.player1Id || !match.player2Id) && match.completed
    const isExpanded = expandedMatchId === match.id

    const tapHint = match.completed ? null
      : canScore ? 'Tap to score'
      : (isMyMatch && hasSchedule && !isConfirmed) ? 'Tap to schedule'
      : null

    return (
      <div
        key={match.id}
        className={`match-card ${match.completed ? 'completed' : ''} ${canScore ? 'scoreable' : ''} ${isMyMatch && !match.completed ? 'my-match' : ''} ${scheduleStatusClass(match)}`}
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
              <span>{p1} {r1 && <span className="inline-rating">{Math.round(r1.rating)}</span>}</span>
              {match.completed && match.score1.length > 0 && <span className="match-score">{match.score1.join(' ')}</span>}
              {match.completed && match.resolution?.type === 'walkover' && match.winnerId === match.player1Id && <span className="match-score">W/O</span>}
            </div>
            <div className="match-vs">vs</div>
            <div className={`match-player ${match.winnerId === match.player2Id ? 'winner' : ''}`}>
              <span>{p2} {r2 && <span className="inline-rating">{Math.round(r2.rating)}</span>}</span>
              {match.completed && match.score2.length > 0 && <span className="match-score">{match.score2.join(' ')}</span>}
              {match.completed && match.resolution?.type === 'walkover' && match.winnerId === match.player2Id && <span className="match-score">W/O</span>}
            </div>

            {/* Resolution indicator */}
            {match.resolution && (
              <div className={`resolution-indicator resolution-${match.resolution.type}`}>
                {match.resolution.type === 'walkover' ? '⊘ Walkover' :
                 match.resolution.type === 'forced-match' ? '⚑ Final Match Assigned' :
                 '✕ Match Canceled'}
              </div>
            )}

            {/* Inline scheduling status indicator */}
            {!match.completed && !match.resolution && hasSchedule && (
              <div className={`schedule-indicator ${match.schedule!.status}`}>
                {match.schedule!.status === 'confirmed' ? '✓ Scheduled' :
                 match.schedule!.status === 'escalated' ? '⚠ Escalated' :
                 isMyMatch ? (match.schedule!.status === 'proposed' ? '◷ Pick a time' : '○ Unscheduled') :
                 '◷ Pending'}
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

  const isParticipant = tournament.players.some(p => p.id === currentPlayerId)

  return (
    <div className="bracket-tab">
      <div className="bracket-tab-header">
        <h2>{tournament.name}</h2>
        <div className="bracket-tab-meta">
          {tournament.format === 'single-elimination' ? 'Knockout' : 'Round Robin'} · {tournament.players.length} players
        </div>
      </div>

      {winner && (
        <div className="winner-banner">
          {getPlayerName(tournament, winner)} wins the tournament
        </div>
      )}

      {tournament.format === 'round-robin' && (
        <div className="tab-bar">
          <button className={`tab ${tab === 'matches' ? 'active' : ''}`} onClick={() => setTab('matches')}>Matches</button>
          <button className={`tab ${tab === 'standings' ? 'active' : ''}`} onClick={() => setTab('standings')}>Standings</button>
        </div>
      )}

      {tab === 'matches' && (
        <div className="bracket">
          {tournament.format === 'single-elimination' ? (
            rounds.map(round => (
              <div key={round} className="round">
                <h3 className="round-label">{roundLabel(round, rounds.length)}</h3>
                {tournament.matches.filter(m => m.round === round).map(renderMatchCard)}
              </div>
            ))
          ) : (
            <div className="round">
              <h3 className="round-label">All Matches</h3>
              {tournament.matches.map(renderMatchCard)}
            </div>
          )}
        </div>
      )}

      {tab === 'standings' && tournament.format === 'round-robin' && (
        <Standings tournament={tournament} />
      )}

      {isParticipant && tournament.status !== 'completed' && (
        <div className="bracket-leave-link">
          <button onClick={() => setShowLeaveConfirm(true)}>Leave this tournament</button>
        </div>
      )}

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
    </div>
  )
}
