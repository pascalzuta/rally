import { useState, useEffect } from 'react'
import {
  getAcceptedBuddies, getPendingBuddyRequests, getBuddyName, getBuddyId,
  acceptBuddyRequest, declineBuddyRequest, removeBuddy,
  sendPing, getIncomingPings, respondToPing, searchPlayers,
  refreshBuddiesFromRemote, refreshPingsFromRemote,
} from '../buddies'
import { PlayerProfile, Buddy, BuddyPing } from '../types'

interface Props {
  profile: PlayerProfile
}

export default function BuddiesSection({ profile }: Props) {
  const [buddies, setBuddies] = useState<Buddy[]>(getAcceptedBuddies(profile.id))
  const [pending, setPending] = useState<Buddy[]>(getPendingBuddyRequests(profile.id))
  const [incomingPings, setIncomingPings] = useState<BuddyPing[]>(getIncomingPings(profile.id))
  const [showPingForm, setShowPingForm] = useState<string | null>(null)
  const [pingDate, setPingDate] = useState('')
  const [pingTime, setPingTime] = useState('')
  const [pingLocation, setPingLocation] = useState('')
  const [pingMessage, setPingMessage] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ id: string; name: string }[]>([])
  const [searching, setSearching] = useState(false)
  const [showSearch, setShowSearch] = useState(false)

  useEffect(() => {
    async function refresh() {
      await refreshBuddiesFromRemote(profile.id)
      await refreshPingsFromRemote(profile.id)
      setBuddies(getAcceptedBuddies(profile.id))
      setPending(getPendingBuddyRequests(profile.id))
      setIncomingPings(getIncomingPings(profile.id))
    }
    refresh()
  }, [profile.id])

  function refreshLocal() {
    setBuddies(getAcceptedBuddies(profile.id))
    setPending(getPendingBuddyRequests(profile.id))
    setIncomingPings(getIncomingPings(profile.id))
  }

  async function handleAccept(buddyId: string) {
    await acceptBuddyRequest(buddyId)
    refreshLocal()
  }

  async function handleDecline(buddyId: string) {
    await declineBuddyRequest(buddyId)
    refreshLocal()
  }

  async function handleRemove(buddyId: string) {
    await removeBuddy(buddyId)
    refreshLocal()
  }

  async function handleSendPing(recipientId: string, recipientName: string) {
    if (!pingDate || !pingTime) return
    await sendPing(profile.id, profile.name, recipientId, recipientName, pingDate, pingTime, pingLocation || undefined, pingMessage || undefined)
    setShowPingForm(null)
    setPingDate(''); setPingTime(''); setPingLocation(''); setPingMessage('')
    refreshLocal()
  }

  async function handleRespondPing(pingId: string, response: 'accepted' | 'declined') {
    await respondToPing(pingId, response)
    refreshLocal()
  }

  async function handleSearch() {
    if (searchQuery.trim().length < 2) return
    setSearching(true)
    const excludeIds = [profile.id, ...buddies.map(b => getBuddyId(b, profile.id))]
    const results = await searchPlayers(searchQuery.trim(), profile.county, excludeIds)
    setSearchResults(results)
    setSearching(false)
  }

  const hasBuddies = buddies.length > 0 || pending.length > 0 || incomingPings.length > 0

  return (
    <div className="card buddies-section">
      <div className="card-status-row">
        <div className="card-status-label card-status-label--purple">Tennis Buddies</div>
        {buddies.length > 0 && (
          <div className="card-meta-chip">{buddies.length} buddy{buddies.length !== 1 ? 'ies' : 'y'}</div>
        )}
      </div>

      {/* Incoming pings */}
      {incomingPings.length > 0 && (
        <div className="buddies-pings">
          {incomingPings.map(ping => (
            <div key={ping.id} className="buddies-ping-card">
              <div className="buddies-ping-header">
                <strong>{ping.senderName}</strong> wants to play
              </div>
              <div className="buddies-ping-details">
                {ping.proposedDate} at {ping.proposedTime}
                {ping.location && <> · {ping.location}</>}
              </div>
              {ping.message && <div className="buddies-ping-message">{ping.message}</div>}
              <div className="buddies-ping-actions">
                <button className="btn btn-small btn-positive" onClick={() => handleRespondPing(ping.id, 'accepted')}>Accept</button>
                <button className="btn btn-small btn-outline" onClick={() => handleRespondPing(ping.id, 'declined')}>Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pending requests */}
      {pending.length > 0 && (
        <div className="buddies-pending">
          <div className="buddies-subtitle">Buddy Requests</div>
          {pending.map(b => (
            <div key={b.id} className="buddies-request-row">
              <span className="buddies-request-name">{b.requesterName}</span>
              <div className="buddies-request-actions">
                <button className="btn btn-small btn-positive" onClick={() => handleAccept(b.id)}>Accept</button>
                <button className="btn btn-small btn-outline" onClick={() => handleDecline(b.id)}>Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Buddy list */}
      {buddies.length > 0 ? (
        <div className="buddies-list">
          {buddies.map(b => {
            const buddyName = getBuddyName(b, profile.id)
            const buddyId = getBuddyId(b, profile.id)
            const isPinging = showPingForm === buddyId
            return (
              <div key={b.id} className="buddies-row">
                <div className="buddies-row-info">
                  <div className="buddies-row-name">{buddyName}</div>
                </div>
                <div className="buddies-row-actions">
                  <button
                    className="btn btn-small"
                    onClick={() => setShowPingForm(isPinging ? null : buddyId)}
                  >
                    {isPinging ? 'Cancel' : 'Ping'}
                  </button>
                  <button
                    className="btn btn-small btn-outline btn-danger-text"
                    onClick={() => handleRemove(b.id)}
                  >
                    Remove
                  </button>
                </div>
                {isPinging && (
                  <div className="buddies-ping-form">
                    <input type="date" className="input" value={pingDate} onChange={e => setPingDate(e.target.value)} />
                    <input type="time" className="input" value={pingTime} onChange={e => setPingTime(e.target.value)} />
                    <input className="input" placeholder="Location (optional)" value={pingLocation} onChange={e => setPingLocation(e.target.value)} />
                    <input className="input" placeholder="Message (optional)" value={pingMessage} onChange={e => setPingMessage(e.target.value)} />
                    <button className="btn btn-small btn-positive" onClick={() => handleSendPing(buddyId, buddyName)}>
                      Send Ping
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : !showSearch ? (
        <div className="buddies-empty">
          <div className="card-supporting">Find tennis partners in {profile.county} to play anytime.</div>
        </div>
      ) : null}

      {/* Search */}
      {showSearch ? (
        <div className="buddies-search">
          <div className="buddies-search-input-row">
            <input
              className="input"
              placeholder="Search players by name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
            <button className="btn btn-small" onClick={handleSearch} disabled={searching}>
              {searching ? '...' : 'Search'}
            </button>
          </div>
          {searchResults.length > 0 && (
            <div className="buddies-search-results">
              {searchResults.map(r => (
                <div key={r.id} className="buddies-search-result-row">
                  <span>{r.name}</span>
                  <button
                    className="btn btn-small"
                    onClick={async () => {
                      const { sendBuddyRequest } = await import('../buddies')
                      await sendBuddyRequest(profile.id, profile.name, r.id, r.name)
                      setSearchResults(prev => prev.filter(p => p.id !== r.id))
                      refreshLocal()
                    }}
                  >
                    Add Buddy
                  </button>
                </div>
              ))}
            </div>
          )}
          <button className="btn-link" onClick={() => { setShowSearch(false); setSearchResults([]) }}>Cancel</button>
        </div>
      ) : (
        <button className="btn btn-small buddies-find-btn" onClick={() => setShowSearch(true)}>
          Find Buddies
        </button>
      )}
    </div>
  )
}
