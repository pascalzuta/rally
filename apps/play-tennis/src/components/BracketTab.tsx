import { useState, useEffect, useRef } from 'react'
import { titleCase } from '../dateUtils'
import { Tournament, Match } from '../types'
import { getPlayerName, getSeeds, getGroupStandings, leaveTournament, getTournament, getPlayerTrophies, hasUnreadFrom, checkAutoAcceptScores, getPendingFeedback, clearPendingFeedback, getPlayerFeedbackForMatch } from '../store'
import { getMatchCardView } from '../matchCardModel'
import { useStableSortPriority } from '../useStableOrder'
import MessagePanel from './MessagePanel'
import MatchActionCard from './MatchActionCard'
import Standings from './Standings'
import ScheduleSummary from './ScheduleSummary'
import MatchCalendar from './MatchCalendar'
import PostMatchFeedbackInline from './PostMatchFeedbackInline'
import ScoreConfirmationPanel from './ScoreConfirmationPanel'
import ReliabilityIndicator from './ReliabilityIndicator'
import UpcomingMatchPanel from './UpcomingMatchPanel'
import { canEnterScore, canExpandMatch } from '../matchCapabilities'

type MatchFilterMode = 'upcoming' | 'completed' | 'all'

interface Props {
  tournament: Tournament | null
  currentPlayerId: string
  currentPlayerName: string
  onTournamentUpdated: () => void
  focusMatchId?: string | null
  onFocusConsumed?: () => void
}

