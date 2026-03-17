import { useState, useEffect, useRef } from 'react'
import { Tournament, Match, SchedulingSummary } from '../types'
import { getSchedulingSummary, getPlayerName } from '../store'

interface Props {
  tournament: Tournament
  currentPlayerId: string
  onViewBracket: () => void
  onConfirmMatch?: (matchId: string) => void
  onScheduleMatch?: (matchId: string) => void
}

const DAY_INDEX: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
}

function resolveDate(weekStart: Date, dayOfWeek: string): Date {
  const target = DAY_INDEX[dayOfWeek] ?? 1
  const start = weekStart.getDay()
  const diff = (target - start + 7) % 7
  const result = new Date(weekStart)
  result.setDate(result.getDate() + diff)
  return result
}

function formatMatchDate(slot: { day: string; startHour: number }, weekStart?: Date): string {
  const period = slot.startHour >= 12 ? 'PM' : 'AM'
  const hour = slot.startHour % 12 || 12
  if (weekStart) {
    const date = resolveDate(weekStart, slot.day)
    const dayLabel = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
    return `${dayLabel}, ${hour}:00 ${period}`
  }
  const dayNames: Record<string, string> = {
    monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
    thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
  }
  const day = dayNames[slot.day] ?? slot.day
  return `${day}, ${hour}:00 ${period}`
}

function groupMatchesByWeek(matches: Match[]): Map<number, { matches: Match[]; weekStart: Date }> {
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

  const today = new Date()
  const mondayOffset = (today.getDay() + 6) % 7
  const thisMonday = new Date(today)
  thisMonday.setDate(today.getDate() - mondayOffset)
  thisMonday.setHours(0, 0, 0, 0)

  for (const match of scheduled) {
    if (weekMatchCount >= maxPerWeek) {
      currentWeek++
      weekMatchCount = 0
    }
    if (!weeks.has(currentWeek)) {
      const weekStart = new Date(thisMonday)
      weekStart.setDate(thisMonday.getDate() + (currentWeek - 1) * 7)
      weeks.set(currentWeek, { matches: [], weekStart })
    }
    weeks.get(currentWeek)!.matches.push(match)
    weekMatchCount++
  }

  return weeks
}

export default function ScheduleSummary({ tournament, currentPlayerId, onViewBracket, onConfirmMatch, onScheduleMatch }: Props) {
  const [visible, setVisible] = useState(false)

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

  // Estimated end date
  const estimatedWeeksRemaining = totalMatches > 0 ? Math.max(1, Math.ceil((totalMatches - completedMatchCount) / 2)) : 0
  const estimatedEndDate = (() => {
    if (completedMatchCount >= totalMatches) return null
    const d = new Date()
    d.setDate(d.getDate() + estimatedWeeksRemaining * 7)
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
  const weekGroups = groupMatchesByWeek(myMatches)
  const getWeekLabel = (week: number, weekStart: Date) => {
    return week === 1 ? 'This Week' : `Week of ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
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
              <div className={`schedule-phase-dot ${groupComplete ? (knockoutMatches.filter(m => m.round === 2).every(m => m.completed) ? 'completed' : 'active') : 'upcoming'}`} />
              <span className={`schedule-phase-label ${groupComplete ? 'active' : 'upcoming'}`}>
                Semi
              </span>
            </div>
            <div className={`schedule-phase-line ${knockoutMatches.filter(m => m.round === 2).every(m => m.completed) ? 'completed' : ''}`} />
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
        const opponentId = nextMatch.player1Id === currentPlayerId ? nextMatch.player2Id : nextMatch.player1Id
        const tier = nextMatch.schedule?.schedulingTier
        const tierType = tier === 'auto' ? 'score' : tier === 'needs-accept' ? 'respond' : 'schedule'
        return (
          <div className={`card action-card action-${tierType}`}>
            <div className="action-card-type">Up Next</div>
            <div className="action-card-opponent">vs {getPlayerName(tournament, opponentId)}</div>
            <div className="action-card-detail">
              {nextMatch.schedule?.confirmedSlot
                ? formatMatchDate(nextMatch.schedule.confirmedSlot, weekGroups.get(1)?.weekStart)
                : 'No time set yet — tap to schedule'}
            </div>
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
              {matches.map((match, i) => {
                const opponentId = match.player1Id === currentPlayerId ? match.player2Id : match.player1Id
                const tier = match.schedule?.schedulingTier
                const slot = match.schedule?.confirmedSlot ?? match.schedule?.proposals?.[0]
                return (
                  <div
                    key={match.id}
                    className={`card action-card ${tier === 'auto' ? 'action-score' : tier === 'needs-accept' ? 'action-respond' : 'action-schedule'}`}
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <div className="action-card-type">
                      {tier === 'auto' ? 'Confirmed' : tier === 'needs-accept' ? 'Rally Suggested' : 'Schedule needed'}
                    </div>
                    <div className="action-card-opponent">vs {getPlayerName(tournament, opponentId)}</div>
                    <div className="action-card-detail">
                      {slot ? formatMatchDate(slot, weekStart) : 'No time set'}
                    </div>
                    {tier === 'needs-accept' && onConfirmMatch && (
                      <div className="action-card-buttons">
                        <button className="action-card-btn" onClick={(e) => { e.stopPropagation(); onConfirmMatch(match.id) }}>
                          Confirm Time
                        </button>
                      </div>
                    )}
                    {tier === 'needs-negotiation' && onScheduleMatch && (
                      <div className="action-card-buttons">
                        <button className="action-card-btn" onClick={(e) => { e.stopPropagation(); onScheduleMatch(match.id) }}>
                          Find a Time
                        </button>
                      </div>
                    )}
                  </div>
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
