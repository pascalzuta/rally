import { useState } from 'react'
import {
  acceptProposal,
  proposeNewSlots,
  cancelMatch,
  getProfile,
  requestSoftReschedule,
  requestHardReschedule,
  counterReschedule,
  declineSoftReschedule,
  withdrawSoftReschedule,
  getRescheduleUiState,
} from '../store'
import { Match, Tournament, DayOfWeek, MatchProposal, MatchSlot, RescheduleIntent, RescheduleReason } from '../types'

interface Props {
  tournament: Tournament
  match: Match
  currentPlayerId: string
  onUpdated: () => void
}

const DAYS: { key: DayOfWeek; label: string; short: string }[] = [
  { key: 'monday', label: 'Monday', short: 'Mon' },
  { key: 'tuesday', label: 'Tuesday', short: 'Tue' },
  { key: 'wednesday', label: 'Wednesday', short: 'Wed' },
  { key: 'thursday', label: 'Thursday', short: 'Thu' },
  { key: 'friday', label: 'Friday', short: 'Fri' },
  { key: 'saturday', label: 'Saturday', short: 'Sat' },
  { key: 'sunday', label: 'Sunday', short: 'Sun' },
]

const DAY_INDEX: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
}

const CANCEL_REASONS = ['Schedule conflict', 'Injury', 'Other'] as const
const RESCHEDULE_REASON_OPTIONS: Array<{ value: RescheduleReason; label: string }> = [
  { value: 'conflict', label: 'Schedule conflict' },
  { value: 'weather', label: 'Weather' },
  { value: 'court_issue', label: 'Court issue' },
  { value: 'injury_illness', label: 'Injury / illness' },
  { value: 'other', label: 'Other' },
]

function resolveNextDate(dayOfWeek: string): Date {
  const today = new Date()
  const target = DAY_INDEX[dayOfWeek] ?? 1
  const current = today.getDay()
  const diff = (target - current + 7) % 7
  const result = new Date(today)
  result.setDate(today.getDate() + diff)
  return result
}

function formatHour(h: number): string {
  const whole = Math.floor(h)
  const half = h % 1 >= 0.5
  const suffix = half ? ':30' : ''
  if (whole === 0 || whole === 24) return `12${suffix}am`
  if (whole === 12) return `12${suffix}pm`
  return whole < 12 ? `${whole}${suffix}am` : `${whole - 12}${suffix}pm`
}

