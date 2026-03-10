import { useState } from 'react'
import { createBroadcast, getActiveBroadcasts, getPlayerActiveBroadcast, claimBroadcast, cancelBroadcast, getPlayerName } from '../store'
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

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  if (date.getTime() === today.getTime()) return 'Today'
  if (date.getTime() === tomorrow.getTime()) return 'Tomorrow'

  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function BroadcastPanel({ tournament, currentPlayerId, onMatchConfirmed }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [time, setTime] = useState('18:30')
  const [location, setLocation] = useState('')
  const [message, setMessage] = useState('')
  const [feedback, setFeedback] = useState('')
  const [, setTick] = useState(0)

  const currentPlayer = tournament.players.find(p => p.id === currentPlayerId)
  const myBroadcast = getPlayerActiveBroadcast(currentPlayerId)
  const availableBroadcasts = getActiveBroadcasts(tournament.id, currentPlayerId)

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
      time,
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

  function handleClaim(broadcast: MatchBroadcast) {
    const result = claimBroadcast(broadcast.id, currentPlayerId)
    if (result) {
      setFeedback('Match confirmed!')
      onMatchConfirmed()
    } else {
      setFeedback('Slot already taken or no match available')
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

  // Don't show if tournament is not in progress
  if (tournament.status !== 'in-progress') return null

  return (
    <div className="broadcast-section">
      {feedback && <div className="broadcast-feedback">{feedback}</div>}

      {/* Active broadcasts from other players */}
      {availableBroadcasts.length > 0 && (
        <div className="broadcast-list">
          <h3 className="broadcast-list-title">Players Available To Play</h3>
          {availableBroadcasts.map(b => (
            <div key={b.id} className="broadcast-card">
              <div className="broadcast-card-header">
                <span className="broadcast-player-name">{b.playerName}</span>
                <span className="broadcast-badge">Available</span>
              </div>
              <div className="broadcast-card-details">
                <span className="broadcast-detail">{formatDate(b.date)}</span>
                <span className="broadcast-detail">{formatTime(b.startTime)}</span>
                <span className="broadcast-detail">{b.location}</span>
              </div>
              {b.message && <div className="broadcast-message">"{b.message}"</div>}
              <button className="btn btn-primary btn-small broadcast-claim-btn" onClick={() => handleClaim(b)}>
                Claim Match
              </button>
            </div>
          ))}
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
              <span className="broadcast-detail">{formatTime(myBroadcast.startTime)}</span>
              <span className="broadcast-detail">{myBroadcast.location}</span>
            </div>
            <button className="btn btn-small broadcast-cancel-btn" onClick={handleCancel}>
              Cancel Broadcast
            </button>
          </div>
        </div>
      )}

      {/* Create broadcast button or form */}
      {!myBroadcast && !showForm && (
        <button className="btn btn-primary btn-large broadcast-play-now-btn" onClick={() => setShowForm(true)}>
          Play Now
        </button>
      )}

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

          <div className="field">
            <label className="field-label">Time</label>
            <input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              className="select-input"
            />
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
              placeholder="Anyone available?"
            />
          </div>

          <div className="broadcast-form-actions">
            <button className="btn" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleCreate}>Send Availability</button>
          </div>
        </div>
      )}
    </div>
  )
}
