import { useState } from 'react'
import { Tournament, Match, SchedulingTier } from '../types'
import { getPlayerName, hasUnreadFrom } from '../store'
import MessagePanel from './MessagePanel'
import UpcomingMatchPanel from './UpcomingMatchPanel'
import { canExpandMatch } from '../matchCapabilities'

interface Props {
  tournament: Tournament
  currentPlayerId: string
  currentPlayerName: string
  onTournamentUpdated: () => void
}

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
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

function formatSlotTime(slot: { day: string; startHour: number; endHour: number }, weekStart?: Date): string {
  const period = slot.startHour >= 12 ? 'PM' : 'AM'
  const hour = slot.startHour % 12 || 12
  if (weekStart) {
    const date = resolveDate(weekStart, slot.day)
    const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    return `${dayLabel}, ${hour}:00 ${period}`
  }
  const dayLabel = (slot.day.charAt(0).toUpperCase() + slot.day.slice(1, 3))
  return `${dayLabel}, ${hour}:00 ${period}`
}

function formatScoreDisplay(match: Match): string {
  if (match.score1.length === 0) return ''
  return match.score1.map((s, i) => `${s}-${match.score2[i]}`).join(', ')
}

function getTier(match: Match): SchedulingTier | null {
  return match.schedule?.schedulingTier ?? null
}

function getPrimaryActionLabel(match: Match): string {
  const tier = getTier(match)
  if (tier === 'auto') return 'View Match'
  if (tier === 'needs-accept') return 'Confirm Time'
  return 'Find a Time'
}

function getTierTone(tier: SchedulingTier | null, isCompleted: boolean): 'green' | 'blue' | 'amber' | 'slate' {
  if (isCompleted) return 'slate'
  if (tier === 'auto') return 'green'
  if (tier === 'needs-accept') return 'blue'
  return 'amber'
}

function sortMatchesForCalendar(matches: Match[], currentPlayerId: string): Match[] {
  return [...matches].sort((a, b) => {
    // Completed matches last
    if (a.completed !== b.completed) return a.completed ? 1 : -1
    // My matches first
    const aIsMine = a.player1Id === currentPlayerId || a.player2Id === currentPlayerId
    const bIsMine = b.player1Id === currentPlayerId || b.player2Id === currentPlayerId
    if (aIsMine !== bIsMine) return aIsMine ? -1 : 1
    // By tier: auto first, then needs-accept, then needs-negotiation
    const tierOrder: Record<string, number> = { auto: 0, 'needs-accept': 1, 'needs-negotiation': 2 }
    const tierA = tierOrder[a.schedule?.schedulingTier ?? 'needs-negotiation'] ?? 2
    const tierB = tierOrder[b.schedule?.schedulingTier ?? 'needs-negotiation'] ?? 2
    if (tierA !== tierB) return tierA - tierB
    // By day
    const slotA = a.schedule?.confirmedSlot ?? a.schedule?.proposals?.[0]
    const slotB = b.schedule?.confirmedSlot ?? b.schedule?.proposals?.[0]
    if (slotA && slotB) {
      return DAY_ORDER.indexOf(slotA.day) - DAY_ORDER.indexOf(slotB.day) || slotA.startHour - slotB.startHour
    }
    return 0
  })
}

