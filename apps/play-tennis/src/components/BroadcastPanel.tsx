import { formatHourCompact } from '../dateUtils'
import { useState } from 'react'
import { createBroadcast, getActiveBroadcasts, getPlayerActiveBroadcast, claimBroadcast, cancelBroadcast, getUpcomingAvailability, UpcomingSlot } from '../store'
import { Tournament, MatchBroadcast } from '../types'

interface Props {
  tournament: Tournament
  currentPlayerId: string
  onMatchConfirmed: () => void
}

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`
}

function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)} – ${formatTime(end)}`
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  if (date.getTime() === today.getTime()) return 'Today'
  if (date.getTime() === tomorrow.getTime()) return 'Tomorrow'

  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

function formatHourRange(start: number, end: number): string {
  return `${formatHourCompact(start)} – ${formatHourCompact(end)}`
}

// Group upcoming slots by date
function groupSlotsByDate(slots: UpcomingSlot[]): { date: string; dayLabel: string; entries: UpcomingSlot[] }[] {
  const map = new Map<string, { dayLabel: string; entries: UpcomingSlot[] }>()
  for (const s of slots) {
    const existing = map.get(s.date)
    if (existing) {
      existing.entries.push(s)
    } else {
      map.set(s.date, { dayLabel: s.dayLabel, entries: [s] })
    }
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { dayLabel, entries }]) => ({ date, dayLabel, entries }))
}

