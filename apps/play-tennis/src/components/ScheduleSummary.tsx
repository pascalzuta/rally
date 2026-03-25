import { useState, useEffect } from 'react'
import { Tournament, Match } from '../types'
import { getSchedulingSummary, getPlayerName } from '../store'
import MatchActionCard from './MatchActionCard'
import PostMatchFeedbackInline from './PostMatchFeedbackInline'

interface Props {
  tournament: Tournament
  currentPlayerId: string
  currentPlayerName: string
  onViewBracket: () => void
  onTournamentUpdated?: () => void
}

function getWeekOneMonday(tournament: Tournament): Date {
  if (tournament.startsAt) {
    const [y, m, d] = tournament.startsAt.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    date.setHours(0, 0, 0, 0)
    return date
  }
  // Fallback: Monday of the week the tournament was created
  const created = new Date(tournament.createdAt)
  const mondayOffset = (created.getDay() + 6) % 7
  const monday = new Date(created)
  monday.setDate(created.getDate() - mondayOffset)
  monday.setHours(0, 0, 0, 0)
  return monday
}

function groupMatchesByWeek(matches: Match[], tournament: Tournament): Map<number, { matches: Match[]; weekStart: Date }> {
  const weeks = new Map<number, { matches: Match[]; weekStart: Date }>()

  const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  const scheduled = matches
    .filter(m => m.schedule && !m.completed)
    .sort((a, b) => {
      const slotA = a.schedule?.confirmedSlot ?? a.schedule?.proposals?.[0]
      const slotB = b.schedule?.confirmedSlot ?? b.schedule?.proposals?.[0]
      if (!slotA || !slotB) return 0
      return dayOrder.indexOf(slotA.day) - dayOrder.indexOf(slotB.day) || slotA.startHour - slotB.startHour
    })

  let currentWeek = 1
  let weekMatchCount = 0
  const maxPerWeek = 3

  const weekOneMonday = getWeekOneMonday(tournament)

  for (const match of scheduled) {
    if (weekMatchCount >= maxPerWeek) {
      currentWeek++
      weekMatchCount = 0
    }
    if (!weeks.has(currentWeek)) {
      const weekStart = new Date(weekOneMonday)
      weekStart.setDate(weekOneMonday.getDate() + (currentWeek - 1) * 7)
      weeks.set(currentWeek, { matches: [], weekStart })
    }
    weeks.get(currentWeek)!.matches.push(match)
    weekMatchCount++
  }

  return weeks
}