function dayLabel(day: DayOfWeek): string {
  const date = resolveNextDate(day)
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

function dayLabelShort(day: DayOfWeek): string {
  const date = resolveNextDate(day)
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function proposalLabel(p: MatchProposal): string {
  return `${dayLabelShort(p.day)} ${formatHour(p.startHour)}\u2013${formatHour(p.endHour)}`
}

function slotLabel(slot: MatchSlot): string {
  return `${dayLabelShort(slot.day)} ${formatHour(slot.startHour)}\u2013${formatHour(slot.endHour)}`
}

function getVenueSuggestion(
  tournament: Tournament,
  match: Match,
  currentPlayerId: string
): string | null {
  const profile = getProfile()
  if (!profile) return null

  const currentCourts = profile.preferredCourts ?? []
  const opponentId = match.player1Id === currentPlayerId ? match.player2Id : match.player1Id
  const opponentName = tournament.players.find(p => p.id === opponentId)?.name?.split(' ')[0] ?? 'Opponent'

  // We only have access to the current player's profile via localStorage.
  // If the current player has preferred courts, show them as a suggestion.
  if (currentCourts.length > 0) {
    return `Venue: ${currentCourts.join(', ')}`
  }

  return null
}

export default function MatchSchedulePanel({ tournament, match, currentPlayerId, onUpdated }: Props) {
  const [showPropose, setShowPropose] = useState(false)
  const [propDay, setPropDay] = useState<DayOfWeek | ''>('')
  const [propStart, setPropStart] = useState(18)
  const [propEnd, setPropEnd] = useState(20)

  // Reschedule state
  const [showReschedule, setShowReschedule] = useState(false)
  const [rescheduleIntent, setRescheduleIntent] = useState<RescheduleIntent>('soft')
  const [rescheduleReason, setRescheduleReason] = useState<RescheduleReason>('conflict')
  const [rescheduleNote, setRescheduleNote] = useState('')
  const [reschedDay, setReschedDay] = useState<DayOfWeek | ''>('')
  const [reschedStart, setReschedStart] = useState(18)
  const [reschedEnd, setReschedEnd] = useState(20)

  // Cancel state
  const [showCancel, setShowCancel] = useState(false)
  const [cancelReason, setCancelReason] = useState<string>('')

  const schedule = match.schedule
  if (!schedule) return null

  const pendingProposals = schedule.proposals.filter(p => p.status === 'pending')
  const acceptableProposals = pendingProposals.filter(p => p.proposedBy !== currentPlayerId)
  const myPendingProposals = pendingProposals.filter(p => p.proposedBy === currentPlayerId)
  const rescheduleCount = schedule.rescheduleCount ?? 0
  const canReschedule = rescheduleCount < 2
  const activeRequest = schedule.activeRescheduleRequest
  const rescheduleUiState = getRescheduleUiState(match, currentPlayerId)
  const latestHistory = schedule.scheduleHistory?.[schedule.scheduleHistory.length - 1]
  const opponentId = match.player1Id === currentPlayerId ? match.player2Id : match.player1Id
  const opponentName = tournament.players.find(p => p.id === opponentId)?.name?.split(' ')[0] ?? 'Opponent'
  const hasCustomRescheduleSlot = Boolean(reschedDay) && reschedStart < reschedEnd

  function resetRescheduleForm() {
    setShowReschedule(false)
    setRescheduleIntent('soft')
    setRescheduleReason('conflict')
    setRescheduleNote('')
    setReschedDay('')
    setReschedStart(18)
    setReschedEnd(20)
  }

  function getRescheduleSlots(): MatchSlot[] {
    if (!reschedDay || reschedStart >= reschedEnd) return []
    return [{ day: reschedDay as DayOfWeek, startHour: reschedStart, endHour: reschedEnd }]
  }

  async function handleAccept(proposalId: string) {
    await acceptProposal(tournament.id, match.id, proposalId, currentPlayerId)
    onUpdated()
  }

  async function handlePropose() {
    if (!propDay || propStart >= propEnd) return
    await proposeNewSlots(tournament.id, match.id, currentPlayerId, [
      { day: propDay as DayOfWeek, startHour: propStart, endHour: propEnd }
    ])
    setShowPropose(false)
    setPropDay('')
    onUpdated()
  }

  async function handleReschedule() {
    const slots = getRescheduleSlots()
    if (activeRequest) {
      if (slots.length === 0) return
      await counterReschedule(tournament.id, match.id, currentPlayerId, slots, rescheduleNote)
      resetRescheduleForm()
      onUpdated()
      return
    }

    if (rescheduleIntent === 'soft') {
      if (slots.length === 0) return
      await requestSoftReschedule(
        tournament.id,
        match.id,
        currentPlayerId,
        rescheduleReason,
        slots,
        rescheduleNote,
      )
    } else {
      await requestHardReschedule(
        tournament.id,
        match.id,
        currentPlayerId,
        rescheduleReason,
        slots,
        rescheduleNote,
      )
    }
    resetRescheduleForm()
    onUpdated()
  }

  async function handleCancelMatch() {
    if (!cancelReason) return
    await cancelMatch(tournament.id, match.id, cancelReason)
    setShowCancel(false)
    setCancelReason('')
    onUpdated()
  }

  async function handleDeclineSoftRequest() {
    await declineSoftReschedule(tournament.id, match.id, currentPlayerId)
    onUpdated()
  }

  async function handleWithdrawSoftRequest() {
    await withdrawSoftReschedule(tournament.id, match.id, currentPlayerId)
    onUpdated()
  }

  function renderRescheduleForm(mode: 'new' | 'counter') {
    const isCounter = mode === 'counter'
    const canSubmit = isCounter
      ? hasCustomRescheduleSlot
      : rescheduleIntent === 'hard'
        ? true
        : hasCustomRescheduleSlot

    return (
      <div className="propose-form" onClick={e => e.stopPropagation()}>
        <div className="propose-form-title">
          {isCounter ? 'Suggest another time' : 'Change match time'}
        </div>
        {!isCounter && (
          <>
            <div className="cancel-reasons">
              <button
                className={`cancel-reason-btn ${rescheduleIntent === 'soft' ? 'selected' : ''}`}
                onClick={() => setRescheduleIntent('soft')}
              >
                Ask to move it
              </button>
              <button
                className={`cancel-reason-btn ${rescheduleIntent === 'hard' ? 'selected' : ''}`}
                onClick={() => setRescheduleIntent('hard')}
              >
                I can&apos;t make this time
              </button>
            </div>
            <div className="cancel-reasons">
              {RESCHEDULE_REASON_OPTIONS.map(option => (
                <button
                  key={option.value}
                  className={`cancel-reason-btn ${rescheduleReason === option.value ? 'selected' : ''}`}
                  onClick={() => setRescheduleReason(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </>
        )}
        <div className="proposal-from">
          {isCounter
            ? 'Send another option that works better for you.'
            : rescheduleIntent === 'hard'
              ? 'This cancels the current confirmed time. You can still send a replacement now, or leave it blank and ask for a new time.'
              : 'The current confirmed time stays on until a new one is accepted.'}
        </div>
        <div className="propose-row">
          <select value={reschedDay} onChange={e => setReschedDay(e.target.value as DayOfWeek | '')}>
            <option value="">{isCounter || rescheduleIntent === 'soft' ? 'New day...' : 'Optional day...'}</option>
            {DAYS.map(d => <option key={d.key} value={d.key}>{dayLabelShort(d.key)}</option>)}
          </select>
          <select value={reschedStart} onChange={e => setReschedStart(Number(e.target.value))}>
            {Array.from({ length: 16 }, (_, i) => i + 6).map(h => (
              <option key={h} value={h}>{formatHour(h)}</option>
            ))}
          </select>
          <span>{'\u2013'}</span>
          <select value={reschedEnd} onChange={e => setReschedEnd(Number(e.target.value))}>
            {Array.from({ length: 16 }, (_, i) => i + 7).map(h => (
              <option key={h} value={h}>{formatHour(h)}</option>
            ))}
          </select>
        </div>
        <textarea
          className="profile-bio-input"
          rows={2}
          value={rescheduleNote}
          onChange={e => setRescheduleNote(e.target.value)}
          placeholder="Optional note"
        />
        <div className="propose-actions">
          <button className="btn btn-primary btn-small" onClick={handleReschedule} disabled={!canSubmit}>
            {isCounter ? 'Send New Option' : rescheduleIntent === 'hard' ? 'Send Needs-New-Time' : 'Send Request'}
          </button>
          <button className="btn btn-small" onClick={(e) => { e.stopPropagation(); resetRescheduleForm() }}>
            Back
          </button>
        </div>
      </div>
    )
  }

  // Confirmed state
  if (schedule.status === 'confirmed' && schedule.confirmedSlot) {
    const s = schedule.confirmedSlot
    const venue = getVenueSuggestion(tournament, match, currentPlayerId)
    const lastRescheduled = latestHistory?.type === 'rescheduled' && latestHistory.fromSlot
      ? `${dayLabel(latestHistory.fromSlot.day)} ${formatHour(latestHistory.fromSlot.startHour)}${'\u2013'}${formatHour(latestHistory.fromSlot.endHour)}`
      : null
    return (
      <div className="schedule-panel schedule-confirmed schedule-panel--success">
        <div className={`schedule-status-badge ${
          rescheduleUiState === 'soft_request_sent' || rescheduleUiState === 'soft_request_received'
            ? 'badge-proposed'
            : 'badge-confirmed'
        }`}>
          {rescheduleUiState === 'soft_request_sent'
            ? 'Reschedule Requested'
            : rescheduleUiState === 'soft_request_received'
              ? 'Change Requested'
              : 'Confirmed'}
        </div>
        <div className="schedule-panel-copy">This match is locked in. Use chat for court details, then report the score here after you play.</div>
        <div className="confirmed-slot">
          <span className="confirmed-day">{dayLabel(s.day)}</span>
          <span className="confirmed-time">{formatHour(s.startHour)}{'\u2013'}{formatHour(s.endHour)}</span>
        </div>
        {venue ? <div className="venue-suggestion">{venue}</div> : null}
        {lastRescheduled ? (
          <div className="reschedule-count-info">Rescheduled from {lastRescheduled}</div>
        ) : null}

        {rescheduleCount > 0 && (
          <div className="reschedule-count-info">
            Rescheduled {rescheduleCount} of 2 times
          </div>
        )}
        {!canReschedule && (
          <div className="reschedule-limit-warning">Maximum reschedules reached</div>
        )}

        {rescheduleUiState === 'soft_request_sent' && (
          <>
            <div className="proposal-from">
              Your match stays on at the current time unless {opponentName} accepts a new one.
            </div>
            {pendingProposals.length > 0 && (
              <div className="proposal-list">
                {pendingProposals.map(p => (
                  <div key={p.id} className="proposal-card proposal-mine">
                    <div className="proposal-info">
                      <span className="proposal-time">{proposalLabel(p)}</span>
                      <span className="proposal-from">Waiting for response</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {rescheduleUiState === 'soft_request_received' && (
          <>
            <div className="proposal-from">
              {opponentName} asked to move this match. The current time still stands unless you accept a new one.
            </div>
            {pendingProposals.length > 0 && (
              <div className="proposal-list">
                {pendingProposals.map(p => (
                  <div key={p.id} className="proposal-card">
                    <div className="proposal-info">
                      <span className="proposal-time">{proposalLabel(p)}</span>
                      <span className="proposal-from">New option from {opponentName}</span>
                    </div>
                    <button
                      className="btn btn-primary btn-small"
                      onClick={(e) => { e.stopPropagation(); handleAccept(p.id) }}
                    >
                      Accept New Time
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {showReschedule ? renderRescheduleForm(activeRequest ? 'counter' : 'new') : showCancel ? (
          <div className="propose-form cancel-form" onClick={e => e.stopPropagation()}>
            <div className="propose-form-title">Cancel match</div>
            <p className="cancel-warning">Your opponent will be awarded a walkover win.</p>
            <div className="cancel-reasons">
              {CANCEL_REASONS.map(reason => (
                <button
                  key={reason}
                  className={`cancel-reason-btn ${cancelReason === reason ? 'selected' : ''}`}
                  onClick={() => setCancelReason(reason)}
                >
                  {reason}
                </button>
              ))}
            </div>
            <div className="propose-actions">
              <button
                className="btn btn-danger btn-small"
                onClick={handleCancelMatch}
                disabled={!cancelReason}
              >
                Confirm Cancellation
              </button>
              <button className="btn btn-small" onClick={(e) => { e.stopPropagation(); setShowCancel(false); setCancelReason('') }}>
                Back
              </button>
            </div>
          </div>
        ) : (
          <div className="schedule-panel-actions confirmed-actions">
            {rescheduleUiState === 'soft_request_sent' && (
              <button
                className="schedule-panel-link"
                onClick={(e) => { e.stopPropagation(); handleWithdrawSoftRequest() }}
              >
                Withdraw Request
              </button>
            )}
            {rescheduleUiState === 'soft_request_received' && (
              <>
                <button
                  className="schedule-panel-link"
                  onClick={(e) => { e.stopPropagation(); setShowReschedule(true) }}
                >
                  Suggest Another
                </button>
                <button
                  className="schedule-panel-link"
                  onClick={(e) => { e.stopPropagation(); handleDeclineSoftRequest() }}
                >
                  Keep Current Time
                </button>
              </>
            )}
            {rescheduleUiState === 'none' && canReschedule && (
              <button
                className="schedule-panel-link"
                onClick={(e) => { e.stopPropagation(); setShowReschedule(true) }}
              >
                Change Time
              </button>
            )}
            <button
              className="schedule-panel-link schedule-panel-link--danger"
              onClick={(e) => { e.stopPropagation(); setShowCancel(true) }}
            >
              Cancel Match
            </button>
          </div>
        )}
      </div>
    )
  }

  // Hard reschedule state
  if ((schedule.status === 'proposed' || schedule.status === 'unscheduled') && activeRequest?.intent === 'hard') {
    const original = activeRequest.originalSlot
    return (
      <div className="schedule-panel">
        <div className="schedule-status-badge badge-escalated">Needs New Time</div>
        <div className="proposal-from">
          {rescheduleUiState === 'hard_request_sent'
            ? 'You canceled the original confirmed time.'
            : `${opponentName} can no longer make the original confirmed time.`}
        </div>
        <div className="proposal-card proposal-mine">
          <div className="proposal-info">
            <span className="proposal-time">{slotLabel(original)}</span>
            <span className="proposal-from">Original time canceled</span>
          </div>
        </div>

        {pendingProposals.length > 0 && (
          <div className="proposal-list">
            {pendingProposals.map(p => (
              <div key={p.id} className={`proposal-card ${p.proposedBy === currentPlayerId ? 'proposal-mine' : ''}`}>
                <div className="proposal-info">
                  <span className="proposal-time">{proposalLabel(p)}</span>
                  <span className="proposal-from">
                    {p.proposedBy === currentPlayerId ? 'Your option' : `Option from ${opponentName}`}
                  </span>
                </div>
                {p.proposedBy !== currentPlayerId && (
                  <button
                    className="btn btn-primary btn-small"
                    onClick={(e) => { e.stopPropagation(); handleAccept(p.id) }}
                  >
                    Accept New Time
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {showReschedule ? renderRescheduleForm('counter') : showCancel ? (
          <div className="propose-form cancel-form" onClick={e => e.stopPropagation()}>
            <div className="propose-form-title">Cancel match</div>
            <p className="cancel-warning">Your opponent will be awarded a walkover win.</p>
            <div className="cancel-reasons">
              {CANCEL_REASONS.map(reason => (
                <button
                  key={reason}
                  className={`cancel-reason-btn ${cancelReason === reason ? 'selected' : ''}`}
                  onClick={() => setCancelReason(reason)}
                >
                  {reason}
                </button>
              ))}
            </div>
            <div className="propose-actions">
              <button
                className="btn btn-danger btn-small"
                onClick={handleCancelMatch}
                disabled={!cancelReason}
              >
                Confirm Cancellation
              </button>
              <button className="btn btn-small" onClick={(e) => { e.stopPropagation(); setShowCancel(false); setCancelReason('') }}>
                Back
              </button>
            </div>
          </div>
        ) : (
          <div className="confirmed-actions">
            <button
              className="btn-link propose-link"
              onClick={(e) => { e.stopPropagation(); setShowReschedule(true) }}
            >
              Suggest Another
            </button>
            <button
              className="btn-link propose-link cancel-link"
              onClick={(e) => { e.stopPropagation(); setShowCancel(true) }}
            >
              Cancel Match
            </button>
          </div>
        )}
      </div>
    )
  }

  // Resolved state
  if (schedule.status === 'resolved' && schedule.resolution) {
    const r = schedule.resolution
    if (r.type === 'walkover') {
      const winnerName = tournament.players.find(p => p.id === r.winnerId)?.name ?? 'Unknown'
      const isWinner = r.winnerId === currentPlayerId
      return (
        <div className="schedule-panel schedule-panel--danger">
          <div className="schedule-status-badge badge-walkover">Match Awarded</div>
          <div className="schedule-panel-copy resolution-detail">
            {isWinner
              ? 'Your opponent did not participate in scheduling. You have been awarded the match.'
              : `${winnerName} was awarded the match. Opponent did not participate in scheduling.`}
          </div>
        </div>
      )
    }
    if (r.type === 'forced-match' && r.forcedSlot) {
      return (
        <div className="schedule-panel schedule-panel--info">
          <div className="schedule-status-badge badge-forced">Final Match Assigned</div>
          <div className="schedule-panel-copy resolution-detail">Both players participated but could not agree on a time. Rally assigned the final slot below.</div>
          <div className="confirmed-slot">
            <span className="confirmed-day">{dayLabel(r.forcedSlot.day)}</span>
            <span className="confirmed-time">{formatHour(r.forcedSlot.startHour)}{'\u2013'}{formatHour(r.forcedSlot.endHour)}</span>
          </div>
        </div>
      )
    }
    if (r.type === 'double-loss') {
      return (
        <div className="schedule-panel schedule-panel--danger">
          <div className="schedule-status-badge badge-double-loss">Match Canceled</div>
          <div className="schedule-panel-copy resolution-detail">Neither player participated in scheduling. Both players receive a loss.</div>
        </div>
      )
    }
  }

  // Escalated state
  if (schedule.status === 'escalated') {
    const day = schedule.escalationDay ?? 0
    const daysLeft = Math.max(0, 4 - day)
    return (
      <div className="schedule-panel schedule-escalated schedule-panel--danger">
        <div className="schedule-status-badge badge-escalated">Needs Resolution</div>
        <div className="escalation-timeline">
          <div className="escalation-bar">
            <div className="escalation-fill" style={{ width: `${Math.min(100, (day / 4) * 100)}%` }} />
          </div>
          <div className="escalation-days">Day {day} of 4</div>
        </div>
        <div className="escalation-info">
          {daysLeft > 0 ? (
            <p className="escalation-warning">
              {daysLeft} day{daysLeft !== 1 ? 's' : ''} remaining before auto-resolution. Propose a time or accept a proposal to avoid a walkover.
            </p>
          ) : (
            <p className="escalation-warning escalation-critical">
              Deadline reached. The match will be auto-resolved (walkover, forced time, or double loss).
            </p>
          )}
        </div>

        {!showPropose ? (
          <button
            className="match-card-action-btn match-card-action-btn--negotiate"
            onClick={(e) => { e.stopPropagation(); setShowPropose(true) }}
          >
            Respond Now
          </button>
        ) : (
          <div className="propose-form" onClick={e => e.stopPropagation()}>
            <div className="propose-row">
              <select value={propDay} onChange={e => setPropDay(e.target.value as DayOfWeek | '')}>
                <option value="">Day...</option>
                {DAYS.map(d => <option key={d.key} value={d.key}>{dayLabelShort(d.key)}</option>)}
              </select>
              <select value={propStart} onChange={e => setPropStart(Number(e.target.value))}>
                {Array.from({ length: 16 }, (_, i) => i + 6).map(h => (
                  <option key={h} value={h}>{formatHour(h)}</option>
                ))}
              </select>
              <span>{'\u2013'}</span>
              <select value={propEnd} onChange={e => setPropEnd(Number(e.target.value))}>
                {Array.from({ length: 16 }, (_, i) => i + 7).map(h => (
                  <option key={h} value={h}>{formatHour(h)}</option>
                ))}
              </select>
            </div>
            <div className="propose-actions">
              <button className="match-card-action-btn match-card-action-btn--negotiate" onClick={handlePropose} disabled={!propDay || propStart >= propEnd}>
                Send Proposal
              </button>
              <button className="btn btn-small" onClick={(e) => { e.stopPropagation(); setShowPropose(false) }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Proposed / Unscheduled state
  const escalationDay = schedule.escalationDay ?? 0
  return (
    <div className={`schedule-panel ${acceptableProposals.length > 0 || pendingProposals.length > 0 ? 'schedule-panel--info' : ''}`}>
      <div className={`schedule-status-badge ${pendingProposals.length > 0 ? 'badge-proposed' : 'badge-unscheduled'}`}>
        {acceptableProposals.length > 0 ? 'Rally Found These Times for You'
          : myPendingProposals.length > 0 ? 'Waiting for Opponent'
          : 'No Times Available'}
      </div>
      <div className="schedule-panel-copy">
        {acceptableProposals.length > 0
          ? 'Review the best available options below. If none work, propose a different time.'
          : myPendingProposals.length > 0
          ? 'You already suggested a time. Your opponent still needs to respond.'
          : 'No overlap is available yet. Propose a time to keep this match moving.'}
      </div>

      {escalationDay > 0 && (
        <div className="escalation-timeline escalation-timeline-subtle">
          <div className="escalation-bar">
            <div className="escalation-fill" style={{ width: `${Math.min(100, (escalationDay / 4) * 100)}%` }} />
          </div>
          <div className="escalation-days">Day {escalationDay} of 4 {'\u2014'} respond to avoid auto-resolution</div>
        </div>
      )}

      {acceptableProposals.length > 0 && (
        <div className="proposal-list">
          {acceptableProposals.map(p => (
            <div key={p.id} className="proposal-card">
              <div className="proposal-info">
                <span className="proposal-time">{proposalLabel(p)}</span>
                {p.proposedBy !== 'system' && (
                  <span className="proposal-from">
                    proposed by {tournament.players.find(pl => pl.id === p.proposedBy)?.name.split(' ')[0] ?? 'opponent'}
                  </span>
                )}
                {p.proposedBy === 'system' && (
                  <span className="proposal-from">Best match for both of you</span>
                )}
              </div>
              <button
                className="match-card-action-btn"
                onClick={(e) => { e.stopPropagation(); handleAccept(p.id) }}
              >
                Confirm Time
              </button>
            </div>
          ))}
        </div>
      )}

      {myPendingProposals.length > 0 && (
        <div className="proposal-list">
          {myPendingProposals.map(p => (
            <div key={p.id} className="proposal-card proposal-mine">
              <div className="proposal-info">
                <span className="proposal-time">{proposalLabel(p)}</span>
                <span className="proposal-from">Your suggestion {'\u2014'} waiting for response</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {!showPropose ? (
        <button
          className="schedule-panel-link"
          onClick={(e) => { e.stopPropagation(); setShowPropose(true) }}
        >
          Suggest a different time instead
        </button>
      ) : (
        <div className="propose-form" onClick={e => e.stopPropagation()}>
          <div className="propose-row">
            <select value={propDay} onChange={e => setPropDay(e.target.value as DayOfWeek | '')}>
              <option value="">Day...</option>
              {DAYS.map(d => <option key={d.key} value={d.key}>{dayLabelShort(d.key)}</option>)}
            </select>
            <select value={propStart} onChange={e => setPropStart(Number(e.target.value))}>
              {Array.from({ length: 16 }, (_, i) => i + 6).map(h => (
                <option key={h} value={h}>{formatHour(h)}</option>
              ))}
            </select>
            <span>{'\u2013'}</span>
            <select value={propEnd} onChange={e => setPropEnd(Number(e.target.value))}>
              {Array.from({ length: 16 }, (_, i) => i + 7).map(h => (
                <option key={h} value={h}>{formatHour(h)}</option>
              ))}
            </select>
          </div>
          <div className="propose-actions">
            <button
              className="match-card-action-btn match-card-action-btn--negotiate"
              onClick={handlePropose}
              disabled={!propDay || propStart >= propEnd}
            >
              Send Proposal
            </button>
            <button className="btn btn-small" onClick={(e) => { e.stopPropagation(); setShowPropose(false) }}>
              Cancel
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