function defaultEndTime(start: string): string {
  const [h, m] = start.split(':').map(Number)
  const endH = Math.min(h + 2, 23)
  return `${endH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

// Group broadcasts by date for timeline view
function groupByDate(broadcasts: MatchBroadcast[]): { date: string; entries: MatchBroadcast[] }[] {
  const map = new Map<string, MatchBroadcast[]>()
  for (const b of broadcasts) {
    const existing = map.get(b.date) ?? []
    existing.push(b)
    map.set(b.date, existing)
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, entries]) => ({
      date,
      entries: entries.sort((a, b) => a.startTime.localeCompare(b.startTime)),
    }))
}

export default function BroadcastPanel({ tournament, currentPlayerId, onMatchConfirmed }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [showAvailability, setShowAvailability] = useState(false)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [startTime, setStartTime] = useState('18:00')
  const [endTime, setEndTime] = useState('20:00')
  const [location, setLocation] = useState('')
  const [message, setMessage] = useState('')
  const [feedback, setFeedback] = useState('')
  const [claimingId, setClaimingId] = useState<string | null>(null)
  const [, setTick] = useState(0)

  const currentPlayer = tournament.players.find(p => p.id === currentPlayerId)
  const myBroadcast = getPlayerActiveBroadcast(currentPlayerId)
  const availableBroadcasts = getActiveBroadcasts(tournament.id, currentPlayerId)
  const timelineGroups = groupByDate(availableBroadcasts)
  const upcomingSlots = getUpcomingAvailability(tournament, currentPlayerId)
  const upcomingGroups = groupSlotsByDate(upcomingSlots)

  function handleCreate() {
    if (!location.trim()) {
      setFeedback('Please enter a location')
      setTimeout(() => setFeedback(''), 2000)
      return
    }
    const result = createBroadcast(
      currentPlayerId,
      currentPlayer?.name ?? 'Unknown',
      tournament.id,
      date,
      startTime,
      endTime,
      location.trim(),
      message.trim() || undefined
    )
    if (result) {
      setShowForm(false)
      setLocation('')
      setMessage('')
      setFeedback('Broadcast sent!')
    } else {
      setFeedback('You already have an active broadcast')
    }
    setTimeout(() => setFeedback(''), 2000)
    setTick(t => t + 1)
  }

  async function handleClaim(broadcast: MatchBroadcast) {
    const result = await claimBroadcast(broadcast.id, currentPlayerId)
    if (result) {
      setFeedback('Match confirmed!')
      setClaimingId(null)
      onMatchConfirmed()
    } else {
      setFeedback('This player just matched with someone else. Try another slot.')
    }
    setTimeout(() => setFeedback(''), 2000)
    setTick(t => t + 1)
  }

  function handleCancel() {
    if (myBroadcast) {
      cancelBroadcast(myBroadcast.id, currentPlayerId)
      setFeedback('Broadcast cancelled')
      setTimeout(() => setFeedback(''), 2000)
      setTick(t => t + 1)
    }
  }

  function handleStartTimeChange(val: string) {
    setStartTime(val)
    setEndTime(defaultEndTime(val))
  }

  // Don't show if tournament is not in progress
  if (tournament.status !== 'in-progress') return null

  return (
    <div className="broadcast-section">
      {feedback && <div className="broadcast-feedback">{feedback}</div>}

      {/* Play Now button */}
      {!myBroadcast && !showForm && (
        <button className="broadcast-play-now-btn" onClick={() => setShowForm(true)}>
          <span className="play-now-icon">&#9889;</span>
          <span className="play-now-text">Play Now</span>
          <span className="play-now-sub">Notify opponents you're available to play</span>
        </button>
      )}

      {/* See who's available toggle */}
      {!showForm && (
        <button
          className="availability-toggle-btn"
          onClick={() => setShowAvailability(!showAvailability)}
        >
          {showAvailability ? 'Hide availability' : `See who's available (next 3 days)`}
          <span className="availability-toggle-count">{upcomingSlots.length} slots</span>
        </button>
      )}

      {/* Upcoming availability overview */}
      {showAvailability && !showForm && (
        <div className="availability-overview">
          {upcomingGroups.length === 0 ? (
            <div className="availability-empty">No availability set for the next 3 days</div>
          ) : (
            upcomingGroups.map(group => (
              <div key={group.date} className="availability-day-group">
                <div className="availability-day-header">{group.dayLabel}</div>
                <div className="availability-day-entries">
                  {group.entries.map((slot, i) => (
                    <div key={`${slot.playerId}-${i}`} className="availability-slot-entry">
                      <span className="availability-slot-time">{formatHourRange(slot.startHour, slot.endHour)}</span>
                      <span className="availability-slot-name">{slot.playerName}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Broadcast creation form */}
      {showForm && (
        <div className="broadcast-form">
          <h3 className="broadcast-form-title">I Want To Play</h3>

          <div className="field">
            <label className="field-label">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div className="broadcast-time-row">
            <div className="field field-half">
              <label className="field-label">From</label>
              <input
                type="time"
                value={startTime}
                onChange={e => handleStartTimeChange(e.target.value)}
                className="select-input"
              />
            </div>
            <div className="field field-half">
              <label className="field-label">To</label>
              <input
                type="time"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className="select-input"
              />
            </div>
          </div>

          <div className="field">
            <label className="field-label">Location</label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="e.g. Marin Tennis Club"
            />
          </div>

          <div className="field">
            <label className="field-label">Message (optional)</label>
            <input
              type="text"
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Anyone free?"
            />
          </div>

          <div className="broadcast-form-actions">
            <button className="btn" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleCreate}>
              <span>&#9889;</span> Broadcast Availability
            </button>
          </div>
        </div>
      )}

      {/* My active broadcast */}
      {myBroadcast && (
        <div className="broadcast-mine">
          <div className="broadcast-card broadcast-card-own">
            <div className="broadcast-card-header">
              <span className="broadcast-player-name">Your Broadcast</span>
              <span className="broadcast-badge broadcast-badge-own">Active</span>
            </div>
            <div className="broadcast-card-details">
              <span className="broadcast-detail">{formatDate(myBroadcast.date)}</span>
              <span className="broadcast-detail">{formatTimeRange(myBroadcast.startTime, myBroadcast.endTime || defaultEndTime(myBroadcast.startTime))}</span>
              <span className="broadcast-detail">{myBroadcast.location}</span>
            </div>
            <button className="btn btn-small broadcast-cancel-btn" onClick={handleCancel}>
              Cancel Broadcast
            </button>
          </div>
        </div>
      )}

      {/* Claim confirmation overlay */}
      {claimingId && (() => {
        const b = availableBroadcasts.find(x => x.id === claimingId)
        if (!b) return null
        return (
          <div className="broadcast-claim-overlay" onClick={() => setClaimingId(null)}>
            <div className="broadcast-claim-modal" onClick={e => e.stopPropagation()}>
              <h3 className="broadcast-claim-title">Match Opportunity</h3>
              <div className="broadcast-claim-info">
                <div className="broadcast-claim-player">{b.playerName} is available</div>
                <div className="broadcast-claim-detail">{formatDate(b.date)}</div>
                <div className="broadcast-claim-detail">{formatTimeRange(b.startTime, b.endTime || defaultEndTime(b.startTime))}</div>
                <div className="broadcast-claim-detail">{b.location}</div>
                {b.message && <div className="broadcast-claim-message">"{b.message}"</div>}
              </div>
              <div className="broadcast-claim-actions">
                <button className="btn" onClick={() => setClaimingId(null)}>Cancel</button>
                <button className="btn btn-primary" onClick={() => handleClaim(b)}>Claim Match</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Timeline view */}
      {timelineGroups.length > 0 && (
        <div className="broadcast-timeline">
          <h3 className="broadcast-timeline-title">Players Available</h3>
          {timelineGroups.map(group => (
            <div key={group.date} className="broadcast-timeline-group">
              <div className="broadcast-timeline-date">{formatDate(group.date)}</div>
              <div className="broadcast-timeline-entries">
                {group.entries.map(b => (
                  <div key={b.id} className="broadcast-timeline-entry" onClick={() => setClaimingId(b.id)}>
                    <div className="broadcast-timeline-time">
                      {formatTimeRange(b.startTime, b.endTime || defaultEndTime(b.startTime))}
                    </div>
                    <div className="broadcast-timeline-player">
                      <span className="broadcast-timeline-name">{b.playerName}</span>
                      <span className="broadcast-timeline-location">{b.location}</span>
                    </div>
                    {b.message && <div className="broadcast-timeline-message">"{b.message}"</div>}
                    <button
                      className="btn btn-primary btn-small broadcast-timeline-claim"
                      onClick={e => { e.stopPropagation(); setClaimingId(b.id) }}
                    >
                      Claim Match
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