export default function ScheduleSummary({ tournament, currentPlayerId, currentPlayerName, onViewBracket, onTournamentUpdated }: Props) {
  const [visible, setVisible] = useState(false)
  const [messagingMatchId, setMessagingMatchId] = useState<string | null>(null)
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null)
  const [feedbackMatchId, setFeedbackMatchId] = useState<string | null>(null)

  const summary = getSchedulingSummary(tournament)
  const totalMatches = tournament.matches.filter(m => m.player1Id && m.player2Id).length
  const completedMatchCount = tournament.matches.filter(m => m.completed).length
  const playedPct = totalMatches > 0 ? Math.round((completedMatchCount / totalMatches) * 100) : 0

  // Phase data
  const hasGroupPhase = tournament.format === 'group-knockout' || tournament.format === 'round-robin'
  const groupMatches = hasGroupPhase ? tournament.matches.filter(m => m.phase === 'group') : []
  const knockoutMatches = hasGroupPhase ? tournament.matches.filter(m => m.phase === 'knockout') : []
  const groupComplete = hasGroupPhase && !!tournament.groupPhaseComplete
  const groupMatchesCompleted = groupMatches.filter(m => m.completed).length
  const groupMatchesTotal = groupMatches.length

  // Estimated end date — based on tournament start + total weeks needed
  const playerCount = tournament.players.length
  const matchesPerWeek = Math.max(1, Math.floor(playerCount / 2))
  const totalWeeks = totalMatches > 0 ? Math.max(3, Math.ceil(totalMatches / matchesPerWeek)) : 0
  const estimatedEndDate = (() => {
    if (completedMatchCount >= totalMatches) return null
    const weekOneMonday = getWeekOneMonday(tournament)
    const d = new Date(weekOneMonday)
    d.setDate(d.getDate() + totalWeeks * 7)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  })()

  useEffect(() => {
    setVisible(true)
  }, [])

  if (!summary) return null

  // Find next match for current player
  const myMatches = tournament.matches.filter(m =>
    (m.player1Id === currentPlayerId || m.player2Id === currentPlayerId) && !m.completed
  )
  const nextConfirmed = myMatches.find(m => m.schedule?.schedulingTier === 'auto' && m.schedule?.confirmedSlot)
  const nextMatch = nextConfirmed ?? myMatches[0]

  // Group my matches by week for the agenda
  const weekGroups = groupMatchesByWeek(myMatches, tournament)
  const getWeekLabel = (week: number, weekStart: Date) => {
    const now = new Date()
    const nowMonday = new Date(now)
    nowMonday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
    nowMonday.setHours(0, 0, 0, 0)
    const isCurrentWeek = weekStart.getTime() === nowMonday.getTime()
    if (isCurrentWeek) return 'This Week'
    const isPast = weekStart.getTime() < nowMonday.getTime()
    const weekLabel = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return isPast ? `Week of ${weekLabel} (past)` : `Week of ${weekLabel}`
  }

  return (
    <div className={`schedule-summary-screen ${visible ? 'visible' : ''}`}>
      {/* === Unified Tournament Header Card === */}
      <div className="schedule-header-card">
        {/* Phase stepper */}
        {hasGroupPhase && (
          <div className="schedule-phase-stepper">
            <div className="schedule-phase-step">
              <div className={`schedule-phase-dot ${groupComplete ? 'completed' : 'active'}`} />
              <span className={`schedule-phase-label ${groupComplete ? 'completed' : 'active'}`}>
                Round Robin
              </span>
            </div>
            <div className={`schedule-phase-line ${groupComplete ? 'completed' : ''}`} />
            <div className="schedule-phase-step">
              <div className={`schedule-phase-dot ${groupComplete ? (knockoutMatches.some(m => m.round === 2) && knockoutMatches.filter(m => m.round === 2).every(m => m.completed) ? 'completed' : 'active') : 'upcoming'}`} />
              <span className={`schedule-phase-label ${groupComplete ? 'active' : 'upcoming'}`}>
                Semi
              </span>
            </div>
            <div className={`schedule-phase-line ${knockoutMatches.some(m => m.round === 2 && m.completed) ? 'completed' : ''}`} />
            <div className="schedule-phase-step">
              <div className={`schedule-phase-dot ${knockoutMatches.some(m => m.round === 3 && m.completed) ? 'completed' : knockoutMatches.some(m => m.round === 3 && m.player1Id && m.player2Id) ? 'active' : 'upcoming'}`} />
              <span className={`schedule-phase-label ${knockoutMatches.some(m => m.round === 3 && m.player1Id && m.player2Id) ? 'active' : 'upcoming'}`}>
                Final
              </span>
            </div>
          </div>
        )}

        {/* Progress bar */}
        <div className="schedule-progress-section">
          <div className="schedule-progress-bar-track">
            <div className="schedule-progress-bar-fill" style={{ width: `${Math.max(playedPct, 2)}%` }} />
          </div>
          <div className="schedule-progress-meta">
            <span className="schedule-progress-count">{completedMatchCount} of {totalMatches} played</span>
            {estimatedEndDate && <span className="schedule-progress-est">Est. finish {estimatedEndDate}</span>}
          </div>
        </div>

        {/* Your To-Do */}
        <div className="schedule-todo-section">
          <div className="schedule-todo-title">Your To-Do</div>
          <div className="schedule-todo-rows">
            <div className="schedule-todo-row">
              <span className="schedule-todo-dot" style={{ background: 'var(--color-positive-primary)' }} />
              <span className="schedule-todo-count">{summary.confirmed}</span>
              <span className="schedule-todo-label">Confirmed</span>
            </div>
            {summary.needsAccept > 0 && (
              <div className="schedule-todo-row">
                <span className="schedule-todo-dot" style={{ background: 'var(--color-accent-primary)' }} />
                <span className="schedule-todo-count">{summary.needsAccept}</span>
                <span className="schedule-todo-label">Confirm your time</span>
              </div>
            )}
            {summary.needsNegotiation > 0 && (
              <div className="schedule-todo-row">
                <span className="schedule-todo-dot" style={{ background: 'var(--color-warning-primary, #F59E0B)' }} />
                <span className="schedule-todo-count">{summary.needsNegotiation}</span>
                <span className="schedule-todo-label">Need scheduling</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Next match card */}
      {nextMatch && (() => {
        const isMessaging = messagingMatchId === nextMatch.id
        return (
          <MatchActionCard
            className="card"
            tournament={tournament}
            match={nextMatch}
            currentPlayerId={currentPlayerId}
            currentPlayerName={currentPlayerName}
            isExpanded={expandedMatchId === nextMatch.id}
            isMessaging={isMessaging}
            onToggleExpanded={() => {
              setMessagingMatchId(null)
              setExpandedMatchId(expandedMatchId === nextMatch.id ? null : nextMatch.id)
            }}
            onToggleMessaging={() => {
              setExpandedMatchId(null)
              setMessagingMatchId(isMessaging ? null : nextMatch.id)
            }}
            onUpdated={() => {
              setExpandedMatchId(null)
              setFeedbackMatchId(nextMatch.id)
            }}
          />
        )
      })()}

      {/* Post-match feedback — shown right after confirming */}
      {feedbackMatchId && (() => {
        const fbMatch = tournament.matches.find(m => m.id === feedbackMatchId)
        if (!fbMatch || !fbMatch.player1Id || !fbMatch.player2Id) return null
        const opponentId = fbMatch.player1Id === currentPlayerId ? fbMatch.player2Id : fbMatch.player1Id
        const opponentName = getPlayerName(tournament, opponentId)
        return (
          <div className="card action-card action-completed">
            <PostMatchFeedbackInline
              matchId={feedbackMatchId}
              tournamentId={tournament.id}
              playerId={currentPlayerId}
              opponentId={opponentId}
              opponentName={opponentName}
              onDone={() => {
                setFeedbackMatchId(null)
                onTournamentUpdated?.()
              }}
            />
          </div>
        )
      })()}

      {/* Week-by-week agenda */}
      {weekGroups.size > 0 && (
        <div className="schedule-agenda">
          <div className="section-header">Schedule</div>
          {[...weekGroups.entries()].map(([week, { matches, weekStart }]) => (
            <div key={week} className="schedule-week">
              <div className="schedule-week-header">
                <span className={`calendar-week-dot ${week === 1 ? 'calendar-week-dot--current' : 'calendar-week-dot--future'}`} />
                {getWeekLabel(week, weekStart)}
              </div>
              {matches.map(match => {
                const isMessaging = messagingMatchId === match.id
                return (
                  <MatchActionCard
                    key={match.id}
                    className="card"
                    tournament={tournament}
                    match={match}
                    currentPlayerId={currentPlayerId}
                    currentPlayerName={currentPlayerName}
                    isExpanded={expandedMatchId === match.id}
                    isMessaging={isMessaging}
                    onToggleExpanded={() => {
                      setMessagingMatchId(null)
                      setExpandedMatchId(expandedMatchId === match.id ? null : match.id)
                    }}
                    onToggleMessaging={() => {
                      setExpandedMatchId(null)
                      setMessagingMatchId(isMessaging ? null : match.id)
                    }}
                    onUpdated={() => {
                      setExpandedMatchId(null)
                      setFeedbackMatchId(match.id)
                    }}
                  />
                )
              })}
            </div>
          ))}
        </div>
      )}

      {/* View Full Bracket button */}
      <button className="btn btn-large schedule-view-bracket" onClick={onViewBracket}>
        See All Matchups
      </button>
    </div>
  )
}
