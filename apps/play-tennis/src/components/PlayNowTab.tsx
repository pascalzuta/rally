import { useState, useEffect } from 'react'
import { createBroadcast, getActiveBroadcasts, getPlayerActiveBroadcast, cancelBroadcast, getUpcomingAvailability, getSeeds, UpcomingSlot, createMatchOffer, getIncomingOffers, getOutgoingOffers, acceptMatchOffer, declineMatchOffer, cancelMatchOffer, cleanExpiredOffers, hasUnreadFrom } from '../store'
import { Tournament, Match, MatchBroadcast, MatchOffer } from '../types'
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

function getPlayerTournamentMatches(t: Tournament, playerId: string): (Match & { opponentName: string })[] {
  const playerMap = new Map(t.players.map(p => [p.id, p.name]))
  return t.matches
    .filter(m => !m.completed && (m.player1Id === playerId || m.player2Id === playerId) && m.player1Id != null && m.player2Id != null)
    .map(m => {
      const opponentId = m.player1Id === playerId ? m.player2Id! : m.player1Id!
      return { ...m, opponentName: playerMap.get(opponentId) || 'TBD' }
    })
    .sort((a, b) => {
      const tierOrder: Record<string, number> = { auto: 0, 'needs-accept': 1, 'needs-negotiation': 2 }
      const aTier = a.schedule?.schedulingTier ? tierOrder[a.schedule.schedulingTier] ?? 3 : 3
      const bTier = b.schedule?.schedulingTier ? tierOrder[b.schedule.schedulingTier] ?? 3 : 3
      if (aTier !== bTier) return aTier - bTier
      return a.round - b.round
    })
}

function schedulingTierLabel(match: Match): { label: string; className: string; border: string } {
  const tier = match.schedule?.schedulingTier
  if (tier === 'auto') return { label: 'Confirmed', className: 'pn-tier-confirmed', border: 'score' }
  if (tier === 'needs-accept') return { label: 'Proposed', className: 'pn-tier-proposed', border: 'respond' }
  if (tier === 'needs-negotiation') return { label: 'Needs Scheduling', className: 'pn-tier-unscheduled', border: 'schedule' }
  return { label: 'Unscheduled', className: 'pn-tier-unscheduled', border: 'schedule' }
}

