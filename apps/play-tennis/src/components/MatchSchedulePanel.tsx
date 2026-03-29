import { formatHourCompact } from '../dateUtils'
import { useState } from 'react'
import { canEnterScore, canCorrectScore } from '../matchCapabilities'
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
import { ConfirmationTone } from './Toast'
import InlineScoreEntry from './InlineScoreEntry'

interface Props {
  tournament: Tournament
  match: Match
  currentPlayerId: string
  onUpdated: () => void
  onScoreSaved?: () => void
  onActionComplete?: (message: string, tone: ConfirmationTone) => void
  onScoreActionComplete?: (message: string, tone: ConfirmationTone) => void
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


function dayLabel(day: DayOfWeek): string {
  const date = resolveNextDate(day)
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

function dayLabelShort(day: DayOfWeek): string {
  const date = resolveNextDate(day)
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function proposalLabel(p: MatchProposal): string {
  return `${dayLabelShort(p.day)} ${formatHourCompact(p.startHour)}\u2013${formatHourCompact(p.endHour)}`
}

function slotLabel(slot: MatchSlot): string {
  return `${dayLabelShort(slot.day)} ${formatHourCompact(slot.startHour)}\u2013${formatHourCompact(slot.endHour)}`
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

export default function MatchSchedulePanel({ tournament, match, currentPlayerId, onUpdated, onScoreSaved, onActionComplete, onScoreActionComplete }: Props) {
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
  const [showScoreEntry, setShowScoreEntry] = useState(false)

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
  const isParticipant = match.player1Id === currentPlayerId || match.player2Id === currentPlayerId
  const opponentId = match.player1Id === currentPlayerId ? match.player2Id : match.player1Id
  const opponentName = tournament.players.find(p => p.id === opponentId)?.name?.split(' ')[0] ?? 'Opponent'
  const hasCustomRescheduleSlot = Boolean(reschedDay) && reschedStart < reschedEnd
  const isScheduleLocked = Boolean(match.completed || match.scoreReportedBy || match.scoreConfirmedAt)
  const isScoreable = canEnterScore(match, currentPlayerId)

  function renderPanelHeader(statusLabel: string, tone: 'slate' | 'blue' | 'green' | 'purple' | 'red', title: string, copy: string) {
    return (
      <div className="workflow-header">
        <div className={`workflow-status workflow-status--${tone}`}>{statusLabel}</div>
        <div className="schedule-panel-title">{title}</div>
        <div className="schedule-panel-copy">{copy}</div>
      </div>
    )
  }

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
    const proposal = schedule?.proposals.find(p => p.id === proposalId)
    await acceptProposal(tournament.id, match.id, proposalId, currentPlayerId)
    if (onActionComplete && proposal) {
      const label = proposalLabel(proposal)
      onActionComplete(`Time confirmed \u2014 ${label}.`, 'green')
    } else {
      onUpdated()
    }
  }

  async function handlePropose() {
    if (!propDay || propStart >= propEnd) return
    await proposeNewSlots(tournament.id, match.id, currentPlayerId, [
      { day: propDay as DayOfWeek, startHour: propStart, endHour: propEnd }
    ])
    setShowPropose(false)
    setPropDay('')
    if (onActionComplete) {
      onActionComplete("Time proposed. You'll be notified when they respond.", 'blue')
    } else {
      onUpdated()
    }
  }

  async function handleReschedule() {
    const slots = getRescheduleSlots()
    if (activeRequest) {
      if (slots.length === 0) return
      await counterReschedule(tournament.id, match.id, currentPlayerId, slots, rescheduleNote)
      resetRescheduleForm()
      if (onActionComplete) {
        onActionComplete("Time proposed. You'll be notified when they respond.", 'blue')
      } else {
        onUpdated()
      }
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
      resetRescheduleForm()
      if (onActionComplete) {
        onActionComplete('Reschedule requested. Your current time stays until they respond.', 'blue')
      } else {
        onUpdated()
      }
    } else {
      await requestHardReschedule(
        tournament.id,
        match.id,
        currentPlayerId,
        rescheduleReason,
        slots,
        rescheduleNote,
      )
      resetRescheduleForm()
      if (onActionComplete) {
        onActionComplete('Time released. Your opponent will see your new options.', 'blue')
      } else {
        onUpdated()
      }
    }
  }

  async function handleCancelMatch() {
    if (!cancelReason) return
    await cancelMatch(tournament.id, match.id, cancelReason)
    setShowCancel(false)
    setCancelReason('')
    if (onActionComplete) {
      onActionComplete('Match cancelled. Your opponent receives a walkover win.', 'orange')
    } else {
      onUpdated()
    }
  }

  async function handleDeclineSoftRequest() {
    await declineSoftReschedule(tournament.id, match.id, currentPlayerId)
    if (onActionComplete) {
      onActionComplete('Reschedule declined. Original time stands.', 'green')
    } else {
      onUpdated()
    }
  }

  async function handleWithdrawSoftRequest() {
    await withdrawSoftReschedule(tournament.id, match.id, currentPlayerId)
    if (onActionComplete) {
      onActionComplete('Request withdrawn. Original time stands.', 'green')
    } else {
      onUpdated()
    }
  }

  function renderRescheduleForm(mode: 'new' | 'counter') {
    const isCounter = mode === 'counter'
    const canSubmit = isCounter
      ? hasCustomRescheduleSlot
      : rescheduleIntent === 'hard'
        ? true
        : hasCustomRescheduleSlot

    return (
      <div className="propose-form schedule-workflow-card" onClick={e => e.stopPropagation()}>
        <div className="workflow-module">
          {renderPanelHeader(
            isCounter ? 'Counter Offer' : rescheduleIntent === 'hard' ? 'Needs New Time' : 'Change Time',
            isCounter ? 'blue' : rescheduleIntent === 'hard' ? 'red' : 'blue',
            isCounter ? 'Suggest another time' : 'Change match time',
            isCounter
              ? 'Reply with a replacement slot that works better for you.'
              : rescheduleIntent === 'hard'
                ? 'Release the current slot and optionally include a replacement now.'
                : 'Ask to move the match while the current confirmed time stays in place until a new one is accepted.'
          )}

          {!isCounter && (
            <>
              <div className="schedule-form-section">
                <div className="schedule-form-label">Request type</div>
                <div className="schedule-choice-grid">
                  <button
                    className={`schedule-choice-pill ${rescheduleIntent === 'soft' ? 'is-selected' : ''}`}
                    onClick={() => setRescheduleIntent('soft')}
                  >
                    Ask to move it
                  </button>
                  <button
                    className={`schedule-choice-pill ${rescheduleIntent === 'hard' ? 'is-selected' : ''}`}
                    onClick={() => setRescheduleIntent('hard')}
                  >
                    I can&apos;t make this time
                  </button>
                </div>
              </div>

              <div className="schedule-form-section">
                <div className="schedule-form-label">Reason</div>
                <div className="schedule-choice-grid schedule-choice-grid--reasons">
                  {RESCHEDULE_REASON_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      className={`schedule-choice-pill ${rescheduleReason === option.value ? 'is-selected' : ''}`}
                      onClick={() => setRescheduleReason(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="schedule-form-note">
            {isCounter
              ? 'Send another option that works better for you.'
              : rescheduleIntent === 'hard'
                ? 'Leave blank to release the current time slot.'
                : 'The current confirmed time stays on the books until a replacement is accepted.'}
          </div>

          <div className="schedule-time-grid">
            <label className="schedule-form-field">
              <span className="schedule-form-label">Day</span>
              <select
                className="schedule-form-select"
                value={reschedDay}
                onChange={e => setReschedDay(e.target.value as DayOfWeek | '')}
              >
                <option value="">{isCounter || rescheduleIntent === 'soft' ? 'New day...' : 'Optional day...'}</option>
                {DAYS.map(d => <option key={d.key} value={d.key}>{dayLabelShort(d.key)}</option>)}
              </select>
            </label>

            <label className="schedule-form-field">
              <span className="schedule-form-label">Start</span>
              <select
                className="schedule-form-select"
                value={reschedStart}
                onChange={e => setReschedStart(Number(e.target.value))}
              >
                {Array.from({ length: 16 }, (_, i) => i + 6).map(h => (
                  <option key={h} value={h}>{formatHourCompact(h)}</option>
                ))}
              </select>
            </label>

            <label className="schedule-form-field">
              <span className="schedule-form-label">End</span>
              <select
                className="schedule-form-select"
                value={reschedEnd}
                onChange={e => setReschedEnd(Number(e.target.value))}
              >
                {Array.from({ length: 16 }, (_, i) => i + 7).map(h => (
                  <option key={h} value={h}>{formatHourCompact(h)}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="schedule-form-field">
            <span className="schedule-form-label">Note</span>
            <textarea
              className="profile-bio-input schedule-note-field"
              rows={3}
              value={rescheduleNote}
              onChange={e => setRescheduleNote(e.target.value)}
              placeholder="Optional note"
            />
          </label>

          <div className="workflow-actions">
            <button className="btn" onClick={(e) => { e.stopPropagation(); resetRescheduleForm() }}>
              Back
            </button>
            <button className="btn btn-primary" onClick={handleReschedule} disabled={!canSubmit}>
              {isCounter ? 'Send New Option' : rescheduleIntent === 'hard' ? 'Request New Time' : 'Change Time'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  function renderCancelForm() {
    return (
      <div className="propose-form schedule-workflow-card schedule-workflow-card--danger" onClick={e => e.stopPropagation()}>
        <div className="workflow-module">
          {renderPanelHeader(
            'Cancel Match',
            'red',
            'Withdraw from this match',
            'Use this only if the match will not happen. Your opponent will receive a walkover win.'
          )}

          <div className="schedule-form-section">
            <div className="schedule-form-label">Reason</div>
            <div className="schedule-choice-grid schedule-choice-grid--reasons">
              {CANCEL_REASONS.map(reason => (
                <button
                  key={reason}
                  className={`schedule-choice-pill schedule-choice-pill--danger ${cancelReason === reason ? 'is-selected' : ''}`}
                  onClick={() => setCancelReason(reason)}
                >
                  {reason}
                </button>
              ))}
            </div>
          </div>

          <div className="workflow-actions">
            <button className="btn" onClick={(e) => { e.stopPropagation(); setShowCancel(false); setCancelReason('') }}>
              Back
            </button>
            <button
              className="btn btn-danger"
              onClick={handleCancelMatch}
              disabled={!cancelReason}
            >
              Confirm Cancellation
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Confirmed state
  if (schedule.status === 'confirmed' && schedule.confirmedSlot) {
    const s = schedule.confirmedSlot
    const venue = getVenueSuggestion(tournament, match, currentPlayerId)
    const lastRescheduled = latestHistory?.type === 'rescheduled' && latestHistory.fromSlot
      ? `${dayLabel(latestHistory.fromSlot.day)} ${formatHourCompact(latestHistory.fromSlot.startHour)}${'\u2013'}${formatHourCompact(latestHistory.fromSlot.endHour)}`
      : null
    const showConfirmedContextHeader = isScheduleLocked || rescheduleUiState !== 'none'
    return (
      <div className="schedule-panel schedule-confirmed">
        {showConfirmedContextHeader ? (
          renderPanelHeader(
            isScheduleLocked
              ? match.completed ? 'Completed' : 'Score Reported'
              : rescheduleUiState === 'soft_request_sent'
                ? 'Reschedule Requested'
                : 'Change Requested',
            isScheduleLocked
              ? 'green'
              : 'purple',
            'Current confirmed time',
            isScheduleLocked
              ? match.completed
                ? 'This match has already been completed. The confirmed time is now read-only.'
                : 'A score has been reported for this match, so the schedule is now locked.'
              : rescheduleUiState === 'soft_request_sent'
                ? `Your current match time still holds unless ${opponentName} accepts a new one.`
                : `${opponentName} asked to move this match. Review the new options below.`
          )
        ) : null}
        <div className="confirmed-slot">
          <span className="confirmed-day">{dayLabel(s.day)}</span>
          <span className="confirmed-time">{formatHourCompact(s.startHour)}{'\u2013'}{formatHourCompact(s.endHour)}</span>
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

        {!isParticipant ? (
          <div className="proposal-from">
            This match time is view-only because you are not one of the two players.
          </div>
        ) : showScoreEntry && (isScoreable || canCorrectScore(match, currentPlayerId)) ? (
          <>
            <InlineScoreEntry
              tournament={tournament}
              matchId={match.id}
              currentPlayerId={currentPlayerId}
              onSaved={onScoreSaved ?? onUpdated}
              onActionComplete={onScoreActionComplete}
              embedded
            />
            <div className="confirmed-actions-footer">
              <button
                className="btn"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowScoreEntry(false)
                }}
              >
                Cancel
              </button>
            </div>
          </>
        ) : isScheduleLocked ? (
          <div className="schedule-locked-note">
            {match.completed
              ? 'This match is complete. The confirmed time is now read-only.'
              : 'A score has been reported, so the confirmed time can no longer be changed or canceled.'}
            {canCorrectScore(match, currentPlayerId) && (
              <button
                className="btn-link btn-small"
                style={{ marginTop: 'var(--space-sm)' }}
                onClick={(e) => {
                  e.stopPropagation()
                  setShowScoreEntry(true)
                }}
              >
                Correct Score
              </button>
            )}
          </div>
        ) : showReschedule ? renderRescheduleForm(activeRequest ? 'counter' : 'new') : showCancel ? renderCancelForm() : (
          <div className="confirmed-actions-shell">
            <div className="confirmed-actions">
              {rescheduleUiState === 'soft_request_sent' && (
                <button
                  className="btn btn-small"
                  onClick={(e) => { e.stopPropagation(); handleWithdrawSoftRequest() }}
                >
                  Withdraw Request
                </button>
              )}
              {rescheduleUiState === 'soft_request_received' && (
                <>
                  <button
                    className="btn btn-small"
                    onClick={(e) => { e.stopPropagation(); setShowReschedule(true) }}
                  >
                    Suggest Another
                  </button>
                  <button
                    className="btn btn-primary btn-small"
                    onClick={(e) => { e.stopPropagation(); handleDeclineSoftRequest() }}
                  >
                    Keep Current Time
                  </button>
                </>
              )}
              {rescheduleUiState === 'none' && isScoreable && (
                <button
                  className="btn btn-primary btn-small"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowCancel(false)
                    setShowReschedule(false)
                    setShowScoreEntry(true)
                  }}
                >
                  Report Score
                </button>
              )}
              {rescheduleUiState === 'none' && canReschedule && (
                <button
                  className="btn btn-small"
                  onClick={(e) => { e.stopPropagation(); setShowReschedule(true) }}
                >
                  Change Time
                </button>
              )}
            </div>
            <div className="confirmed-actions-danger">
              <button
                className="btn-link btn-small cancel-match-link"
                onClick={(e) => { e.stopPropagation(); setShowCancel(true) }}
              >
                Cancel Match
              </button>
            </div>
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
        {renderPanelHeader(
          'Needs New Time',
          'red',
          'Find a replacement time',
          rescheduleUiState === 'hard_request_sent'
            ? 'You canceled the original confirmed slot. Send a new option to keep this match moving.'
            : `${opponentName} can no longer make the original confirmed slot. Send a new option below.`
        )}
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

        {!isParticipant ? (
          <div className="proposal-from">
            This match time is view-only because you are not one of the two players.
          </div>
        ) : showReschedule ? renderRescheduleForm('counter') : showCancel ? renderCancelForm() : (
          <div className="confirmed-actions">
            <button
              className="btn btn-primary btn-small"
              onClick={(e) => { e.stopPropagation(); setShowReschedule(true) }}
            >
              Suggest Another
            </button>
            <button
              className="btn-link btn-small cancel-match-link"
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
        <div className="schedule-panel">
          {renderPanelHeader(
            'Match Awarded',
            'purple',
            'Walkover result applied',
            isWinner
              ? 'Your opponent did not participate in scheduling. The match was awarded to you.'
              : `${winnerName} was awarded the match because the other player did not participate in scheduling.`
          )}
          <div className="resolution-detail">
            Auto-resolution closes the scheduling flow for this match.
          </div>
        </div>
      )
    }
    if (r.type === 'forced-match' && r.forcedSlot) {
      return (
        <div className="schedule-panel">
          {renderPanelHeader(
            'Final Match Assigned',
            'red',
            'Rally assigned the final time',
            'Both players participated but could not agree on a slot, so Rally set the final match time.'
          )}
          <div className="confirmed-slot">
            <span className="confirmed-day">{dayLabel(r.forcedSlot.day)}</span>
            <span className="confirmed-time">{formatHourCompact(r.forcedSlot.startHour)}{'\u2013'}{formatHourCompact(r.forcedSlot.endHour)}</span>
          </div>
        </div>
      )
    }
    if (r.type === 'double-loss') {
      return (
        <div className="schedule-panel">
          {renderPanelHeader(
            'Match Canceled',
            'slate',
            'Double loss applied',
            'Neither player participated in scheduling, so both players receive a loss.'
          )}
        </div>
      )
    }
  }

  // Escalated state
  if (schedule.status === 'escalated') {
    const day = schedule.escalationDay ?? 0
    const daysLeft = Math.max(0, 4 - day)
    return (
      <div className="schedule-panel schedule-escalated">
        {renderPanelHeader(
          'Needs Resolution',
          'red',
          'Respond before auto-resolution',
          daysLeft > 0
            ? `${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining before Rally resolves the match automatically.`
            : 'The response window is up. Rally may auto-resolve this match now.'
        )}
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
            className="btn btn-primary btn-small"
            onClick={(e) => { e.stopPropagation(); setShowPropose(true) }}
          >
            Propose a time now
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
                  <option key={h} value={h}>{formatHourCompact(h)}</option>
                ))}
              </select>
              <span>{'\u2013'}</span>
              <select value={propEnd} onChange={e => setPropEnd(Number(e.target.value))}>
                {Array.from({ length: 16 }, (_, i) => i + 7).map(h => (
                  <option key={h} value={h}>{formatHourCompact(h)}</option>
                ))}
              </select>
            </div>
            <div className="propose-actions">
              <button className="btn btn-primary btn-small" onClick={handlePropose} disabled={!propDay || propStart >= propEnd}>
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
    <div className="schedule-panel">
      {renderPanelHeader(
        acceptableProposals.length > 0
          ? 'MATCH READY'
          : myPendingProposals.length > 0
            ? 'NEEDS RESPONSE'
            : 'NEEDS SCHEDULING',
        'purple',
        acceptableProposals.length > 0
          ? 'Review Rally\'s time options'
          : myPendingProposals.length > 0
            ? `Waiting on ${opponentName}`
            : 'Suggest a new time',
        acceptableProposals.length > 0
          ? 'Choose the best available slot or send a different one.'
          : myPendingProposals.length > 0
            ? 'Your latest suggestion is pending. You can still send another option if needed.'
            : 'No overlap was found automatically, so you need to schedule this one manually.'
      )}

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
                className="btn btn-primary btn-small"
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
          className="btn-link propose-link"
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
                <option key={h} value={h}>{formatHourCompact(h)}</option>
              ))}
            </select>
            <span>{'\u2013'}</span>
            <select value={propEnd} onChange={e => setPropEnd(Number(e.target.value))}>
              {Array.from({ length: 16 }, (_, i) => i + 7).map(h => (
                <option key={h} value={h}>{formatHourCompact(h)}</option>
              ))}
            </select>
          </div>
          <div className="propose-actions">
            <button
              className="btn btn-primary btn-small"
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
