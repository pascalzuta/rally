import { useState, useEffect } from 'react'
import { createBroadcast, getActiveBroadcasts, getPlayerActiveBroadcast, cancelBroadcast, getUpcomingAvailability, getSeeds, UpcomingSlot, createMatchOffer, getIncomingOffers, getOutgoingOffers, acceptMatchOffer, declineMatchOffer, cancelMatchOffer, cleanExpiredOffers } from '../store'
import { Tournament, MatchBroadcast, MatchOffer } from '../types'

interface Props {
  tournament: Tournament | null
  currentPlayerId: string
  currentPlayerName: string
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

function formatHour(h: number): string {
  if (h === 0 || h === 24) return '12 AM'
  if (h === 12) return '12 PM'
  return h < 12 ? `${h} AM` : `${h - 12} PM`
}

function formatHourRange(start: number, end: number): string {
  return `${formatHour(start)} – ${formatHour(end)}`
}

function defaultEndTime(start: string): string {
  const [h, m] = start.split(':').map(Number)
  const endH = Math.min(h + 2, 23)
  return `${endH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

function isAvailableNow(dateStr: string, startHour: number, endHour: number): boolean {
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  if (dateStr !== today) return false
  const currentHour = now.getHours() + now.getMinutes() / 60
  return currentHour >= startHour && currentHour < endHour
}

function isAvailableNowBroadcast(b: MatchBroadcast): boolean {
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  if (b.date !== today) return false
  const [startH] = b.startTime.split(':').map(Number)
  const endTime = b.endTime || defaultEndTime(b.startTime)
  const [endH] = endTime.split(':').map(Number)
  const currentHour = now.getHours() + now.getMinutes() / 60
  return currentHour >= startH && currentHour < endH
}

function timeRemaining(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return 'Expired'
  const mins = Math.floor(ms / 60000)
  const hrs = Math.floor(mins / 60)
  const m = mins % 60
  if (hrs > 0) return `${hrs}h ${m}m`
  return `${m}m`
}

interface OpponentRow {
  type: 'availability' | 'broadcast'
  playerId: string
  playerName: string
  date: string
  dateLabel: string
  timeLabel: string
  location?: string
  message?: string
  broadcastId?: string
  isNow: boolean
  sortKey: string
  startHour: number
  endHour: number
  day: string // day name lowercase
}

function buildOpponentRows(
  slots: UpcomingSlot[],
  broadcasts: MatchBroadcast[],
): OpponentRow[] {
  const rows: OpponentRow[] = []
  const broadcastPlayerDates = new Set<string>()

  for (const b of broadcasts) {
    const dateLabel = formatDate(b.date)
    const timeLabel = formatTimeRange(b.startTime, b.endTime || defaultEndTime(b.startTime))
    broadcastPlayerDates.add(`${b.playerId}-${b.date}`)
    const [startH] = b.startTime.split(':').map(Number)
    const endTime = b.endTime || defaultEndTime(b.startTime)
    const [endH] = endTime.split(':').map(Number)
    const dateObj = new Date(b.date + 'T00:00:00')
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
    rows.push({
      type: 'broadcast',
      playerId: b.playerId,
      playerName: b.playerName,
      date: b.date,
      dateLabel,
      timeLabel,
      location: b.location,
      message: b.message,
      broadcastId: b.id,
      isNow: isAvailableNowBroadcast(b),
      sortKey: `${b.date}-${b.startTime}`,
      startHour: startH,
      endHour: endH,
      day: dayName,
    })
  }

  for (const s of slots) {
    if (broadcastPlayerDates.has(`${s.playerId}-${s.date}`)) continue
    const dateObj = new Date(s.date + 'T00:00:00')
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
    rows.push({
      type: 'availability',
      playerId: s.playerId,
      playerName: s.playerName,
      date: s.date,
      dateLabel: s.dayLabel,
      timeLabel: formatHourRange(s.startHour, s.endHour),
      isNow: isAvailableNow(s.date, s.startHour, s.endHour),
      sortKey: `${s.date}-${s.startHour.toString().padStart(2, '0')}`,
      startHour: s.startHour,
      endHour: s.endHour,
      day: dayName,
    })
  }

  rows.sort((a, b) => {
    if (a.isNow !== b.isNow) return a.isNow ? -1 : 1
    return a.sortKey.localeCompare(b.sortKey)
  })

  return rows
}

function groupRowsByDate(rows: OpponentRow[]): { date: string; dateLabel: string; entries: OpponentRow[] }[] {
  const map = new Map<string, { dateLabel: string; entries: OpponentRow[] }>()
  for (const r of rows) {
    const existing = map.get(r.date)
    if (existing) {
      existing.entries.push(r)
    } else {
      map.set(r.date, { dateLabel: r.dateLabel, entries: [r] })
    }
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { dateLabel, entries }]) => ({ date, dateLabel, entries }))
}

export default function PlayNowTab({ tournament, currentPlayerId, currentPlayerName, onMatchConfirmed }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [startTime, setStartTime] = useState('18:00')
  const [endTime, setEndTime] = useState('20:00')
  const [location, setLocation] = useState('')
  const [message, setMessage] = useState('')
  const [feedback, setFeedback] = useState('')
  const [askingRow, setAskingRow] = useState<OpponentRow | null>(null)
  const [, setTick] = useState(0)

  // Auto-refresh expiration timers
  useEffect(() => {
    const interval = setInterval(() => {
      cleanExpiredOffers()
      setTick(t => t + 1)
    }, 30000) // every 30s
    return () => clearInterval(interval)
  }, [])

  if (!tournament || tournament.status !== 'in-progress') {
    return (
      <div className="playnow-tab">
        <div className="card">
          <p className="subtle">Join an active tournament to use Find Match</p>
        </div>
      </div>
    )
  }

  const myBroadcast = getPlayerActiveBroadcast(currentPlayerId)
  const availableBroadcasts = getActiveBroadcasts(tournament.id, currentPlayerId)
  const upcomingSlots = getUpcomingAvailability(tournament, currentPlayerId)
  const seeds = getSeeds(tournament)

  // Match offers
  const incomingOffers = getIncomingOffers(currentPlayerId)
  const outgoingOffers = getOutgoingOffers(currentPlayerId)

  const opponentRows = buildOpponentRows(upcomingSlots, availableBroadcasts)
  const dateGroups = groupRowsByDate(opponentRows)

  function playerSeedLabel(playerId: string): string {
    const seed = seeds.get(playerId)
    return seed != null ? ` (${seed})` : ''
  }

  function handleCreate() {
    if (!location.trim()) {
      setFeedback('Please enter a location')
      setTimeout(() => setFeedback(''), 2000)
      return
    }
    const result = createBroadcast(
      currentPlayerId,
      currentPlayerName,
      tournament!.id,
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

  function handleAskToPlay(row: OpponentRow) {
    const result = createMatchOffer(
      { id: currentPlayerId, name: currentPlayerName },
      { id: row.playerId, name: row.playerName },
      tournament!.id,
      row.date,
      `${formatHour(row.startHour)}`,
      row.day,
      row.startHour,
      row.endHour,
    )

    if ('error' in result) {
      setFeedback(result.error)
    } else {
      setFeedback('Match offer sent')
    }
    setAskingRow(null)
    setTimeout(() => setFeedback(''), 2500)
    setTick(t => t + 1)
  }

  function handleAcceptOffer(offer: MatchOffer) {
    const result = acceptMatchOffer(offer.offerId, currentPlayerId)
    if ('error' in result) {
      setFeedback(result.error)
    } else {
      setFeedback('Match scheduled')
      if (result.matchConfirmed) onMatchConfirmed()
    }
    setTimeout(() => setFeedback(''), 2500)
    setTick(t => t + 1)
  }

  function handleDeclineOffer(offer: MatchOffer) {
    const result = declineMatchOffer(offer.offerId, currentPlayerId)
    if ('error' in result) {
      setFeedback(result.error)
    } else {
      setFeedback('Offer declined')
    }
    setTimeout(() => setFeedback(''), 2000)
    setTick(t => t + 1)
  }

  function handleCancelOffer(offer: MatchOffer) {
    cancelMatchOffer(offer.offerId, currentPlayerId)
    setFeedback('Offer cancelled')
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

  return (
    <div className="playnow-tab">
      {feedback && <div className="broadcast-feedback">{feedback}</div>}

      {/* === INCOMING OFFERS === */}
      {incomingOffers.length > 0 && (
        <div className="pn-section">
          <h3 className="pn-section-title">Match Offers</h3>
          <div className="offer-list">
            {incomingOffers.map(offer => (
              <div key={offer.offerId} className="card offer-card offer-card-incoming">
                <div className="offer-card-header">
                  <span className="offer-card-label">Match Proposed</span>
                  <span className="offer-card-expires">Expires in {timeRemaining(offer.expiresAt)}</span>
                </div>
                <div className="offer-card-time">{offer.proposedTime}</div>
                <div className="offer-card-date">{formatDate(offer.proposedDate)}</div>
                <div className="offer-card-opponent">{offer.senderName}</div>
                <div className="offer-card-actions">
                  <button className="btn btn-primary offer-accept-btn" onClick={() => handleAcceptOffer(offer)}>Accept</button>
                  <button className="btn offer-decline-btn" onClick={() => handleDeclineOffer(offer)}>Decline</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* === OUTGOING OFFERS === */}
      {outgoingOffers.length > 0 && (
        <div className="pn-section">
          <h3 className="pn-section-title">Your Pending Offers</h3>
          <div className="offer-list">
            {outgoingOffers.map(offer => (
              <div key={offer.offerId} className="card offer-card offer-card-outgoing">
                <div className="offer-card-header">
                  <span className="offer-card-label">Sent to {offer.recipientName}</span>
                  <span className="offer-card-expires">Expires in {timeRemaining(offer.expiresAt)}</span>
                </div>
                <div className="offer-card-time">{offer.proposedTime}</div>
                <div className="offer-card-date">{formatDate(offer.proposedDate)}</div>
                <button className="btn btn-small offer-cancel-btn" onClick={() => handleCancelOffer(offer)}>Cancel Offer</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* === BROADCAST HERO === */}
      {myBroadcast ? (
        <div className="card pn-my-broadcast">
          <div className="broadcast-card-header">
            <span className="broadcast-player-name">Your Broadcast</span>
            <span className="badge badge-live">Active</span>
          </div>
          <div className="broadcast-card-details">
            <span className="broadcast-detail">{formatDate(myBroadcast.date)}</span>
            <span className="broadcast-detail">{formatTimeRange(myBroadcast.startTime, myBroadcast.endTime || defaultEndTime(myBroadcast.startTime))}</span>
            <span className="broadcast-detail">{myBroadcast.location}</span>
          </div>
          <button className="btn btn-small broadcast-cancel-btn" onClick={handleCancel}>Cancel Broadcast</button>
        </div>
      ) : !showForm ? (
        <button className="broadcast-play-now-btn" onClick={() => setShowForm(true)}>
          <span className="play-now-text">Play Now</span>
          <span className="play-now-sub">Let tournament players know when you're free</span>
        </button>
      ) : (
        <div className="card broadcast-form">
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
            <button className="btn btn-primary" onClick={handleCreate}>Broadcast</button>
          </div>
        </div>
      )}

      {/* === AVAILABLE OPPONENTS === */}
      <div className="pn-section">
        <h3 className="pn-section-title">Available Opponents</h3>
        <p className="pn-section-helper">Tap a player to propose a match at their available time</p>

        {dateGroups.length === 0 ? (
          <div className="pn-empty-state">
            <div className="pn-empty-title">No players available right now</div>
            <div className="pn-empty-desc">Post your availability and we'll notify tournament players</div>
            {!myBroadcast && !showForm && (
              <button className="btn btn-primary pn-empty-cta" onClick={() => setShowForm(true)}>Play Now</button>
            )}
          </div>
        ) : (
          dateGroups.map(group => (
            <div key={group.date} className="pn-date-group">
              <div className="pn-date-header">{group.dateLabel}</div>
              <div className="pn-opponent-list">
                {group.entries.map((row, i) => (
                  <div
                    key={`${row.playerId}-${row.date}-${i}`}
                    className="pn-opponent-row pn-opponent-actionable"
                    onClick={() => setAskingRow(row)}
                  >
                    <div className="pn-opponent-avatar">
                      {row.playerName[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="pn-opponent-info">
                      <div className="pn-opponent-name">
                        {row.playerName}
                        <span className="seed-label">{playerSeedLabel(row.playerId)}</span>
                      </div>
                      <div className="pn-opponent-meta">
                        {row.isNow && <span className="pn-available-now">Available now</span>}
                        <span>{row.dateLabel} · {row.timeLabel}</span>
                        {row.location && <span> · {row.location}</span>}
                      </div>
                      {row.message && <div className="pn-opponent-message">"{row.message}"</div>}
                    </div>
                    <button
                      className="btn btn-primary btn-small pn-ask-btn"
                      onClick={e => { e.stopPropagation(); setAskingRow(row) }}
                    >
                      Ask to Play
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* === ASK TO PLAY CONFIRMATION MODAL === */}
      {askingRow && (
        <div className="broadcast-claim-overlay" onClick={() => setAskingRow(null)}>
          <div className="broadcast-claim-modal" onClick={e => e.stopPropagation()}>
            <h3 className="broadcast-claim-title">Propose match vs {askingRow.playerName}</h3>
            <div className="broadcast-claim-info">
              <div className="offer-confirm-time">{askingRow.timeLabel}</div>
              <div className="offer-confirm-date">{askingRow.dateLabel}</div>
              {askingRow.location && <div className="broadcast-claim-detail">{askingRow.location}</div>}
            </div>
            <p className="offer-confirm-note">
              {askingRow.playerName} will have 2 hours to accept or decline.
            </p>
            <div className="broadcast-claim-actions">
              <button className="btn" onClick={() => setAskingRow(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => handleAskToPlay(askingRow)}>Ask to Play</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
