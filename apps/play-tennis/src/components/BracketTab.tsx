import { useState, useEffect, useRef } from 'react'
import { Tournament, Match, MatchReaction } from '../types'
import { getPlayerName, getPlayerRating, getSeeds, getGroupStandings, winProbability, leaveTournament, getTournament, getPlayerTrophies, hasUnreadFrom, acceptProposal, saveMatchReaction, getMatchReactions } from '../store'
import InlineScoreEntry from './InlineScoreEntry'
import MatchSchedulePanel from './MatchSchedulePanel'
import MessagePanel from './MessagePanel'
import Standings from './Standings'
import ScheduleSummary from './ScheduleSummary'
import MatchCalendar from './MatchCalendar'

type MatchFilterMode = 'upcoming' | 'completed' | 'all'

function PostMatchReactionInline({ matchId, playerId }: { matchId: string; playerId: string }) {
  const existing = getMatchReactions(matchId).find(r => r.playerId === playerId)
  const [fun, setFun] = useState(existing?.fun ?? 0)
  const [fair, setFair] = useState(existing?.fair ?? 0)
  const [playAgain, setPlayAgain] = useState(existing?.playAgain ?? false)
  const [saved, setSaved] = useState(!!existing)

  function handleSave() {
    if (fun === 0 || fair === 0) return
    saveMatchReaction({ matchId, playerId, fun, fair, playAgain, createdAt: new Date().toISOString() })
    setSaved(true)
  }

  if (saved) {
    return (
      <div className="post-match-reaction" onClick={e => e.stopPropagation()}>
        <div className="reaction-thankyou">Thanks for your feedback!</div>
      </div>
    )
  }

  return (
    <div className="post-match-reaction" onClick={e => e.stopPropagation()}>
      <div className="reaction-title">How was this match?</div>
      <div className="reaction-row">
        <span className="reaction-label">Fun</span>
        <div className="reaction-stars">
          {[1, 2, 3, 4, 5].map(n => (
            <span key={n} className={`reaction-star ${n <= fun ? 'reaction-star--active' : ''}`} onClick={() => setFun(n)}>★</span>
          ))}
        </div>
      </div>
      <div className="reaction-row">
        <span className="reaction-label">Fair</span>
        <div className="reaction-stars">
          {[1, 2, 3, 4, 5].map(n => (
            <span key={n} className={`reaction-star ${n <= fair ? 'reaction-star--active' : ''}`} onClick={() => setFair(n)}>★</span>
          ))}
        </div>
      </div>
      <div className="reaction-row">
        <label className="reaction-toggle">
          <input type="checkbox" checked={playAgain} onChange={e => setPlayAgain(e.target.checked)} />
          Play again?
        </label>
      </div>
      <button className="btn btn-primary" onClick={handleSave} disabled={fun === 0 || fair === 0} style={{ width: '100%', marginTop: '8px' }}>
        Submit
      </button>
    </div>
  )
}

interface Props {
  tournament: Tournament | null
  currentPlayerId: string
  currentPlayerName: string
  onTournamentUpdated: () => void
  focusMatchId?: string | null
  onFocusConsumed?: () => void
}

function formatStartTime(slot: { day: string; startHour: number }): { day: string; time: string } {
  const day = slot.day.charAt(0).toUpperCase() + slot.day.slice(1, 3)
  const period = slot.startHour >= 12 ? 'pm' : 'am'
  const hour = slot.startHour % 12 || 12
  return { day, time: `${hour}${period}` }
}