function formatSlotTime(match: Match): string {
  const slot = match.schedule?.confirmedSlot
  if (!slot) return 'Time TBD'
  return `${formatHour(slot.startHour)} – ${formatHour(slot.endHour)}`
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

  if (!tournament || tournament.status !== 'in-progress') {
    return (
      <div className="playnow-tab">
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
          </div>
          <div className="empty-state-title">No active tournament</div>
          <div className="empty-state-message">Join an active tournament to find matches and play</div>
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
  const pendingRecipientIds = new Set(outgoingOffers.map(o => o.recipientId))
  const opponentRows = buildOpponentRows(upcomingSlots, availableBroadcasts).filter(r => !pendingRecipientIds.has(r.playerId))
  const dateGroups = groupRowsByDate(opponentRows)

  function playerSeedLabel(playerId: string): string {
    const seed = seeds.get(playerId)
    return seed != null ? ` (${seed})` : ''
  }

  function handleCreate() {
    if (!location.trim()) { setFeedback('Please enter a location'); setTimeout(() => setFeedback(''), 2000); return }
    const result = createBroadcast(currentPlayerId, currentPlayerName, tournament!.id, date, startTime, endTime, location.trim(), message.trim() || undefined)
    if (result) {
      setShowForm(false); setLocation(''); setMessage('')
      showSuccess("You're now visible to other players!")
    } else {
      setFeedback('You already have an active broadcast'); setTimeout(() => setFeedback(''), 2000)
    }
    setTick(t => t + 1)
  }

  function handleAskToPlay(row: OpponentRow) {
    const result = createMatchOffer({ id: currentPlayerId, name: currentPlayerName }, { id: row.playerId, name: row.playerName }, tournament!.id, row.date, `${formatHour(row.startHour)}`, row.day, row.startHour, row.endHour)
    if ('error' in result) { setFeedback(result.error) } else { setFeedback('Match offer sent') }
    setAskingRow(null); setTimeout(() => setFeedback(''), 2500); setTick(t => t + 1)
  }

  async function handleAcceptOffer(offer: MatchOffer) {
    const result = await acceptMatchOffer(offer.offerId, currentPlayerId)
    if ('error' in result) { setFeedback(result.error) } else { setFeedback('Match scheduled'); if (result.matchConfirmed) onMatchConfirmed() }
    setTimeout(() => setFeedback(''), 2500); setTick(t => t + 1)
  }

  function handleDeclineOffer(offer: MatchOffer) {
    const result = declineMatchOffer(offer.offerId, currentPlayerId)
    if ('error' in result) { setFeedback(result.error) } else { setFeedback('Offer declined') }
    setTimeout(() => setFeedback(''), 2000); setTick(t => t + 1)
  }

  function handleCancelOffer(offer: MatchOffer) {
    cancelMatchOffer(offer.offerId, currentPlayerId)
    setFeedback('Offer cancelled'); setTimeout(() => setFeedback(''), 2000); setTick(t => t + 1)
  }

  function handleCancel() {
    if (myBroadcast) { cancelBroadcast(myBroadcast.id, currentPlayerId); setFeedback('Broadcast cancelled'); setTimeout(() => setFeedback(''), 2000); setTick(t => t + 1) }
  }

  function handleStartTimeChange(val: string) { setStartTime(val); setEndTime(defaultEndTime(val)) }

  const tournamentMatches = getPlayerTournamentMatches(tournament, currentPlayerId)

  return (
    <div className="playnow-tab">
      {feedback && <div className="broadcast-feedback">{feedback}</div>}

      {/* === INFO BANNER: Clarify Tournament vs Casual === */}
      <div className="pn-info-banner">
        <div className="pn-info-banner-content">
          <span className="pn-info-banner-icon" onClick={() => setShowInfoTooltip(!showInfoTooltip)} role="button" tabIndex={0} aria-label="More info">&#9432;</span>
          <span className="pn-info-banner-text">See who's available and start a match — Rally handles the scheduling</span>
        </div>
        {showInfoTooltip && (
          <div className="pn-info-tooltip">
            <strong>Tournament Matches</strong> are part of your tournament bracket and count toward standings.
            <br /><strong>Casual Play</strong> lets you find pickup games with other players in your tournament.
            <br />Use &quot;Send Match Request&quot; below to propose a casual game.
          </div>
        )}
      </div>

      {/* Tournament matches removed — they belong on the Tournament tab */}

      {myBroadcast ? (
        <div className="card pn-my-broadcast pn-my-broadcast-active">
          <div className="broadcast-card-header">
            <span className="broadcast-player-name">
              <span className="pn-active-indicator" />
              You're Available
            </span>
            <span className="badge badge-live">Active</span>
          </div>
          <div className="broadcast-card-details">
            <span className="broadcast-detail">{formatDate(myBroadcast.date)}</span>
            <span className="broadcast-detail">{formatTimeRange(myBroadcast.startTime, myBroadcast.endTime || defaultEndTime(myBroadcast.startTime))}</span>
            <span className="broadcast-detail">{myBroadcast.location}</span>
          </div>
          <div className="pn-broadcast-expiry">Available for the next {timeRemaining(myBroadcast.expiresAt)}</div>
          <button className="btn btn-small broadcast-cancel-btn" onClick={handleCancel}>Cancel Broadcast</button>
        </div>
      ) : !showForm ? (
        <button className="broadcast-play-now-btn" onClick={() => setShowForm(true)}>
          <span className="play-now-text">I'm Free to Play</span>
          <span className="play-now-sub">Broadcast your availability — get matched nearby</span>
        </button>
      ) : (
        <div className="card broadcast-form">
          <h3 className="broadcast-form-title">I Want To Play</h3>
          <div className="field"><label className="field-label">Date</label><input type="date" value={date} onChange={e => setDate(e.target.value)} min={new Date().toISOString().split('T')[0]} /></div>
          <div className="broadcast-time-row">
            <div className="field field-half"><label className="field-label">From</label><input type="time" value={startTime} onChange={e => handleStartTimeChange(e.target.value)} className="select-input" /></div>
            <div className="field field-half"><label className="field-label">To</label><input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="select-input" /></div>
          </div>
          <div className="field"><label className="field-label">Location</label><input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Marin Tennis Club" /></div>
          <div className="field"><label className="field-label">Message (optional)</label><input type="text" value={message} onChange={e => setMessage(e.target.value)} placeholder="Anyone free?" /></div>
          <div className="broadcast-form-actions"><button className="btn" onClick={() => setShowForm(false)}>Cancel</button><button className="btn btn-primary" onClick={handleCreate}>Broadcast</button></div>
        </div>
      )}

      {incomingOffers.length > 0 && (
        <div className="pn-section">
          <div className="section-header">Incoming Requests</div>
          <div className="offer-list">
            {incomingOffers.map(offer => (
              <div key={offer.offerId} className="card offer-card offer-card-incoming">
                <div className="offer-card-header"><span className="offer-card-label">Respond</span><span className="offer-card-expires">Expires in {timeRemaining(offer.expiresAt)}</span></div>
                <div className="card-title">{offer.senderName}</div>
                <div className="card-secondary">{offer.proposedTime} · {formatDate(offer.proposedDate)}</div>
                <div className="offer-card-actions">
                  <button className="btn btn-primary offer-accept-btn" onClick={() => handleAcceptOffer(offer)}>Accept</button>
                  <button className="btn offer-decline-btn" onClick={() => handleDeclineOffer(offer)}>Decline</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {outgoingOffers.length > 0 && (
        <div className="pn-section">
          <div className="section-header">Sent Requests</div>
          <div className="offer-list">
            {outgoingOffers.map(offer => (
              <div key={offer.offerId} className="card offer-card offer-card-outgoing">
                <div className="offer-card-header"><span className="offer-card-label">Pending</span><span className="offer-card-expires">Expires in {timeRemaining(offer.expiresAt)}</span></div>
                <div className="card-title">to {offer.recipientName}</div>
                <div className="card-secondary">{offer.proposedTime} · {formatDate(offer.proposedDate)}</div>
                <button className="btn btn-small offer-cancel-btn" onClick={() => handleCancelOffer(offer)}>Cancel Offer</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* === CASUAL PLAY SECTION === */}
      <div className="pn-section">
        <div className="section-header">Who's Free</div>
        {dateGroups.length === 0 ? (
          <div className="pn-empty-state">
            <div className="pn-empty-title">No players available right now</div>
            <div className="pn-empty-desc">Post your availability and we'll notify tournament players</div>
            {!myBroadcast && !showForm && <button className="btn btn-primary pn-empty-cta" onClick={() => setShowForm(true)}>Play Now</button>}
          </div>
        ) : dateGroups.map(group => (
          <div key={group.date} className="pn-date-group">
            <div className="pn-date-header">{group.dateLabel}</div>
            <div className="pn-opponent-list">
              {group.entries.map((row, i) => {
                const isAsking = askingRow?.playerId === row.playerId && askingRow?.date === row.date && askingRow?.timeLabel === row.timeLabel
                return (
                <div key={`${row.playerId}-${row.date}-${i}`}>
                  {isAsking ? (
                    <div className="pn-opponent-row pn-confirm-expanded">
                      <div className="pn-opponent-avatar">{row.playerName[0]?.toUpperCase() ?? '?'}</div>
                      <div className="pn-inline-confirm-text">
                        <strong>{row.playerName}</strong>{playerSeedLabel(row.playerId) && <span className="seed-label">{playerSeedLabel(row.playerId)}</span>} · {row.dateLabel} {row.timeLabel}
                      </div>
                      <div className="pn-inline-confirm-actions">
                        <button className="btn btn-small" onClick={() => setAskingRow(null)}>Cancel</button>
                        <button className="btn btn-primary btn-small" onClick={() => handleAskToPlay(row)}>Send Request</button>
                      </div>
                    </div>
                  ) : (
                    <div className="pn-opponent-row pn-opponent-actionable" onClick={() => setAskingRow(row)}>
                      <div className="pn-opponent-avatar">{row.playerName[0]?.toUpperCase() ?? '?'}</div>
                      <div className="pn-opponent-info">
                        <div className="pn-opponent-name">{row.playerName}<span className="seed-label">{playerSeedLabel(row.playerId)}</span></div>
                        <div className="pn-opponent-meta">
                          {row.isNow && <span className="pn-available-now">Available now</span>}
                          <span>{row.dateLabel} · {row.timeLabel}</span>
                          {row.location && <span> · {row.location}</span>}
                        </div>
                        {row.message && <div className="pn-opponent-message">"{row.message}"</div>}
                      </div>
                      <div className="pn-opponent-actions">
                        <button className={`match-card-msg-btn ${messagingPlayerId === row.playerId ? 'active' : ''}`} onClick={e => { e.stopPropagation(); setMessagingPlayerId(messagingPlayerId === row.playerId ? null : row.playerId) }} aria-label="Message player">
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 3h12v8H4l-2 2V3z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
                          {hasUnreadFrom(currentPlayerId, row.playerId) && <span className="msg-unread-dot" />}
                        </button>
                        <button className="btn btn-primary btn-small pn-ask-btn" onClick={e => { e.stopPropagation(); setMessagingPlayerId(null); setAskingRow(row) }}>Request Match</button>
                      </div>
                    </div>
                  )}
                  {messagingPlayerId === row.playerId && (
                    <div className="pn-message-panel-wrapper" onClick={e => e.stopPropagation()}>
                      <MessagePanel currentPlayerId={currentPlayerId} currentPlayerName={currentPlayerName} otherPlayerId={row.playerId} otherPlayerName={row.playerName} onClose={() => setMessagingPlayerId(null)} />
                    </div>
                  )}
                </div>
              )})}
            </div>
          </div>
        ))}
      </div>

    </div>
  )
}
