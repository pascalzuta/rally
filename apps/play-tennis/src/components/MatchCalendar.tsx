import { Tournament, Match, SchedulingTier } from '../types'
import { getPlayerName, acceptProposal } from '../store'

interface Props {
  tournament: Tournament
  currentPlayerId: string
  onTournamentUpdated: () => void
  onExpandMatch?: (matchId: string) => void
}

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const DAY_LABELS: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
  friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
}

function formatSlotTime(slot: { day: string; startHour: number; endHour: number }): string {
  const day = DAY_LABELS[slot.day] ?? slot.day
  const period = slot.startHour >= 12 ? 'PM' : 'AM'
  const hour = slot.startHour % 12 || 12
  return `${day}, ${hour}:00 ${period}`
}

function formatScoreDisplay(match: Match): string {
  if (match.score1.length === 0) return ''
  return match.score1.map((s, i) => `${s}-${match.score2[i]}`).join(', ')
}

function getTier(match: Match): SchedulingTier | null {
  return match.schedule?.schedulingTier ?? null
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

function groupByWeek(matches: Match[]): Array<{ label: string; isCurrent: boolean; matches: Match[] }> {
  // Simple week grouping: distribute matches into weeks of ~3 each
  const weeks: Array<{ label: string; isCurrent: boolean; matches: Match[] }> = []
  const today = new Date()
  const perWeek = 3
  let weekIdx = 0

  for (let i = 0; i < matches.length; i += perWeek) {
    const batch = matches.slice(i, i + perWeek)
    const weekStart = new Date(today)
    weekStart.setDate(weekStart.getDate() + weekIdx * 7)
    const label = weekIdx === 0 ? 'This Week' : `Week of ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    weeks.push({ label, isCurrent: weekIdx === 0, matches: batch })
    weekIdx++
  }

  return weeks
}

export default function MatchCalendar({ tournament, currentPlayerId, onTournamentUpdated, onExpandMatch }: Props) {
  const allMatches = tournament.matches.filter(m => m.player1Id && m.player2Id)
  const sorted = sortMatchesForCalendar(allMatches, currentPlayerId)
  const weeks = groupByWeek(sorted)

  // Summary stats
  const confirmed = allMatches.filter(m => m.schedule?.schedulingTier === 'auto').length
  const pending = allMatches.filter(m => m.schedule?.schedulingTier === 'needs-accept').length
  const unscheduled = allMatches.filter(m => m.schedule?.schedulingTier === 'needs-negotiation').length
  const completed = allMatches.filter(m => m.completed).length

  async function handleConfirm(match: Match) {
    if (!match.schedule?.proposals?.length) return
    const pendingProposal = match.schedule.proposals.find(p => p.status === 'pending')
    if (!pendingProposal) return
    await acceptProposal(tournament.id, match.id, pendingProposal.id, currentPlayerId)
    onTournamentUpdated()
  }

  return (
    <div className="match-calendar">
      {/* Summary strip */}
      <div className="schedule-summary-strip">
        <div className="schedule-summary-stats">
          <span className="schedule-stat schedule-stat--confirmed">{confirmed} <span className="schedule-stat-label">Scheduled</span></span>
          <span className="schedule-stat-sep">&middot;</span>
          <span className="schedule-stat schedule-stat--pending">{pending} <span className="schedule-stat-label">Pending</span></span>
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
            const isMyMatch = match.player1Id === currentPlayerId || match.player2Id === currentPlayerId
            const tier = getTier(match)
            const slot = match.schedule?.confirmedSlot ?? match.schedule?.proposals?.[0]
            const isCompleted = match.completed
            const didWin = match.winnerId === currentPlayerId
            const score = formatScoreDisplay(match)

            const tierClass = isCompleted
              ? (didWin ? 'calendar-match--won' : 'calendar-match--lost')
              : tier === 'auto' ? 'calendar-match--auto'
              : tier === 'needs-accept' ? 'calendar-match--needs-accept'
              : 'calendar-match--needs-negotiation'

            return (
              <div
                key={match.id}
                className={`calendar-match ${tierClass} ${isMyMatch ? 'calendar-match--mine' : ''}`}
                onClick={() => onExpandMatch?.(match.id)}
              >
                {/* Eyebrow */}
                <div className={`calendar-match-eyebrow ${
                  isCompleted ? 'calendar-match-eyebrow--completed' :
                  tier === 'auto' ? 'calendar-match-eyebrow--confirmed' :
                  tier === 'needs-accept' ? 'calendar-match-eyebrow--proposed' :
                  'calendar-match-eyebrow--unscheduled'
                }`}>
                  {isCompleted ? 'COMPLETED' :
                   tier === 'auto' ? 'SCHEDULED' :
                   tier === 'needs-accept' ? 'SUGGESTED TIME' :
                   'PICK A TIME'}
                </div>

                {/* Match content */}
                <div className="calendar-match-body">
                  <div className="calendar-match-opponent">vs {getPlayerName(tournament, opponentId)}</div>
                  {slot && !isCompleted ? (
                    <div className="calendar-match-time">{formatSlotTime(slot)}</div>
                  ) : isCompleted && score ? (
                    <div className="calendar-match-score">{score}</div>
                  ) : (
                    <div className="calendar-match-time calendar-match-time--none">No time set</div>
                  )}
                </div>

                {/* Detail text */}
                {!isCompleted && tier === 'needs-accept' && isMyMatch && (
                  <div className="calendar-match-detail">
                    {getPlayerName(tournament, opponentId)} is free then. Tap to confirm or pick another time.
                  </div>
                )}
                {!isCompleted && tier === 'needs-negotiation' && isMyMatch && (
                  <div className="calendar-match-detail">
                    Your schedules don't overlap much. Send {getPlayerName(tournament, opponentId)} a few options.
                  </div>
                )}

                {/* Action button */}
                {!isCompleted && isMyMatch && tier === 'needs-accept' && (
                  <div className="calendar-match-actions">
                    <button className="match-card-action-btn match-card-action-btn--accept" onClick={(e) => { e.stopPropagation(); handleConfirm(match) }}>
                      Confirm
                    </button>
                  </div>
                )}
                {!isCompleted && isMyMatch && tier === 'needs-negotiation' && (
                  <div className="calendar-match-actions">
                    <button className="match-card-action-btn match-card-action-btn--negotiate" onClick={(e) => { e.stopPropagation(); onExpandMatch?.(match.id) }}>
                      Find a time
                    </button>
                  </div>
                )}

                {/* Reschedule link for confirmed */}
                {!isCompleted && isMyMatch && tier === 'auto' && (
                  <div className="calendar-match-actions">
                    <button className="btn-link calendar-reschedule-link" onClick={(e) => { e.stopPropagation(); onExpandMatch?.(match.id) }}>
                      Reschedule
                    </button>
                  </div>
                )}
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