function formatScoreSummary(match: Match): string | null {
  if (!match.score1.length || match.score1.length !== match.score2.length) return null
  return match.score1.map((s, i) => `${s}-${match.score2[i]}`).join(', ')
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

function eyebrowTone(type: string): 'slate' | 'blue' | 'green' | 'amber' | 'red' {
  switch (type) {
    case 'confirmed':
      return 'green'
    case 'respond':
    case 'confirm-score':
      return 'blue'
    case 'escalated':
      return 'red'
    case 'schedule':
      return 'amber'
    default:
      return 'slate'
  }
}

function smoothScrollIntoViewport(el: HTMLElement) {
  const rect = el.getBoundingClientRect()
  const topPadding = 112
  const bottomPadding = 28
  const viewportHeight = window.innerHeight

  if (rect.top < topPadding) {
    window.scrollBy({
      top: rect.top - topPadding,
      behavior: 'smooth',
    })
    return
  }

  if (rect.bottom > viewportHeight - bottomPadding) {
    window.scrollBy({
      top: rect.bottom - viewportHeight + bottomPadding,
      behavior: 'smooth',
    })
  }
}

export default function BracketTab({ tournament, currentPlayerId, currentPlayerName, onTournamentUpdated, focusMatchId, onFocusConsumed }: Props) {
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null)
  const [messagingMatchId, setMessagingMatchId] = useState<string | null>(null)
  const [tab, setTab] = useState<'matches' | 'standings'>('matches')
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)

  const [advancementPrompt, setAdvancementPrompt] = useState<{ opponentName: string; round: number } | null>(null)
  const [viewMode, setViewMode] = useState<'mine' | 'all'>('mine') // default to my matches
  const [matchFilter, setMatchFilter] = useState<MatchFilterMode>('upcoming') // R-17
  const [highlightedMatchId, setHighlightedMatchId] = useState<string | null>(null) // R-15
  const pendingFeedback = getPendingFeedback()
  const matchRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const pendingScrollId = useRef<string | null>(null)
  // Track match awaiting feedback — survives sync re-renders via localStorage
  const [feedbackMatchId, setFeedbackMatchId] = useState<string | null>(() => {
    const pending = getPendingFeedback()
    if (pending && !getPlayerFeedbackForMatch(pending.matchId, currentPlayerId)) return pending.matchId
    return null
  })
  // Re-sync feedbackMatchId from localStorage on tournament data changes (e.g. after sync event)
  useEffect(() => {
    const pending = getPendingFeedback()
    if (pending && !getPlayerFeedbackForMatch(pending.matchId, currentPlayerId)) {
      setFeedbackMatchId(pending.matchId)
    } else if (!pending) {
      setFeedbackMatchId(null)
    }
  }, [tournament]) // eslint-disable-line react-hooks/exhaustive-deps

  // R-05: Track rendered match IDs to prevent duplicates
  const renderedMatchIds = useRef<Set<string>>(new Set())

  // Stable sort: freeze match priorities from first render so cards don't jump after actions
  const getStablePriority = useStableSortPriority(
    tournament?.matches ?? [],
    m => m.id,
    m => matchSortPriority(m, currentPlayerId),
    tournament?.id,
  )

  // Check for auto-accept (48h timeout) on mount
  useEffect(() => { checkAutoAcceptScores() }, [])

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
    setViewMode('all')
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
        smoothScrollIntoViewport(el)
      }
    })
  })

  if (!tournament) {
    return (
      <div className="bracket-tab">
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8m-4-4v4m-4.5-8a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 0 4.5 4.5M6.5 13A4.5 4.5 0 0 1 2 8.5" /><path d="M12 2v1m-7 3H4m16 0h-1m-2.64-3.36-.7.7M8.64 3.64l-.7-.7" /></svg>
          </div>
          <div className="empty-state-title">No tournament yet</div>
          <div className="empty-state-message">Join your county from the Home tab — your draw will show up here</div>
        </div>
      </div>
    )
  }

  if (tournament.status === 'setup' || tournament.status === 'scheduling') {
    const setupIsParticipant = tournament.players.some(p => p.id === currentPlayerId)
    const handleSetupLeave = async () => {
      await leaveTournament(tournament!.id, currentPlayerId)
      setShowLeaveConfirm(false)
      onTournamentUpdated()
    }
    return (
      <div className="bracket-tab">
        <div className="bracket-tab-header">
          <h2>{titleCase(tournament.name)}</h2>
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

        {setupIsParticipant && (
          <button className="btn btn-large logout-btn" onClick={() => setShowLeaveConfirm(true)}>
            Leave Tournament
          </button>
        )}

        {showLeaveConfirm && (
          <div className="leave-overlay" onClick={() => setShowLeaveConfirm(false)}>
            <div className="leave-modal" onClick={e => e.stopPropagation()}>
              <h3 className="leave-title">Leave Tournament?</h3>
              <p className="leave-message">
                You will be removed from this tournament. This cannot be undone.
              </p>
              <div className="leave-actions">
                <button className="btn" onClick={() => setShowLeaveConfirm(false)}>Cancel</button>
                <button className="btn btn-danger" onClick={handleSetupLeave}>Leave Tournament</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  function refreshAndCheckFeedback() {
    const pending = getPendingFeedback()
    if (pending && !getPlayerFeedbackForMatch(pending.matchId, currentPlayerId)) {
      setFeedbackMatchId(pending.matchId)
    }
    onTournamentUpdated()
  }

  function refresh() {
    onTournamentUpdated()
  }

  function handleScoreSaved() {
    setExpandedMatchId(null)
    refreshAndCheckFeedback()
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

  function handleMatchClick(match: Match, canScore: boolean) {
    if (canScore || canExpandMatch(match, currentPlayerId)) {
      setMessagingMatchId(null)
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
    ? tournament.matches.filter(m => m.phase === 'group').sort((a, b) => getStablePriority(a) - getStablePriority(b))
    : []
  const knockoutMatches = hasGroupPhase
    ? tournament.matches.filter(m => m.phase === 'knockout')
    : []
  const groupComplete = hasGroupPhase && !!tournament.groupPhaseComplete
  const groupStandings = hasGroupPhase ? getGroupStandings(tournament) : []

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

  // R-17: Filter matches based on matchFilter mode
  // Always include the match awaiting feedback so the form stays visible inline
  function filterMatch(m: Match): boolean {
    if (m.id === feedbackMatchId) return true
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
    const seed1 = match.player1Id ? seeds.get(match.player1Id) : null
    const seed2 = match.player2Id ? seeds.get(match.player2Id) : null
    const isMyMatch = match.player1Id === currentPlayerId || match.player2Id === currentPlayerId
    const canScore = canEnterScore(match, currentPlayerId)
    const isBye = (!match.player1Id || !match.player2Id) && match.completed
    const isExpanded = expandedMatchId === match.id
    const onWinnerPath = winnerPath.has(match.id)
    const cardView = getMatchCardView(tournament!, match, currentPlayerId)

    const scored = hasScores(match)
    const scoreSummary = formatScoreSummary(match)
    const opponentName = isMyMatch
      ? match.player1Id === currentPlayerId ? p2 : p1
      : null

    const title = (() => {
      if (match.completed) {
        if (isMyMatch && opponentName) {
          return match.winnerId === currentPlayerId ? `Won vs ${opponentName}` : `Lost to ${opponentName}`
        }
        if (match.winnerId === match.player1Id) return `${p1} def. ${p2}`
        if (match.winnerId === match.player2Id) return `${p2} def. ${p1}`
        return `${p1} vs ${p2}`
      }
      if (isMyMatch && opponentName) return `vs ${opponentName}`
      return `${p1} vs ${p2}`
    })()

    const supporting = (() => {
      if (match.completed) {
        if (scoreSummary) return scoreSummary
        if (match.winnerId) {
          const winnerName = match.winnerId === match.player1Id ? p1 : p2
          return `${winnerName} advanced.`
        }
        return 'Match completed.'
      }
      return cardView.supporting
    })()

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

    if (isMyMatch && !match.completed && match.player1Id && match.player2Id) {
      return (
        <MatchActionCard
          key={match.id}
          ref={el => { if (el) matchRefs.current.set(match.id, el); else matchRefs.current.delete(match.id) }}
          className={`${isFinal ? 'match-card-final' : ''} ${highlightedMatchId === match.id ? 'match-card-highlighted' : ''}`}
          tournament={tournament!}
          match={match}
          currentPlayerId={currentPlayerId}
          currentPlayerName={currentPlayerName}
          isExpanded={isExpanded}
          isMessaging={messagingMatchId === match.id}
          onToggleExpanded={() => {
            setMessagingMatchId(null)
            setExpandedMatchId(isExpanded ? null : match.id)
          }}
          onToggleMessaging={() => {
            setExpandedMatchId(null)
            setMessagingMatchId(messagingMatchId === match.id ? null : match.id)
          }}
          onUpdated={() => {
            setExpandedMatchId(null)
            refreshAndCheckFeedback()
          }}
          onScoreSaved={handleScoreSaved}
        />
      )
    }

    return (
      <div
        key={match.id}
        ref={el => { if (el) matchRefs.current.set(match.id, el); else matchRefs.current.delete(match.id) }}
        className={`match-card ${match.completed ? 'completed' : ''} ${canScore ? 'scoreable' : ''} ${isMyMatch && !match.completed ? 'my-match' : ''} ${isFinal ? 'match-card-final' : ''} ${onWinnerPath ? 'winner-path' : ''} ${scheduleStatusClass(match)} ${highlightedMatchId === match.id ? 'match-card-highlighted' : ''}`}
        onClick={() => handleMatchClick(match, !!canScore)}
      >
        <>
          <div className="match-card-eyebrow-row">
            {!match.completed && (
              <div className={`match-card-eyebrow card-status-label card-status-label--${eyebrowTone(cardView.tone)}`}>
                {cardView.statusLabel}
              </div>
            )}
            {cardView.metaLabel && <span className="card-meta-chip match-card-meta-chip">{cardView.metaLabel}</span>}
          </div>

          <div className="match-card-summary">
            <div className="match-card-title-block">
              <div className="match-card-title">{title}</div>
              {!isMyMatch && !match.completed && (
                <div className="match-card-self">
                  {match.player1Id && <ReliabilityIndicator playerId={match.player1Id} isOrganizer={isOrganizer} />}
                  <span>{p1}{seed1 != null && <span className="seed-label"> ({seed1})</span>}</span>
                  <span className="match-card-summary-separator">vs</span>
                  {match.player2Id && <ReliabilityIndicator playerId={match.player2Id} isOrganizer={isOrganizer} />}
                  <span>{p2}{seed2 != null && <span className="seed-label"> ({seed2})</span>}</span>
                </div>
              )}
            </div>
            {supporting && (
              <div className={`match-card-supporting ${cardView.supportingTone === 'danger' ? 'match-card-supporting--danger' : ''}`}>
                {supporting}
              </div>
            )}
            {scored && match.completed && (
              <div className="match-card-scoreboard">
                <div className={`match-player ${match.winnerId === match.player1Id ? 'winner' : ''}`}>
                  <span className="match-player-name">
                    {p1}{seed1 != null && <span className="seed-label"> ({seed1})</span>}
                  </span>
                  <span className="match-sets">
                    {match.score1.map((s, i) => (
                      <span key={i} className={`set-score ${s > match.score2[i] ? 'set-won' : ''}`}>{s}</span>
                    ))}
                  </span>
                </div>
                <div className={`match-player ${match.winnerId === match.player2Id ? 'winner' : ''}`}>
                  <span className="match-player-name">
                    {p2}{seed2 != null && <span className="seed-label"> ({seed2})</span>}
                  </span>
                  <span className="match-sets">
                    {match.score2.map((s, i) => (
                      <span key={i} className={`set-score ${s > match.score1[i] ? 'set-won' : ''}`}>{s}</span>
                    ))}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Resolution indicator */}
          {match.resolution && (
            <div className={`resolution-indicator resolution-${match.resolution.type}`}>
              {match.resolution.type === 'walkover' ? 'Walkover' :
               match.resolution.type === 'forced-match' ? 'Final Match Assigned' :
               'Match Canceled'}
            </div>
          )}

          {/* Action row: action button + message button */}
          <div className="match-card-actions-row">
            {(cardView.primaryActionLabel === 'Confirm Score' || cardView.primaryActionLabel === 'Review Dispute') ? (
              <button className="match-card-action-btn" onClick={e => {
                e.stopPropagation()
                setMessagingMatchId(null)
                setExpandedMatchId(expandedMatchId === match.id ? null : match.id)
              }}>{cardView.primaryActionLabel}</button>
            ) : cardView.primaryActionLabel ? (
              <button
                className="match-card-action-btn"
                onClick={e => {
                  e.stopPropagation()
                  setMessagingMatchId(null)
                  setExpandedMatchId(expandedMatchId === match.id ? null : match.id)
                }}
              >
                {cardView.primaryActionLabel}
              </button>
            ) : null}
            {isMyMatch && match.player1Id && match.player2Id && (() => {
              const msgOpponentId = match.player1Id === currentPlayerId ? match.player2Id : match.player1Id
              const msgUnread = hasUnreadFrom(currentPlayerId, msgOpponentId!)
              return (
                <button
                  className={`match-card-msg-btn ${messagingMatchId === match.id ? 'active' : ''}`}
                  onClick={e => {
                    e.stopPropagation()
                    setExpandedMatchId(null)
                    setMessagingMatchId(messagingMatchId === match.id ? null : match.id)
                  }}
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
              <div className="match-card-expansion" onClick={e => e.stopPropagation()}>
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

          {/* Expanded inline scoring, confirmation, or scheduling panel */}
          {isExpanded && !match.completed && (
            <div className="match-card-expansion" onClick={e => e.stopPropagation()}>
              {/* Score confirmation/dispute panel */}
              {match.scoreReportedBy && match.scoreReportedBy !== currentPlayerId && !match.scoreDispute ? (
                <ScoreConfirmationPanel
                  tournament={tournament!}
                  match={match}
                  currentPlayerId={currentPlayerId}
                  onUpdated={() => { setExpandedMatchId(null); refreshAndCheckFeedback() }}
                />
              ) : match.scoreDispute?.status === 'pending' && match.scoreReportedBy === currentPlayerId ? (
                <ScoreConfirmationPanel
                  tournament={tournament!}
                  match={match}
                  currentPlayerId={currentPlayerId}
                  onUpdated={() => { setExpandedMatchId(null); refreshAndCheckFeedback() }}
                />
              ) : match.schedule ? (
                <UpcomingMatchPanel
                  tournament={tournament!}
                  match={match}
                  currentPlayerId={currentPlayerId}
                  onUpdated={refresh}
                  onScoreSaved={handleScoreSaved}
                />
              ) : null}
            </div>
          )}

          {/* R-23: Post-match feedback — shown right after scoring/confirming */}
          {pendingFeedback?.matchId === match.id && isMyMatch && match.player1Id && match.player2Id && (() => {
            const opponentId = match.player1Id === currentPlayerId ? match.player2Id : match.player1Id
            const opponentName = getPlayerName(tournament!, opponentId)
            return (
              <div className="match-card-expansion">
                <PostMatchFeedbackInline
                  matchId={match.id}
                  tournamentId={tournament!.id}
                  playerId={currentPlayerId}
                  opponentId={opponentId}
                  opponentName={opponentName}
                  onDone={() => { setFeedbackMatchId(null); clearPendingFeedback(); refresh() }}
                />
              </div>
            )
          })()}
        </>
      </div>
    )
  }

  const isParticipant = tournament.players.some(p => p.id === currentPlayerId)
  const isOrganizer = tournament.players[0]?.id === currentPlayerId

  // R-05: Clear rendered IDs before each render pass to reset dedup tracking
  renderedMatchIds.current.clear()

  const completedMatchCount = tournament.matches.filter(m => m.completed).length

  return (
    <div className="bracket-tab">
      <div className="bracket-tab-header">
        <h2>{titleCase(tournament.name)}</h2>
        <div className="bracket-tab-meta">
          {tournament.players.length} players · {tournament.format === 'single-elimination' ? 'Elimination' : tournament.format === 'group-knockout' ? 'Group stage + Playoffs' : 'Round robin'}
        </div>
      </div>

      {/* Advancement prompt after scoring a win */}
      {advancementPrompt && (
        <div className="advancement-prompt" onClick={() => setAdvancementPrompt(null)}>
          <div className="advancement-icon">🎾</div>
          <div className="advancement-text">
            <strong>You advanced!</strong> Next up: vs {advancementPrompt.opponentName}
          </div>
        </div>
      )}

      {/* Summary card + My Matches / All Matches for round-robin */}
      {tournament.status === 'in-progress' && tournament.format === 'round-robin' && isParticipant && (
        <>
          {/* Summary header card — always visible */}
          <ScheduleSummary
            tournament={tournament}
            currentPlayerId={currentPlayerId}
            currentPlayerName={currentPlayerName}
            onViewBracket={() => setViewMode('all')}
            onTournamentUpdated={refreshAndCheckFeedback}
            headerOnly
          />

          {/* My Matches / All Matches toggle */}
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-sm) 0' }}>
            <div className="bracket-view-toggle">
              <button
                className={`bracket-view-toggle-btn ${viewMode === 'mine' ? 'selected' : ''}`}
                onClick={() => setViewMode('mine')}
              >My Matches</button>
              <button
                className={`bracket-view-toggle-btn ${viewMode === 'all' ? 'selected' : ''}`}
                onClick={() => setViewMode('all')}
              >All Matches</button>
            </div>
          </div>

          {/* Match calendar — filtered by toggle */}
          <MatchCalendar
            tournament={tournament}
            currentPlayerId={currentPlayerId}
            currentPlayerName={currentPlayerName}
            onTournamentUpdated={refreshAndCheckFeedback}
            filterMyMatches={viewMode === 'mine'}
            hideSummaryStrip
          />

          {/* Standings */}
          <Standings tournament={tournament} />
        </>
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

      {tournament.status !== 'completed' && tournament.format === 'group-knockout' && (
        <div className="tab-bar">
          <button className={`tab ${tab === 'matches' ? 'active' : ''}`} onClick={() => setTab('matches')}>Matches</button>
          <button className={`tab ${tab === 'standings' ? 'active' : ''}`} onClick={() => setTab('standings')}>Standings</button>
        </div>
      )}

      {/* R-17: Match filter toggle — Upcoming | Completed | All (not for round-robin, which uses My Matches/All Matches) */}
      {tournament.status !== 'completed' && tournament.format !== 'round-robin' && tab === 'matches' && (
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
        </div>
      )}

      {tournament.status !== 'completed' && tournament.format !== 'round-robin' && tab === 'matches' && (
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

          {/* Group-phase stepper now in header card above */}

          <div className="bracket">
            {tournament.format === 'single-elimination' ? (
              rounds.map((round, roundIdx) => {
                const isFinalRound = round === rounds.length
                const roundMatches = tournament.matches
                  .filter(m => m.round === round)
                  .filter(filterMatch)
                  .sort((a, b) => getStablePriority(a) - getStablePriority(b))
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

                {/* Knockout phase */}
                {groupComplete && knockoutMatches.length > 0 && (
                  <>
                    <div className="round">
                      <h3 className="round-label">Semifinals</h3>
                      {knockoutMatches.filter(m => m.round === 2).filter(filterMatch).sort((a, b) => getStablePriority(a) - getStablePriority(b)).map(m => renderMatchCard(m))}
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
                <div className="round round-rr">
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
                        {nextMatch && renderMatchCard(nextMatch)}
                        {remainingUpcoming.map(m => renderMatchCard(m))}
                        {completedMatches.length > 0 && completedMatches.map(m => renderMatchCard(m))}
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
                      {knockoutMatches.filter(m => m.round === 2).filter(filterMatch).sort((a, b) => getStablePriority(a) - getStablePriority(b)).map(m => renderMatchCard(m))}
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

      {tournament.status !== 'completed' && tab === 'standings' && tournament.format === 'group-knockout' && (
        <Standings tournament={tournament} />
      )}

      {isParticipant && tournament.status !== 'completed' && (
        <button className="btn btn-large logout-btn" onClick={() => setShowLeaveConfirm(true)}>
          Leave Tournament
        </button>
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
