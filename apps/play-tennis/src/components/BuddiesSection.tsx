import { useState, useEffect, useCallback } from 'react'
import { PlayerProfile, Buddy, BuddyPing } from '../types'
import {
  getBuddies, getPendingRequests, getPendingPings, getOutgoingPings,
  acceptBuddyRequest, declineBuddyRequest, removeBuddy,
  respondToPing, pingBuddy, subscribeBuddyUpdates, syncBuddiesFromRemote,
} from '../buddyStore'
import { getPlayerRating } from '../store'
import BuddyCard from './BuddyCard'
import BuddyPingCard from './BuddyPingCard'
import AddBuddySheet from './AddBuddySheet'
import PingSheet from './PingSheet'

interface Props {
  profile: PlayerProfile
}

export default function BuddiesSection({ profile }: Props) {
  const [buddies, setBuddies] = useState<Buddy[]>([])
  const [pendingRequests, setPendingRequests] = useState<Buddy[]>([])
  const [incomingPings, setIncomingPings] = useState<BuddyPing[]>([])
  const [outgoingPings, setOutgoingPings] = useState<BuddyPing[]>([])
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [pingTarget, setPingTarget] = useState<Buddy | null>(null)

  const refresh = useCallback(() => {
    setBuddies(getBuddies(profile.id))
    setPendingRequests(getPendingRequests(profile.id))
    setIncomingPings(getPendingPings(profile.id))
    setOutgoingPings(getOutgoingPings(profile.id))
  }, [profile.id])

  useEffect(() => {
    refresh()
    syncBuddiesFromRemote(profile.id).then(refresh)
    const unsub = subscribeBuddyUpdates(profile.id, refresh)
    return unsub
  }, [profile.id, refresh])

  async function handleAcceptRequest(buddyId: string) {
    await acceptBuddyRequest(buddyId)
    refresh()
  }

  async function handleDeclineRequest(buddyId: string) {
    await declineBuddyRequest(buddyId)
    refresh()
  }

  async function handleRemoveBuddy(buddyId: string) {
    await removeBuddy(buddyId)
    refresh()
  }

  async function handleAcceptPing(pingId: string) {
    await respondToPing(pingId, 'accepted')
    refresh()
  }

  async function handleDeclinePing(pingId: string) {
    await respondToPing(pingId, 'declined')
    refresh()
  }

  async function handleSendPing(proposedDate: string, proposedTime: string, location?: string) {
    if (!pingTarget) return
    const recipientId = pingTarget.requesterId === profile.id
      ? pingTarget.recipientId
      : pingTarget.requesterId
    const recipientName = pingTarget.requesterId === profile.id
      ? pingTarget.recipientName
      : pingTarget.requesterName
    await pingBuddy(
      profile.id,
      profile.name,
      recipientId,
      recipientName,
      proposedDate,
      proposedTime,
      location,
    )
    setPingTarget(null)
    refresh()
  }

  const hasSomething = buddies.length > 0 || pendingRequests.length > 0 || incomingPings.length > 0 || outgoingPings.length > 0

  return (
    <>
      {/* Pending buddy requests */}
      {pendingRequests.map(req => (
        <div key={req.id} className="card" style={{ cursor: 'default' }}>
          <div className="card-status-row">
            <div className="card-status-label card-status-label--blue">Buddy Request</div>
          </div>
          <div className="card-summary-main">
            <div className="card-title">{req.requesterName} wants to be Tennis Buddies</div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              className="btn-primary"
              style={{ flex: 1, fontSize: 13 }}
              onClick={() => handleAcceptRequest(req.id)}
            >
              Accept
            </button>
            <button
              style={{
                flex: 1,
                background: 'none',
                border: '1px solid var(--color-divider)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text-secondary)',
                fontSize: 13,
                padding: '8px',
                cursor: 'pointer',
              }}
              onClick={() => handleDeclineRequest(req.id)}
            >
              Decline
            </button>
          </div>
        </div>
      ))}

      {/* Incoming pings */}
      {incomingPings.map(ping => (
        <BuddyPingCard
          key={ping.id}
          ping={ping}
          currentPlayerId={profile.id}
          onAccept={handleAcceptPing}
          onDecline={handleDeclinePing}
        />
      ))}

      {/* Outgoing pings (waiting) */}
      {outgoingPings.filter(p => !p.response).map(ping => (
        <BuddyPingCard
          key={ping.id}
          ping={ping}
          currentPlayerId={profile.id}
        />
      ))}

      {/* Buddies row */}
      <div className="card" style={{ cursor: 'default' }}>
        <div className="card-status-row">
          <div className="card-status-label card-status-label--slate">Tennis Buddies</div>
          {buddies.length > 0 && (
            <div className="card-meta-chip">{buddies.length}</div>
          )}
        </div>

        {!hasSomething && buddies.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '6px 0 10px' }}>
            Add players you play with regularly to ping them for a hit.
          </div>
        )}

        {buddies.length > 0 && (
          <div style={{
            display: 'flex',
            overflowX: 'auto',
            gap: 12,
            paddingBottom: 6,
            paddingTop: 8,
            position: 'relative',
          }}>
            {buddies.map(buddy => {
              const buddyPlayerId = buddy.requesterId === profile.id ? buddy.recipientId : buddy.requesterId
              const buddyName = buddy.requesterId === profile.id ? buddy.recipientName : buddy.requesterName
              const rating = getPlayerRating(buddyPlayerId, buddyName).rating
              return (
                <BuddyCard
                  key={buddy.id}
                  buddy={buddy}
                  currentPlayerId={profile.id}
                  rating={rating}
                  onPing={setPingTarget}
                  onRemove={handleRemoveBuddy}
                />
              )
            })}
          </div>
        )}

        <button
          onClick={() => setShowAddSheet(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'none',
            border: '1px dashed var(--color-divider)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--color-text-secondary)',
            fontSize: 13,
            padding: '8px 14px',
            cursor: 'pointer',
            marginTop: buddies.length > 0 ? 10 : 0,
            width: '100%',
            justifyContent: 'center',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Add a Tennis Buddy
        </button>
      </div>

      {showAddSheet && (
        <AddBuddySheet
          profile={profile}
          onClose={() => setShowAddSheet(false)}
          onBuddyAdded={() => { refresh(); setShowAddSheet(false) }}
        />
      )}

      {pingTarget && (
        <PingSheet
          buddy={pingTarget}
          currentPlayerId={profile.id}
          onSend={handleSendPing}
          onClose={() => setPingTarget(null)}
        />
      )}
    </>
  )
}
