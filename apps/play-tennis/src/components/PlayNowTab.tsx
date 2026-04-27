import { formatHourCompact } from '../dateUtils'
import { useState, useEffect } from 'react'
import { createBroadcast, getActiveBroadcasts, getPlayerActiveBroadcast, cancelBroadcast, getUpcomingAvailability, getSeeds, UpcomingSlot, createMatchOffer, getIncomingOffers, getOutgoingOffers, acceptMatchOffer, declineMatchOffer, cancelMatchOffer, cleanExpiredOffers, hasUnreadFrom } from '../store'
import { Tournament, MatchBroadcast, MatchOffer } from '../types'
import MessagePanel from './MessagePanel'
import { useToast } from './Toast'

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


function formatHourRange(start: number, end: number): string {
  return `${formatHourCompact(start)} – ${formatHourCompact(end)}`
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
  day: string
}

function buildOpponentRows(slots: UpcomingSlot[], broadcasts: MatchBroadcast[]): OpponentRow[] {
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
    rows.push({ type: 'broadcast', playerId: b.playerId, playerName: b.playerName, date: b.date, dateLabel, timeLabel, location: b.location, message: b.message, broadcastId: b.id, isNow: isAvailableNowBroadcast(b), sortKey: `${b.date}-${b.startTime}`, startHour: startH, endHour: endH, day: dayName })
  }
  for (const s of slots) {
    if (broadcastPlayerDates.has(`${s.playerId}-${s.date}`)) continue
    const dateObj = new Date(s.date + 'T00:00:00')
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
    rows.push({ type: 'availability', playerId: s.playerId, playerName: s.playerName, date: s.date, dateLabel: s.dayLabel, timeLabel: formatHourRange(s.startHour, s.endHour), isNow: isAvailableNow(s.date, s.startHour, s.endHour), sortKey: `${s.date}-${s.startHour.toString().padStart(2, '0')}`, startHour: s.startHour, endHour: s.endHour, day: dayName })
  }
  rows.sort((a, b) => { if (a.isNow !== b.isNow) return a.isNow ? -1 : 1; return a.sortKey.localeCompare(b.sortKey) })
  return rows
}

function groupRowsByDate(rows: OpponentRow[]): { date: string; dateLabel: string; entries: OpponentRow[] }[] {
  const map = new Map<string, { dateLabel: string; entries: OpponentRow[] }>()
  for (const r of rows) {
    const existing = map.get(r.date)
    if (existing) { existing.entries.push(r) } else { map.set(r.date, { dateLabel: r.dateLabel, entries: [r] }) }
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, { dateLabel, entries }]) => ({ date, dateLabel, entries }))
}