function matchSortPriority(match: Match, currentPlayerId: string): number {
  const isMyMatch = match.player1Id === currentPlayerId || match.player2Id === currentPlayerId
  if (match.completed) return 6
  if (!match.player1Id || !match.player2Id) return 5
  const s = match.schedule
  if (isMyMatch && s?.status === 'escalated') return 0   // urgent — respond now
  if (isMyMatch && s?.status === 'confirmed') return 1    // ready to score
  if (isMyMatch && s?.status === 'proposed') return 2     // respond to proposal
  if (isMyMatch && (!s || s.status === 'unscheduled')) return 2.5 // needs scheduling
  if (s?.status === 'confirmed') return 3 // others' confirmed
  return 4 // others' pending
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

export default function BracketTab({ tournament, currentPlayerId, currentPlayerName, onTournamentUpdated, focusMatchId, onFocusConsumed }: Props) {
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null)
  const [messagingMatchId, setMessagingMatchId] = useState<string | null>(null)
  const [tab, setTab] = useState<'matches' | 'standings'>('matches')
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [showOverflow, setShowOverflow] = useState(false)
  const [advancementPrompt, setAdvancementPrompt] = useState<{ opponentName: string; round: number } | null>(null)
  const [showScheduleSummary, setShowScheduleSummary] = useState(true) // show aha moment first
  const [viewMode, setViewMode] = useState<'calendar' | 'bracket'>('calendar') // default calendar for round-robin
  const [matchFilter, setMatchFilter] = useState<MatchFilterMode>('upcoming') // R-17
  const [highlightedMatchId, setHighlightedMatchId] = useState<string | null>(null) // R-15
  const [showDetails, setShowDetails] = useState<boolean>(() => {
    try { return localStorage.getItem('rally-show-details') === 'true' } catch { return false }
  }) // R-27
  const [showAllMatches, setShowAllMatches] = useState(false) // R-28
  const matchRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const pendingScrollId = useRef<string | null>(null)
  // R-05: Track rendered match IDs to prevent duplicates
  const renderedMatchIds = useRef<Set<string>>(new Set())

  // R-15: Deep-link focus — scroll to match and highlight with pulse effect
  useEffect(() => {
    if (!focusMatchId || !tournament || tournament.status === 'setup') return
    const match = tournament.matches.find(m => m.id === focusMatchId)
    if (!match) { onFocusConsumed?.(); return }

    // Ensure the right filter is active for the target match
    if (match.completed && matchFilter === 'upcoming') {
      setMatchFilter('all')
    }

    setExpandedMatchId(focusMatchId)
    setShowScheduleSummary(false)
    setViewMode('bracket')
    pendingScrollId.current = focusMatchId
    setHighlightedMatchId(focusMatchId)
    onFocusConsumed?.()

    // Remove highlight after 3 seconds
    const timer = setTimeout(() => setHighlightedMatchId(null), 3000)
    return () => clearTimeout(timer)
  }, [focusMatchId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll focused match into view after render
  useEffect(() => {
    if (!pendingScrollId.current) return
    const id = pendingScrollId.current
    pendingScrollId.current = null
    // Small delay to allow the DOM to update (expanded panel, etc.)
    requestAnimationFrame(() => {
      const el = matchRefs.current.get(id)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    })
  })

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

  if (tournament.status === 'setup' || tournament.status === 'scheduling') {
    return (
      <div className="bracket-tab">
        <div className="bracket-tab-header">
          <h2>{tournament.name}</h2>
          <div className="bracket-tab-meta">
            {tournament.status === 'scheduling' ? 'Generating your schedule...' : `Setting up · ${tournament.players.length} players`}
          </div>
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
    setExpandedMatchId(null)
    refresh()
    // Check if player advanced to a new round
    const updated = getTournament(tournament!.id)
    if (updated) {
      const nextMatch = updated.matches.find(m =>
        !m.completed &&
        (m.player1Id === currentPlayerId || m.player2Id === currentPlayerId) &&
        m.player1Id && m.player2Id
      )
      if (nextMatch) {
        const opponentId = nextMatch.player1Id === currentPlayerId ? nextMatch.player2Id : nextMatch.player1Id
        const opponentName = getPlayerName(updated, opponentId)
        setAdvancementPrompt({ opponentName, round: nextMatch.round })
        setTimeout(() => setAdvancementPrompt(null), 4000)
      }
    }
  }

  async function handleLeave() {
    await leaveTournament(tournament!.id, currentPlayerId)
    setShowLeaveConfirm(false)
    refresh()
  }

  function handleMatchClick(match: Match, canScore: boolean, isMyMatch: boolean) {
    if (canScore || (isMyMatch && !match.completed && match.schedule && match.player1Id && match.player2Id)) {
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

  const roundLabel = (round: number, totalRounds: number) => {
    if (round === totalRounds) return 'Final'
    if (round === totalRounds - 1) return 'Semifinal'
    if (round === totalRounds - 2) return 'Quarterfinal'
    return `Round ${round}`
  }

  // Group + knockout phase data (applies to group-knockout AND round-robin)
  const hasGroupPhase = tournament.format === 'group-knockout' || tournament.format === 'round-robin'
  const groupMatches = hasGroupPhase
    ? tournament.matches.filter(m => m.phase === 'group').sort((a, b) => matchSortPriority(a, currentPlayerId) - matchSortPriority(b, currentPlayerId))
    : []
  const knockoutMatches = hasGroupPhase
    ? tournament.matches.filter(m => m.phase === 'knockout')
    : []
  const groupComplete = hasGroupPhase && !!tournament.groupPhaseComplete
  const groupStandings = hasGroupPhase ? getGroupStandings(tournament) : []
  const groupMatchesCompleted = groupMatches.filter(m => m.completed).length
  const groupMatchesTotal = groupMatches.length

  const seeds = getSeeds(tournament)

  // Round progress
  const roundStatus = (round: number) => {
    const roundMatches = tournament.matches.filter(m => m.round === round)
    const allDone = roundMatches.every(m => m.completed)
    const anyStarted = roundMatches.some(m => m.completed || (m.player1Id && m.player2Id))
    if (allDone) return 'completed'
    if (anyStarted) return 'active'
    return 'upcoming'
  }

  // Check if match has displayable scores
  function hasScores(match: Match): boolean {
    return match.completed && match.score1.length > 0
  }

  // Winner's path
  const winnerPath = new Set<string>()
  if (winner) {
    tournament.matches.forEach(m => {
      if (m.winnerId === winner) winnerPath.add(m.id)
    })
  }

  function getMatchEyebrow(match: Match, isMyMatch: boolean, canScore: boolean): { label: string; type: string } | null {
    if (match.completed) return null
    if (match.resolution) {
      if (match.resolution.type === 'walkover') return { label: 'Walkover', type: 'muted' }
      if (match.resolution.type === 'double-loss') return { label: 'Canceled', type: 'muted' }
      return { label: 'Resolved', type: 'muted' }
    }
    if (canScore) return { label: 'Score Match', type: 'score' }
    if (!match.schedule) return { label: 'Pending', type: 'pending' }
    if (match.schedule.status === 'confirmed') return { label: 'Confirmed', type: 'confirmed' }
    if (match.schedule.status === 'escalated') return { label: 'Escalated', type: 'escalated' }
    if (match.schedule.status === 'proposed' && isMyMatch) return { label: 'Pick a time', type: 'proposed' }
    if (match.schedule.status === 'unscheduled' && isMyMatch) return { label: 'Find a time', type: 'unscheduled' }
    return { label: 'Pending', type: 'pending' }
  }

  function getMatchActionLabel(match: Match, isMyMatch: boolean, canScore: boolean): string | null {
    if (match.completed) return null
    if (canScore) return 'Enter Score'
    if (!isMyMatch) return null
    if (!match.schedule) return null
    if (match.schedule.status === 'proposed') return 'Choose a time'
    if (match.schedule.status === 'escalated') return 'Respond Now'
    if (match.schedule.status === 'unscheduled') return 'Find a time'
    return null
  }

  // R-17: Filter matches based on matchFilter mode
  function filterMatch(m: Match): boolean {
    if (matchFilter === 'upcoming') return !m.completed
    if (matchFilter === 'completed') return m.completed
    return true // 'all'
  }

  function renderMatchCard(match: Match, isFinal = false) {
    // R-05: Skip if this match was already rendered (prevents duplicates)
    if (renderedMatchIds.current.has(match.id)) return null
    renderedMatchIds.current.add(match.id)

    const p1Raw = getPlayerName(tournament!, match.player1Id)
    const p2Raw = getPlayerName(tournament!, match.player2Id)
    // R-24: Show team names in doubles mode
    const doublesTeam1 = tournament!.mode === 'doubles' && match.player1Id ? tournament!.teams?.find(t => t.player1Id === match.player1Id || t.player2Id === match.player1Id) : null
    const doublesTeam2 = tournament!.mode === 'doubles' && match.player2Id ? tournament!.teams?.find(t => t.player1Id === match.player2Id || t.player2Id === match.player2Id) : null
    const p1 = doublesTeam1?.teamName ?? p1Raw
    const p2 = doublesTeam2?.teamName ?? p2Raw
    const r1 = match.player1Id ? getPlayerRating(match.player1Id, p1) : null
    const r2 = match.player2Id ? getPlayerRating(match.player2Id, p2) : null
    const seed1 = match.player1Id ? seeds.get(match.player1Id) : null
    const seed2 = match.player2Id ? seeds.get(match.player2Id) : null
    const isMyMatch = match.player1Id === currentPlayerId || match.player2Id === currentPlayerId
    const hasSchedule = match.schedule && match.player1Id && match.player2Id
    const isConfirmed = match.schedule?.status === 'confirmed'
    const canScore = match.player1Id && match.player2Id && !match.completed && isMyMatch
    const isBye = (!match.player1Id || !match.player2Id) && match.completed
    const isExpanded = expandedMatchId === match.id
    const onWinnerPath = winnerPath.has(match.id)

    // Win probability for unplayed matches with both players
    const showWinProb = !match.completed && match.player1Id && match.player2Id && r1 && r2
    const p1WinProb = (showWinProb && r1 && r2) ? winProbability(r1.rating, r2.rating) : 0.5

    const scored = hasScores(match)
    const eyebrow = getMatchEyebrow(match, isMyMatch, !!canScore)
    const actionLabel = getMatchActionLabel(match, isMyMatch, !!canScore)

    if (isBye) {
      const byePlayer = match.player1Id ? p1 : p2
      const byePlayerId = match.player1Id || match.player2Id
      const byeSeed = byePlayerId ? seeds.get(byePlayerId) : null
      return (
        <div key={match.id} className="match-card-bye">
          <span className="bye-player">{byePlayer}{byeSeed != null && <span className="seed-label"> ({byeSeed})</span>}</span>
          <span className="bye-tag">BYE</span>
        </div>
      )
    }

    return (
      <div
        key={match.id}
        ref={el => { if (el) matchRefs.current.set(match.id, el); else matchRefs.current.delete(match.id) }}
        className={`match-card ${match.completed ? 'completed' : ''} ${canScore ? 'scoreable' : ''} ${isMyMatch && !match.completed ? 'my-match' : ''} ${isFinal ? 'match-card-final' : ''} ${onWinnerPath ? 'winner-path' : ''} ${scheduleStatusClass(match)} ${highlightedMatchId === match.id ? 'match-card-highlighted' : ''}`}
        onClick={() => handleMatchClick(match, !!canScore, isMyMatch)}
      >
        <>
          {/* Eyebrow label with scheduling tier badge */}
          <div className="match-card-eyebrow-row">
            {eyebrow && <div className="match-card-eyebrow">{eyebrow.label}</div>}
            {!match.completed && match.schedule?.schedulingTier && (
              <span className={`scheduling-badge scheduling-badge--${match.schedule.schedulingTier === 'auto' ? 'auto' : match.schedule.schedulingTier === 'needs-accept' ? 'accept' : 'negotiate'}`}>
                <span className="scheduling-badge-icon">
                  {match.schedule.schedulingTier === 'auto' ? '✓' : match.schedule.schedulingTier === 'needs-accept' ? '●' : '○'}
                </span>
                {match.schedule.schedulingTier === 'auto' ? 'Confirmed' : match.schedule.schedulingTier === 'needs-accept' ? 'Awaiting confirmation' : 'Pick a time'}
              </span>
            )}
          </div>

          <div className="match-players-row">
            <div className="match-players-names">
              <div className={`match-player ${match.winnerId === match.player1Id ? 'winner' : ''}`}>
                {showDetails && showWinProb && <div className="prob-indicator prob-indicator-p1" />}
                <span className="match-player-name">
                  {p1}{showDetails && seed1 != null && <span className="seed-label"> ({seed1})</span>}
                </span>
                {scored && (
                  <span className="match-sets">
                    {match.score1.map((s, i) => (
                      <span key={i} className={`set-score ${s > match.score2[i] ? 'set-won' : ''}`}>{s}</span>
                    ))}
                  </span>
                )}
                {match.completed && match.resolution?.type === 'walkover' && match.winnerId === match.player1Id && <span className="match-score">W/O</span>}
              </div>
              <div className={`match-player ${match.winnerId === match.player2Id ? 'winner' : ''}`}>
                {showDetails && showWinProb && <div className="prob-indicator prob-indicator-p2" />}
                <span className="match-player-name">
                  {p2}{showDetails && seed2 != null && <span className="seed-label"> ({seed2})</span>}
                </span>
                {scored && (
                  <span className="match-sets">
                    {match.score2.map((s, i) => (
                      <span key={i} className={`set-score ${s > match.score1[i] ? 'set-won' : ''}`}>{s}</span>
                    ))}
                  </span>
                )}
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

            {/* Win probability split bar */}
            {showDetails && showWinProb && (
              <div className="prob-split">
                <span className="prob-split-label prob-split-p1">{Math.round(p1WinProb * 100)}%</span>
                <div className="prob-split-bar">
                  <div className="prob-split-fill-left" style={{ width: `${Math.round(p1WinProb * 100)}%` }} />
                  <div className="prob-split-fill-right" style={{ width: `${Math.round((1 - p1WinProb) * 100)}%` }} />
                </div>
                <span className="prob-split-label prob-split-p2">{Math.round((1 - p1WinProb) * 100)}%</span>
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

            {/* R-17: Completed match details — show date and winner for completed matches */}
            {match.completed && isMyMatch && (
              <div className="completed-match-detail">
                <span className="completed-match-winner">
                  {match.winnerId === currentPlayerId ? 'Won' : 'Lost'}
                </span>
                {match.resolution && (
                  <span className="completed-match-resolution">
                    {match.resolution.type === 'walkover' ? ' (Walkover)' : match.resolution.type === 'double-loss' ? ' (Canceled)' : ''}
                  </span>
                )}
              </div>
            )}

            {/* Action row: action button + message button */}
            <div className="match-card-actions-row">
              {actionLabel && <button className="match-card-action-btn">{actionLabel}</button>}
              {isMyMatch && match.player1Id && match.player2Id && !match.completed && (() => {
                const msgOpponentId = match.player1Id === currentPlayerId ? match.player2Id : match.player1Id
                const msgUnread = hasUnreadFrom(currentPlayerId, msgOpponentId!)
                return (
                  <button
                    className={`match-card-msg-btn ${messagingMatchId === match.id ? 'active' : ''}`}
                    onClick={e => { e.stopPropagation(); setMessagingMatchId(messagingMatchId === match.id ? null : match.id) }}
                    aria-label="Message opponent"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M2 3h12v8H4l-2 2V3z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                    </svg>
                    {msgUnread && <span className="msg-unread-dot" />}
                  </button>
                )
              })()}
            </div>

            {/* Message panel */}
            {messagingMatchId === match.id && isMyMatch && match.player1Id && match.player2Id && (() => {
              const opponentId = match.player1Id === currentPlayerId ? match.player2Id : match.player1Id
              const opponentName = getPlayerName(tournament!, opponentId)
              return (
                <div onClick={e => e.stopPropagation()}>
                  <MessagePanel
                    currentPlayerId={currentPlayerId}
                    currentPlayerName={currentPlayerName}
                    otherPlayerId={opponentId}
                    otherPlayerName={opponentName}
                    onClose={() => setMessagingMatchId(null)}
                  />
                </div>
              )
            })()}

            {/* Expanded inline scoring or scheduling panel */}
            {isExpanded && !match.completed && (
              <div onClick={e => e.stopPropagation()}>
                {canScore ? (
                  <InlineScoreEntry
                    tournament={tournament!}
                    matchId={match.id}
                    onSaved={handleScoreSaved}
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

            {/* R-23: Post-match reaction for completed matches */}
            {match.completed && isMyMatch && (
              <PostMatchReactionInline matchId={match.id} playerId={currentPlayerId} />
            )}
        </>
      </div>
    )
  }

  const isParticipant = tournament.players.some(p => p.id === currentPlayerId)

  // R-05: Clear rendered IDs before each render pass to reset dedup tracking
  renderedMatchIds.current.clear()

  // R-18: Tournament progress calculations
  const totalMatches = tournament.matches.filter(m => m.player1Id && m.player2Id).length
  const completedMatchCount = tournament.matches.filter(m => m.completed).length
  const completionPct = totalMatches > 0 ? Math.round((completedMatchCount / totalMatches) * 100) : 0
  const tournamentStartDate = tournament.createdAt ? new Date(tournament.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null
  // Estimate end date: assume ~2 matches/week pace
  const estimatedWeeksRemaining = totalMatches > 0 ? Math.max(1, Math.ceil((totalMatches - completedMatchCount) / 2)) : 0
  const estimatedEndDate = (() => {
    if (completedMatchCount >= totalMatches) return null
    const d = new Date()
    d.setDate(d.getDate() + estimatedWeeksRemaining * 7)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  })()

  return (
    <div className="bracket-tab">
      <div className="bracket-tab-header">
        <h2>{tournament.name}</h2>
        <div className="bracket-tab-meta">
          {tournament.format === 'single-elimination' ? 'Elimination' : tournament.format === 'group-knockout' ? 'Group stage + Playoffs' : 'Everyone plays everyone'} · {tournament.players.length} players
        </div>
      </div>

      {/* R-18: Tournament progress banner */}
      {tournament.status === 'in-progress' && totalMatches > 0 && (
        <div className="tournament-progress-banner">
          <div className="tournament-progress-header">
            <span className="tournament-progress-title">
              Everyone plays everyone &mdash; {completedMatchCount} of {totalMatches} matches complete
            </span>
            {tournamentStartDate && (
              <span className="tournament-progress-date">Started {tournamentStartDate}</span>
            )}
          </div>
          <div className="tournament-progress-bar-container">
            <div className="tournament-progress-bar" style={{ width: `${completionPct}%` }} />
          </div>
          <div className="tournament-progress-footer">
            <span className="tournament-progress-pct">{completionPct}%</span>
            {estimatedEndDate && (
              <span className="tournament-progress-est">Est. finish: {estimatedEndDate}</span>
            )}
          </div>
        </div>
      )}

      {/* Advancement prompt after scoring a win */}
      {advancementPrompt && (
        <div className="advancement-prompt" onClick={() => setAdvancementPrompt(null)}>
          <div className="advancement-icon">🎾</div>
          <div className="advancement-text">
            <strong>You advanced!</strong> Next up: vs {advancementPrompt.opponentName}
          </div>
        </div>
      )}

      {/* Schedule Summary — "Aha Moment" (first view for round-robin) */}
      {tournament.status === 'in-progress' && tournament.format === 'round-robin' && showScheduleSummary && isParticipant && (
        <ScheduleSummary
          tournament={tournament}
          currentPlayerId={currentPlayerId}
          onViewBracket={() => setShowScheduleSummary(false)}
          onConfirmMatch={async (matchId) => {
            const match = tournament.matches.find(m => m.id === matchId)
            if (!match?.schedule?.proposals?.length) return
            const pending = match.schedule.proposals.find(p => p.status === 'pending')
            if (pending) {
              await acceptProposal(tournament.id, matchId, pending.id, currentPlayerId)
              refresh()
            }
          }}
          onScheduleMatch={(matchId) => {
            setShowScheduleSummary(false)
            setExpandedMatchId(matchId)
          }}
        />
      )}

      {/* Calendar/Bracket toggle for round-robin */}
      {tournament.status === 'in-progress' && tournament.format === 'round-robin' && !showScheduleSummary && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 0 var(--space-md) 0' }}>
          <div className="bracket-view-toggle">
            <button
              className={`bracket-view-toggle-btn ${viewMode === 'calendar' ? 'selected' : ''}`}
              onClick={() => setViewMode('calendar')}
            >Calendar</button>
            <button
              className={`bracket-view-toggle-btn ${viewMode === 'bracket' ? 'selected' : ''}`}
              onClick={() => setViewMode('bracket')}
            >Bracket</button>
          </div>
          {tournament.schedulingSummary && (
            <button className="btn-link" onClick={() => setShowScheduleSummary(true)} style={{ fontSize: 'var(--font-body-sm, 13px)' }}>
              View summary
            </button>
          )}
        </div>
      )}

      {/* Calendar view for round-robin */}
      {tournament.status === 'in-progress' && tournament.format === 'round-robin' && !showScheduleSummary && viewMode === 'calendar' && (
        <MatchCalendar
          tournament={tournament}
          currentPlayerId={currentPlayerId}
          onTournamentUpdated={refresh}
          onExpandMatch={(matchId) => {
            setViewMode('bracket')
            setExpandedMatchId(matchId)
          }}
        />
      )}

      {winner && (
        <div className="winner-banner">
          <div className="winner-trophy">🏆</div>
          <div className="winner-name">{getPlayerName(tournament, winner)}{seeds.get(winner!) != null && <span className="seed-label"> ({seeds.get(winner!)})</span>}</div>
          <div className="winner-subtitle">Tournament Champion</div>
        </div>
      )}

      {/* Completed tournament summary — replaces bracket */}
      {tournament.status === 'completed' && isParticipant && (() => {
        const myTrophies = getPlayerTrophies(currentPlayerId).filter(
          t => t.tournamentName === tournament.name
        )
        const finalMatch = tournament.matches.find(m =>
          m.completed && m.round === Math.max(...tournament.matches.map(mm => mm.round))
        )
        return (
          <div className="completed-summary">
            {myTrophies.length > 0 && (
              <div className="completed-placement">
                {myTrophies.map(trophy => (
                  <div key={trophy.id} className="completed-trophy-card">
                    <div className="completed-trophy-icon">
                      {trophy.tier === 'champion' ? '🥇' : trophy.tier === 'finalist' ? '🥈' : '🥉'}
                    </div>
                    <div className="completed-trophy-info">
                      <div className="completed-trophy-tier">
                        {trophy.tier === 'champion' ? 'Champion' : trophy.tier === 'finalist' ? 'Finalist' : 'Semifinalist'}
                      </div>
                      {trophy.finalMatch && (
                        <div className="completed-trophy-detail">
                          vs {trophy.finalMatch.opponentName} · {trophy.finalMatch.score}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {finalMatch && !myTrophies.length && (
              <div className="completed-final-card">
                <div className="completed-final-label">Final</div>
                <div className="completed-final-result">
                  {getPlayerName(tournament, finalMatch.player1Id)} vs {getPlayerName(tournament, finalMatch.player2Id)}
                </div>
                {finalMatch.score1.length > 0 && (
                  <div className="completed-final-score">
                    {finalMatch.score1.map((s, i) => `${s}-${finalMatch.score2[i]}`).join(', ')}
                  </div>
                )}
              </div>
            )}
            <div className="completed-stats">
              <div className="completed-stat">
                <div className="completed-stat-value">{tournament.players.length}</div>
                <div className="completed-stat-label">Players</div>
              </div>
              <div className="completed-stat">
                <div className="completed-stat-value">{tournament.matches.filter(m => m.completed).length}</div>
                <div className="completed-stat-label">Matches</div>
              </div>
            </div>
          </div>
        )
      })()}

      {tournament.status !== 'completed' && (tournament.format === 'round-robin' || tournament.format === 'group-knockout') && (
        <div className="tab-bar">
          <button className={`tab ${tab === 'matches' ? 'active' : ''}`} onClick={() => setTab('matches')}>Matches</button>
          <button className={`tab ${tab === 'standings' ? 'active' : ''}`} onClick={() => setTab('standings')}>Standings</button>
        </div>
      )}

      {/* R-17: Match filter toggle — Upcoming | Completed | All */}
      {tournament.status !== 'completed' && tab === 'matches' && (
        <div className="match-filter-toggle">
          {(['upcoming', 'completed', 'all'] as MatchFilterMode[]).map(mode => (
            <button
              key={mode}
              className={`match-filter-btn ${matchFilter === mode ? 'selected' : ''}`}
              onClick={() => setMatchFilter(mode)}
            >
              {mode === 'upcoming' ? 'Upcoming' : mode === 'completed' ? 'Completed' : 'All'}
              {mode === 'completed' && completedMatchCount > 0 && (
                <span className="match-filter-count">{completedMatchCount}</span>
              )}
            </button>
          ))}
          {/* R-27: Progressive disclosure toggle */}
          <button
            className="match-filter-btn details-toggle-btn"
            onClick={() => {
              const next = !showDetails
              setShowDetails(next)
              localStorage.setItem('rally-show-details', String(next))
            }}
          >
            {showDetails ? 'Hide details' : 'Show details'}
          </button>
        </div>
      )}

      {tournament.status !== 'completed' && tab === 'matches' && (
        <>
          {/* Round progress stepper for single-elimination */}
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

          {/* Group-phase progress stepper (round-robin and group-knockout) */}
          {hasGroupPhase && (
            <div className="round-progress">
              <div className="round-progress-item">
                <div className={`round-progress-dot ${groupComplete ? 'completed' : 'active'}`} />
                <span className={`round-progress-label ${groupComplete ? 'completed' : 'active'}`}>
                  All play all ({groupMatchesCompleted}/{groupMatchesTotal})
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
                <div className={`round-progress-dot ${knockoutMatches.some(m => m.round === 3 && m.completed) ? 'completed' : knockoutMatches.some(m => m.round === 3 && m.player1Id && m.player2Id) ? 'active' : 'upcoming'}`} />
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
                {/* Group phase matches */}
                <div className="round">
                  <h3 className="round-label">Group Stage</h3>
                  {groupMatches.filter(filterMatch).map(m => renderMatchCard(m))}
                </div>

                {/* Group standings inline */}
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

                {/* Knockout phase */}
                {groupComplete && knockoutMatches.length > 0 && (
                  <>
                    <div className="round">
                      <h3 className="round-label">Semifinals</h3>
                      {knockoutMatches.filter(m => m.round === 2).filter(filterMatch).sort((a, b) => matchSortPriority(a, currentPlayerId) - matchSortPriority(b, currentPlayerId)).map(m => renderMatchCard(m))}
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
                  {(() => {
                    const filtered = groupMatches.filter(filterMatch)
                    const upcomingMatches = filtered.filter(m => !m.completed)
                    const completedMatches = filtered.filter(m => m.completed)
                    const nextMatch = upcomingMatches.find(m =>
                      (m.player1Id === currentPlayerId || m.player2Id === currentPlayerId) &&
                      m.player1Id && m.player2Id
                    )
                    const remainingUpcoming = nextMatch ? upcomingMatches.filter(m => m.id !== nextMatch.id) : upcomingMatches
                    return (
                      <>
                        {nextMatch && (
                          <div className="next-match-section">
                            <div className="next-match-label">Next Match</div>
                            {renderMatchCard(nextMatch)}
                          </div>
                        )}
                        {remainingUpcoming.length > 0 && (
                          showAllMatches || !nextMatch ? (
                            <>
                              {nextMatch && <div className="upcoming-matches-section"><div className="results-section-label">Upcoming matches ({remainingUpcoming.length})</div></div>}
                              {remainingUpcoming.map(m => renderMatchCard(m))}
                            </>
                          ) : (
                            <button className="show-more-matches-btn" onClick={() => setShowAllMatches(true)}>
                              Upcoming matches ({remainingUpcoming.length} more)
                            </button>
                          )
                        )}
                        {completedMatches.length > 0 && (
                          <div className="results-section">
                            <div className="results-section-label">Results</div>
                            {completedMatches.map(m => renderMatchCard(m))}
                          </div>
                        )}
                        {showAllMatches && nextMatch && (
                          <button className="show-more-matches-btn" onClick={() => setShowAllMatches(false)}>
                            Show less
                          </button>
                        )}
                      </>
                    )
                  })()}
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
                      {knockoutMatches.filter(m => m.round === 2).filter(filterMatch).sort((a, b) => matchSortPriority(a, currentPlayerId) - matchSortPriority(b, currentPlayerId)).map(m => renderMatchCard(m))}
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

      {tournament.status !== 'completed' && tab === 'standings' && (tournament.format === 'round-robin' || tournament.format === 'group-knockout') && (
        <Standings tournament={tournament} />
      )}

      {isParticipant && tournament.status !== 'completed' && (
        <div className="bracket-overflow-section">
          <button className="bracket-overflow-btn" onClick={() => setShowOverflow(!showOverflow)}>
            ···
          </button>
          {showOverflow && (
            <div className="bracket-overflow-menu">
              <button className="bracket-overflow-item bracket-overflow-danger" onClick={() => { setShowOverflow(false); setShowLeaveConfirm(true) }}>
                Leave tournament
              </button>
            </div>
          )}
        </div>
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