function groupByWeek(matches: Match[]): Array<{ label: string; isCurrent: boolean; matches: Match[]; weekStart: Date }> {
  // Simple week grouping: distribute matches into weeks of ~3 each
  const weeks: Array<{ label: string; isCurrent: boolean; matches: Match[]; weekStart: Date }> = []
  const today = new Date()
  // Align to Monday of current week
  const mondayOffset = (today.getDay() + 6) % 7 // days since Monday
  const thisMonday = new Date(today)
  thisMonday.setDate(today.getDate() - mondayOffset)
  thisMonday.setHours(0, 0, 0, 0)
  const perWeek = 3
  let weekIdx = 0

  for (let i = 0; i < matches.length; i += perWeek) {
    const batch = matches.slice(i, i + perWeek)
    const weekStart = new Date(thisMonday)
    weekStart.setDate(thisMonday.getDate() + weekIdx * 7)
    const label = weekIdx === 0 ? 'This Week' : `Week of ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    weeks.push({ label, isCurrent: weekIdx === 0, matches: batch, weekStart })
    weekIdx++
  }

  return weeks
}

export default function MatchCalendar({ tournament, currentPlayerId, currentPlayerName, onTournamentUpdated }: Props) {
  const [messagingMatchId, setMessagingMatchId] = useState<string | null>(null)
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null)
  const allMatches = tournament.matches.filter(m => m.player1Id && m.player2Id)
  const sorted = sortMatchesForCalendar(allMatches, currentPlayerId)
  const weeks = groupByWeek(sorted)

  // Summary stats
  const confirmed = allMatches.filter(m => m.schedule?.schedulingTier === 'auto').length
  const pending = allMatches.filter(m => m.schedule?.schedulingTier === 'needs-accept').length
  const unscheduled = allMatches.filter(m => m.schedule?.schedulingTier === 'needs-negotiation').length
  const completed = allMatches.filter(m => m.completed).length

  return (
    <div className="match-calendar">
      {/* Summary strip */}
      <div className="schedule-summary-strip">
        <div className="schedule-summary-stats">
          <span className="schedule-stat schedule-stat--confirmed">{confirmed} <span className="schedule-stat-label">Scheduled</span></span>
          <span className="schedule-stat-sep">&middot;</span>
          <span className="schedule-stat schedule-stat--pending">{pending} <span className="schedule-stat-label">In progress</span></span>
          <span className="schedule-stat-sep">&middot;</span>
          <span className="schedule-stat schedule-stat--unscheduled">{unscheduled} <span className="schedule-stat-label">Unscheduled</span></span>
          {completed > 0 && (
            <>
              <span className="schedule-stat-sep">&middot;</span>
              <span className="schedule-stat">{completed} <span className="schedule-stat-label">Played</span></span>
            </>
          )}
        </div>
      </div>

      {/* Week-by-week agenda */}
      {weeks.map((week, weekIdx) => (
        <div key={weekIdx} className="schedule-week">
          <div className="schedule-week-header">
            <span className={`calendar-week-dot ${week.isCurrent ? 'calendar-week-dot--current' : 'calendar-week-dot--future'}`} />
            {week.label}
          </div>

          {week.matches.map(match => {
            const opponentId = match.player1Id === currentPlayerId ? match.player2Id : match.player1Id
            const opponentName = getPlayerName(tournament, opponentId)
            const isMyMatch = match.player1Id === currentPlayerId || match.player2Id === currentPlayerId
            const tier = getTier(match)
            const slot = match.schedule?.confirmedSlot ?? match.schedule?.proposals?.[0]
            const isCompleted = match.completed
            const score = formatScoreDisplay(match)
            const isMessaging = messagingMatchId === match.id
            const msgUnread = isMyMatch && opponentId ? hasUnreadFrom(currentPlayerId, opponentId) : false

            return (
              <div key={match.id}>
                <div
                  className={`card action-card ${isCompleted ? 'action-completed' : tier === 'auto' ? 'action-confirmed' : tier === 'needs-accept' ? 'action-respond' : 'action-schedule'} ${isMyMatch ? 'calendar-match--mine' : ''}`}
                  onClick={() => {
                    if (!canExpandMatch(match, currentPlayerId)) return
                    setMessagingMatchId(null)
                    setExpandedMatchId(expandedMatchId === match.id ? null : match.id)
                  }}
                >
                  <div className="action-card-status-row">
                    <div className={`card-status-label card-status-label--${getTierTone(tier, isCompleted)}`}>
                      {isCompleted ? 'Completed' :
                       tier === 'auto' ? 'Confirmed' :
                       tier === 'needs-accept' ? 'Needs Response' :
                       'Needs Scheduling'}
                    </div>
                    {slot && !isCompleted && <div className="card-meta-chip">{formatSlotTime(slot, week.weekStart)}</div>}
                  </div>
                  <div className="action-card-main">
                    <div className="action-card-opponent">vs {opponentName}</div>
                    <div className="action-card-supporting">
                      {isCompleted
                        ? (score || 'Final score recorded.')
                        : tier === 'auto'
                          ? 'Confirmed and ready to play.'
                          : tier === 'needs-accept'
                            ? 'Review the proposed time and confirm if it works.'
                            : 'Set a time with your opponent.'}
                    </div>
                  </div>
                  <div className="action-card-buttons">
                    {!isCompleted && (
                      <button
                        className="action-card-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (!canExpandMatch(match, currentPlayerId)) return
                          setMessagingMatchId(null)
                          setExpandedMatchId(expandedMatchId === match.id ? null : match.id)
                        }}
                      >
                        {getPrimaryActionLabel(match)}
                      </button>
                    )}
                    {isMyMatch && opponentId && (
                      <button
                        className={`match-card-msg-btn ${isMessaging ? 'active' : ''}`}
                        onClick={e => {
                          e.stopPropagation()
                          setExpandedMatchId(null)
                          setMessagingMatchId(isMessaging ? null : match.id)
                        }}
                        aria-label="Message opponent"
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M2 3h12v8H4l-2 2V3z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                        </svg>
                        {msgUnread && <span className="msg-unread-dot" />}
                      </button>
                    )}
                  </div>
                  {isMessaging && opponentId && (
                    <div className="action-card-expansion" onClick={e => e.stopPropagation()}>
                      <MessagePanel
                        currentPlayerId={currentPlayerId}
                        currentPlayerName={currentPlayerName}
                        otherPlayerId={opponentId}
                        otherPlayerName={opponentName}
                        onClose={() => setMessagingMatchId(null)}
                      />
                    </div>
                  )}
                  {expandedMatchId === match.id && (
                    <div className="action-card-expansion" onClick={e => e.stopPropagation()}>
                      <UpcomingMatchPanel
                        tournament={tournament}
                        match={match}
                        currentPlayerId={currentPlayerId}
                        mode="schedule"
                        onUpdated={() => {
                          setExpandedMatchId(null)
                          onTournamentUpdated()
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {week.matches.length === 0 && (
            <div className="calendar-empty-week">No matches this week. Enjoy the break.</div>
          )}
        </div>
      ))}
    </div>
  )
}
