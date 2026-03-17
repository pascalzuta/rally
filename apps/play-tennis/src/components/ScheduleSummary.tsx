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

function getWeekNumber(match: Match): number {
  // Use the scheduled slot's week if available, otherwise estimate from position
  if (match.schedule?.confirmedSlot) return 1
  return Math.ceil((match.position + 1) / 3)
}

function groupMatchesByWeek(matches: Match[]): Map<number, { matches: Match[]; weekStart: Date }> {
  const weeks = new Map<number, { matches: Match[]; weekStart: Date }>()

  // Assign weeks based on scheduling tier order
  const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  const scheduled = matches
    .filter(m => m.schedule && !m.completed)
    .sort((a, b) => {
      const slotA = a.schedule?.confirmedSlot ?? a.schedule?.proposals?.[0]
      const slotB = b.schedule?.confirmedSlot ?? b.schedule?.proposals?.[0]
      if (!slotA || !slotB) return 0
      return dayOrder.indexOf(slotA.day) - dayOrder.indexOf(slotB.day) || slotA.startHour - slotB.startHour
    })

  // Distribute into weeks (up to weeklyCap matches per player per week)
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
  const [animatedCount, setAnimatedCount] = useState(0)
  const [visible, setVisible] = useState(false)
  const animatedRef = useRef(false)

  const summary = getSchedulingSummary(tournament)
  const totalMatches = tournament.matches.filter(m => m.player1Id && m.player2Id).length

  // Count up animation
  useEffect(() => {
    if (!summary || animatedRef.current) return
    animatedRef.current = true
    setVisible(true)

    const target = summary.confirmed
    const duration = 600
    const startTime = performance.now()

    function animate(now: number) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease out quad
      const eased = 1 - (1 - progress) * (1 - progress)
      setAnimatedCount(Math.round(eased * target))
      if (progress < 1) requestAnimationFrame(animate)
    }

    requestAnimationFrame(animate)
  }, [summary])

  if (!summary) return null

  // Find next match for current player
  const myMatches = tournament.matches.filter(m =>
    (m.player1Id === currentPlayerId || m.player2Id === currentPlayerId) && !m.completed
  )
  const nextConfirmed = myMatches.find(m => m.schedule?.schedulingTier === 'auto' && m.schedule?.confirmedSlot)
  const nextMatch = nextConfirmed ?? myMatches[0]

  const confirmedPct = totalMatches > 0 ? (summary.confirmed / totalMatches) * 100 : 0
  const acceptPct = totalMatches > 0 ? (summary.needsAccept / totalMatches) * 100 : 0
  const negotiatePct = totalMatches > 0 ? (summary.needsNegotiation / totalMatches) * 100 : 0

  // Group my matches by week for the agenda
  const weekGroups = groupMatchesByWeek(myMatches)
  const getWeekLabel = (week: number, weekStart: Date) => {
    return week === 1 ? 'This Week' : `Week of ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
  }

  return (
    <div className={`schedule-summary-screen ${visible ? 'visible' : ''}`}>
      {/* Hero stat */}
      <div className="schedule-hero">
        <div className="schedule-hero-number">{animatedCount}</div>
        <div className="schedule-hero-qualifier">of {totalMatches} matches scheduled</div>
        <div className="schedule-hero-subtitle">Your tournament is ready.</div>
      </div>

      {/* Three-tier summary bar */}
      <div className="schedule-tier-bar">
        {confirmedPct > 0 && <div className="schedule-tier-segment tier-confirmed" style={{ width: `${confirmedPct}%` }} />}
        {acceptPct > 0 && <div className="schedule-tier-segment tier-proposed" style={{ width: `${acceptPct}%` }} />}
        {negotiatePct > 0 && <div className="schedule-tier-segment tier-negotiation" style={{ width: `${negotiatePct}%` }} />}
      </div>

      <div className="schedule-tier-labels">
        <span className="schedule-tier-label">
          <span className="schedule-tier-dot" style={{ background: 'var(--color-positive-primary)' }} />
          {summary.confirmed} Scheduled
        </span>
        {summary.needsAccept > 0 && (
          <span className="schedule-tier-label">
            <span className="schedule-tier-dot" style={{ background: 'var(--color-accent-primary)' }} />
            {summary.needsAccept} Need confirmation
          </span>
        )}
        {summary.needsNegotiation > 0 && (
          <span className="schedule-tier-label">
            <span className="schedule-tier-dot" style={{ background: 'var(--color-warning-primary, #F59E0B)' }} />
            {summary.needsNegotiation} Pick a time
          </span>
        )}
      </div>

      {/* Next match card */}
      {nextMatch && (
        <div className={`card match-card schedule-next-match-card ${nextMatch.schedule?.schedulingTier === 'auto' ? 'sched-confirmed' : nextMatch.schedule?.schedulingTier === 'needs-accept' ? 'sched-proposed' : 'sched-unscheduled'}`}>
          <div className="match-card-eyebrow" style={{ color: 'var(--color-positive-primary)' }}>NEXT MATCH</div>
          <div className="schedule-next-match-row">
            <span className="schedule-next-opponent">
              vs {getPlayerName(tournament, nextMatch.player1Id === currentPlayerId ? nextMatch.player2Id : nextMatch.player1Id)}
            </span>
            {nextMatch.schedule?.confirmedSlot && (
              <span className="schedule-next-time">
                {formatMatchDate(nextMatch.schedule.confirmedSlot, weekGroups.get(1)?.weekStart)}
              </span>
            )}
          </div>
          {nextMatch.schedule?.confirmedSlot && (
            <div className="schedule-next-reason">
              Both free {nextMatch.schedule.confirmedSlot.day.charAt(0).toUpperCase() + nextMatch.schedule.confirmedSlot.day.slice(1)} mornings
            </div>
          )}
        </div>
      )}

      {/* Week-by-week agenda */}
      {weekGroups.size > 0 && (
        <div className="schedule-agenda">
          <div className="schedule-agenda-title">Your Schedule</div>
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
                    className={`calendar-match ${tier === 'auto' ? 'calendar-match--auto' : tier === 'needs-accept' ? 'calendar-match--needs-accept' : 'calendar-match--needs-negotiation'}`}
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    {slot && (
                      <div className="calendar-match-time">{formatMatchDate(slot, weekStart)}</div>
                    )}
                    <div className="calendar-match-opponent">vs {getPlayerName(tournament, opponentId)}</div>
                    <div className={`calendar-match-status ${tier === 'auto' ? 'calendar-match-status--auto' : tier === 'needs-accept' ? 'calendar-match-status--accept' : 'calendar-match-status--negotiate'}`}>
                      {tier === 'auto' ? 'Confirmed' : tier === 'needs-accept' ? 'Awaiting confirmation' : 'Pick a time'}
                    </div>
                    {tier === 'needs-accept' && onConfirmMatch && (
                      <button className="match-card-action-btn match-card-action-btn--accept" onClick={(e) => { e.stopPropagation(); onConfirmMatch(match.id) }}>
                        Confirm
                      </button>
                    )}
                    {tier === 'needs-negotiation' && onScheduleMatch && (
                      <button className="match-card-action-btn match-card-action-btn--negotiate" onClick={(e) => { e.stopPropagation(); onScheduleMatch(match.id) }}>
                        Find a time
                      </button>
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
        View Full Bracket
      </button>
    </div>
  )
}