function offerKey(playerId: string, date: string, startHour: number, endHour: number): string {
  return `${playerId}:${date}:${startHour}:${endHour}`
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
  const [messagingPlayerId, setMessagingPlayerId] = useState<string | null>(null)
  const [showInfoTooltip, setShowInfoTooltip] = useState(false)
  const { showSuccess } = useToast()
  const [, setTick] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => { cleanExpiredOffers(); setTick(t => t + 1) }, 30000)
    return () => clearInterval(interval)
  }, [])

  if (!tournament || !['in-progress', 'setup'].includes(tournament.status)) {
    return (
      <div className="playnow-tab">
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
          </div>
          <div className="empty-state-title">No tournament yet</div>
          <div className="empty-state-message">Join your county lobby on Home. We'll take it from there.</div>
        </div>
      </div>
    )
  }

  const myBroadcast = getPlayerActiveBroadcast(currentPlayerId)
  const availableBroadcasts = getActiveBroadcasts(tournament.id, currentPlayerId)
  const upcomingSlots = getUpcomingAvailability(tournament, currentPlayerId)
  const seeds = getSeeds(tournament)
  const incomingOffers = getIncomingOffers(currentPlayerId)
  const outgoingOffers = getOutgoingOffers(currentPlayerId)
  const opponentRows = buildOpponentRows(upcomingSlots, availableBroadcasts)
  const dateGroups = groupRowsByDate(opponentRows)
  const outgoingOfferByKey = new Map(
    outgoingOffers.map(offer => [
      offerKey(offer.recipientId, offer.proposedDate, offer.proposedStartHour, offer.proposedEndHour),
      offer,
    ])
  )
  const matchedOutgoingOfferIds = new Set(
    opponentRows
      .map(row => outgoingOfferByKey.get(offerKey(row.playerId, row.date, row.startHour, row.endHour))?.offerId)
      .filter((offerId): offerId is string => Boolean(offerId))
  )
  const standaloneOutgoingOffers = outgoingOffers.filter(offer => !matchedOutgoingOfferIds.has(offer.offerId))

  function playerSeedLabel(playerId: string): string {
    const seed = seeds.get(playerId)
    return seed != null ? ` (${seed})` : ''
  }

  function handleCreate() {
    if (!location.trim()) { setFeedback('Add a court so players know where to meet.'); setTimeout(() => setFeedback(''), 2000); return }
    const result = createBroadcast(currentPlayerId, currentPlayerName, tournament!.id, date, startTime, endTime, location.trim(), message.trim() || undefined)
    if (result) {
      setShowForm(false); setLocation(''); setMessage('')
      showSuccess("You're visible to nearby players.")
    } else {
      setFeedback("You're already broadcasting one time."); setTimeout(() => setFeedback(''), 2000)
    }
    setTick(t => t + 1)
  }

  function handleAskToPlay(row: OpponentRow) {
    const result = createMatchOffer({ id: currentPlayerId, name: currentPlayerName }, { id: row.playerId, name: row.playerName }, tournament!.id, row.date, `${formatHourCompact(row.startHour)}`, row.day, row.startHour, row.endHour)
    if ('error' in result) {
      setFeedback(result.error)
      setTimeout(() => setFeedback(''), 2500)
      return
    }
    setFeedback(`Request sent to ${row.playerName}.`)
    showSuccess(`Request sent to ${row.playerName}.`)
    setAskingRow(row)
    setTimeout(() => setFeedback(''), 2500)
    setTick(t => t + 1)
  }

  async function handleAcceptOffer(offer: MatchOffer) {
    const result = await acceptMatchOffer(offer.offerId, currentPlayerId)
    if ('error' in result) { setFeedback(result.error) } else { setFeedback('Match scheduled.'); if (result.matchConfirmed) onMatchConfirmed() }
    setTimeout(() => setFeedback(''), 2500); setTick(t => t + 1)
  }

  function handleDeclineOffer(offer: MatchOffer) {
    const result = declineMatchOffer(offer.offerId, currentPlayerId)
    if ('error' in result) { setFeedback(result.error) } else { setFeedback('Request declined.') }
    setTimeout(() => setFeedback(''), 2000); setTick(t => t + 1)
  }

  function handleCancelOffer(offer: MatchOffer) {
    cancelMatchOffer(offer.offerId, currentPlayerId)
    setFeedback('Request withdrawn.'); setTimeout(() => setFeedback(''), 2000); setTick(t => t + 1)
  }

  function handleCancel() {
    if (myBroadcast) { cancelBroadcast(myBroadcast.id, currentPlayerId); setFeedback('No longer broadcasting.'); setTimeout(() => setFeedback(''), 2000); setTick(t => t + 1) }
  }

  function handleStartTimeChange(val: string) { setStartTime(val); setEndTime(defaultEndTime(val)) }

  return (
    <div className="playnow-tab">
      {feedback && <div className="broadcast-feedback">{feedback}</div>}

      {/* === INFO BANNER: Clarify Tournament vs Casual === */}
      <div className="pn-info-banner">
        <div className="pn-info-banner-content">
          <span className="pn-info-banner-icon" onClick={() => setShowInfoTooltip(!showInfoTooltip)} role="button" tabIndex={0} aria-label="More info">&#9432;</span>
          <span className="pn-info-banner-text">See who's available and start a match. Rally handles the scheduling.</span>
        </div>
        {showInfoTooltip && (
          <div className="pn-info-tooltip">
            <strong>Tournament matches</strong> count toward your bracket and standings.
            <br /><strong>Quick Play</strong> is for pickup games with other players in your tournament.
            <br />Tap &quot;Request match&quot; below to propose a casual game.
          </div>
        )}
      </div>

      {/* Tournament matches removed — they belong on the Tournament tab */}

      {incomingOffers.length > 0 && (
        <div className="pn-section">
          <div className="section-header">Incoming requests</div>
          <div className="offer-list">
            {incomingOffers.map(offer => (
              <div key={offer.offerId} className="card offer-card offer-card-incoming">
                <div className="offer-card-status-row">
                  <span className="card-status-label card-status-label--purple">Needs response</span>
                  <span className="card-meta-chip">Expires in {timeRemaining(offer.expiresAt)}</span>
                </div>
                <div className="offer-card-main">
                  <div className="card-title">{offer.senderName}</div>
                  <div className="offer-card-supporting">{offer.proposedTime} · {formatDate(offer.proposedDate)}</div>
                </div>
                <div className="offer-card-actions">
                  <button className="btn btn-primary offer-accept-btn" onClick={() => handleAcceptOffer(offer)}>Accept</button>
                  <button className="btn offer-decline-btn" onClick={() => handleDeclineOffer(offer)}>Decline</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {standaloneOutgoingOffers.length > 0 && (
        <div className="pn-section">
          <div className="section-header">Sent requests</div>
          <div className="offer-list">
            {standaloneOutgoingOffers.map(offer => (
              <div key={offer.offerId} className="card offer-card offer-card-outgoing">
                <div className="offer-card-status-row">
                  <span className="card-status-label card-status-label--slate">Pending</span>
                  <span className="card-meta-chip">Expires in {timeRemaining(offer.expiresAt)}</span>
                </div>
                <div className="offer-card-main">
                  <div className="card-title">to {offer.recipientName}</div>
                  <div className="offer-card-supporting">{offer.proposedTime} · {formatDate(offer.proposedDate)}</div>
                </div>
                <button className="btn btn-small offer-cancel-btn" onClick={() => handleCancelOffer(offer)}>Cancel request</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {myBroadcast ? (
        <div className="card pn-my-broadcast pn-my-broadcast-active">
          <div className="card-status-row">
            <div className="broadcast-player-name">
              <span className="pn-active-indicator" />
              <span className="card-status-label card-status-label--green">Available now</span>
            </div>
            <div className="card-meta-chip card-meta-chip--green">Active</div>
          </div>
          <div className="card-summary-main">
            <div className="card-title">You&apos;re visible to nearby players.</div>
            <div className="card-supporting">Anyone in your tournament can request this time.</div>
          </div>
          <div className="broadcast-card-details">
            <span className="broadcast-detail">{formatDate(myBroadcast.date)}</span>
            <span className="broadcast-detail">{formatTimeRange(myBroadcast.startTime, myBroadcast.endTime || defaultEndTime(myBroadcast.startTime))}</span>
            <span className="broadcast-detail">{myBroadcast.location}</span>
          </div>
          <div className="pn-broadcast-expiry">Visible for {timeRemaining(myBroadcast.expiresAt)}</div>
          <button className="btn btn-small broadcast-cancel-btn" onClick={handleCancel}>Stop broadcasting</button>
        </div>
      ) : !showForm ? (
        <div className="card broadcast-play-now-card">
          <div className="action-card-status-row">
            <span className="card-status-label card-status-label--green">Quick Play</span>
          </div>
          <div className="action-card-main">
            <div className="action-card-opponent">I&apos;m <span className="bg-em">free to play.</span></div>
            <div className="action-card-supporting">Broadcast your availability so nearby tournament players can send a request.</div>
          </div>
          <button className="btn btn-primary broadcast-post-btn" onClick={() => setShowForm(true)}>
            Post Availability
          </button>
        </div>
      ) : (
        <div className="card action-card action-respond broadcast-create-card">
          <div className="action-card-status-row">
            <div className="card-status-label card-status-label--blue">New broadcast</div>
          </div>
          <div className="action-card-main">
            <div className="action-card-opponent">I want to play.</div>
            <div className="action-card-supporting">Share a time and place. Nearby players can send a match request.</div>
          </div>
          <div className="action-card-expansion">
            <div className="broadcast-form-fields">
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
                <label className="field-label">Court</label>
                <input
                  type="text"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="Marin Tennis Club"
                />
              </div>
              <div className="field">
                <label className="field-label">Note (optional)</label>
                <input
                  type="text"
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Looking for a hitting partner"
                />
              </div>
            </div>
            <div className="broadcast-form-actions">
              <button className="btn" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreate}>Broadcast</button>
            </div>
          </div>
        </div>
      )}

      {/* === CASUAL PLAY SECTION === */}
      <div className="pn-section">
        <div className="section-header">Who's free</div>
        {dateGroups.length === 0 ? (
          <div className="pn-empty-state">
            <div className="pn-empty-title">Quiet right now.</div>
            <div className="pn-empty-desc">Post when you're free. Players nearby will see it.</div>
            {!myBroadcast && !showForm && <button className="btn btn-primary pn-empty-cta" onClick={() => setShowForm(true)}>I'm free to play</button>}
          </div>
        ) : dateGroups.map(group => (
          <div key={group.date} className="pn-date-group">
            <div className="pn-date-header">{group.dateLabel}</div>
            <div className="pn-opponent-list">
              {group.entries.map((row, i) => {
                const isAsking = askingRow?.playerId === row.playerId &&
                  askingRow?.date === row.date &&
                  askingRow?.startHour === row.startHour
                const matchingOutgoingOffer = outgoingOfferByKey.get(
                  offerKey(row.playerId, row.date, row.startHour, row.endHour)
                )
                const hasPendingRequest = Boolean(matchingOutgoingOffer)

                return (
                <div key={`${row.playerId}-${row.date}-${i}`}>
                  <div
                    className={`card action-card ${(row.isNow && !hasPendingRequest) ? 'action-confirmed' : 'action-respond'} pn-opponent-row pn-opponent-actionable`}
                    onClick={() => {
                      setMessagingPlayerId(null)
                      setAskingRow(isAsking ? null : row)
                    }}
                  >
                    <div className="action-card-status-row">
                      <div className={`card-status-label ${hasPendingRequest ? 'card-status-label--purple' : (row.isNow ? 'card-status-label--green' : 'card-status-label--slate')}`}>
                        {hasPendingRequest ? 'Request sent' : row.isNow ? 'Available now' : 'Available'}
                      </div>
                      <div className="card-meta-chip">
                        {hasPendingRequest && matchingOutgoingOffer
                          ? `Expires in ${timeRemaining(matchingOutgoingOffer.expiresAt)}`
                          : `${row.dateLabel} ${row.timeLabel}`}
                      </div>
                    </div>
                    <div className="pn-opponent-card-main">
                      <div className="pn-opponent-avatar">{row.playerName[0]?.toUpperCase() ?? '?'}</div>
                      <div className="pn-opponent-info">
                        <div className="action-card-opponent">{row.playerName}<span className="seed-label">{playerSeedLabel(row.playerId)}</span></div>
                        <div className="action-card-supporting">
                          {hasPendingRequest
                            ? 'Waiting on their response.'
                            : row.location ? row.location : 'Tournament player available for a casual match.'}
                        </div>
                        {row.message && <div className="pn-opponent-message">&quot;{row.message}&quot;</div>}
                      </div>
                    </div>
                    <div className="action-card-buttons">
                      <button
                        className={`btn ${hasPendingRequest ? '' : 'btn-primary'} btn-small pn-ask-btn`}
                        onClick={e => { e.stopPropagation(); setMessagingPlayerId(null); setAskingRow(isAsking ? null : row) }}
                      >
                        {hasPendingRequest ? 'View request' : 'Request match'}
                      </button>
                      <button className={`match-card-msg-btn ${messagingPlayerId === row.playerId ? 'active' : ''}`} onClick={e => { e.stopPropagation(); setAskingRow(null); setMessagingPlayerId(messagingPlayerId === row.playerId ? null : row.playerId) }} aria-label="Message player">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 3h12v8H4l-2 2V3z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
                        {hasUnreadFrom(currentPlayerId, row.playerId) && <span className="msg-unread-dot" />}
                      </button>
                    </div>
                    {isAsking && (
                      <div className="action-card-expansion" onClick={e => e.stopPropagation()}>
                        <div className="workflow-module quickplay-request-panel">
                          <div className="quickplay-request-header">
                            <div className="workflow-status workflow-status--blue">{hasPendingRequest ? 'Request sent' : 'Match request'}</div>
                            <div className="quickplay-request-copy">
                              {hasPendingRequest && matchingOutgoingOffer
                                ? `${row.playerName} has ${timeRemaining(matchingOutgoingOffer.expiresAt)} to respond.`
                                : 'Confirm the time below to send your request.'}
                            </div>
                          </div>
                          <div className="quickplay-request-summary">
                            <div className="quickplay-request-detail">
                              <div className="quickplay-request-detail-label">Time</div>
                              <div className="quickplay-request-detail-value">{row.dateLabel} · {row.timeLabel}</div>
                            </div>
                            {row.location && (
                              <div className="quickplay-request-detail">
                                <div className="quickplay-request-detail-label">Location</div>
                                <div className="quickplay-request-detail-value">{row.location}</div>
                              </div>
                            )}
                          </div>
                          <div className="workflow-actions">
                            <button className="btn" onClick={() => setAskingRow(null)}>Close</button>
                            {hasPendingRequest && matchingOutgoingOffer ? (
                              <button className="btn" onClick={() => handleCancelOffer(matchingOutgoingOffer)}>Withdraw request</button>
                            ) : (
                              <button className="btn btn-primary" onClick={() => handleAskToPlay(row)}>Request match</button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    {messagingPlayerId === row.playerId && (
                      <div className="action-card-expansion" onClick={e => e.stopPropagation()}>
                        <MessagePanel currentPlayerId={currentPlayerId} currentPlayerName={currentPlayerName} otherPlayerId={row.playerId} otherPlayerName={row.playerName} onClose={() => setMessagingPlayerId(null)} />
                      </div>
                    )}
                  </div>
                </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
