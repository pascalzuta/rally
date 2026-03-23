import { useState, useMemo } from 'react'
import { getTournamentsByCounty, getPlayerRating } from '../store'
import { getBuddies, getPendingRequests, sendBuddyRequest } from '../buddyStore'
import { PlayerProfile } from '../types'

interface Props {
  profile: PlayerProfile
  onClose: () => void
  onBuddyAdded?: () => void
}

interface PlayerEntry {
  id: string
  name: string
  rating: number
}

export default function AddBuddySheet({ profile, onClose, onBuddyAdded }: Props) {
  const [query, setQuery] = useState('')
  const [sending, setSending] = useState<string | null>(null)
  const [sent, setSent] = useState<Set<string>>(new Set())

  // Collect unique players from county tournaments
  const players = useMemo<PlayerEntry[]>(() => {
    const tournaments = getTournamentsByCounty(profile.county)
    const map = new Map<string, PlayerEntry>()
    for (const t of tournaments) {
      for (const p of t.players) {
        if (!map.has(p.id)) {
          map.set(p.id, {
            id: p.id,
            name: p.name,
            rating: getPlayerRating(p.id, p.name).rating,
          })
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.rating - a.rating)
  }, [profile.county])

  const existingBuddyIds = useMemo(() => {
    const buddies = getBuddies(profile.id)
    const pending = getPendingRequests(profile.id)
    return new Set([
      ...buddies.map(b => b.requesterId === profile.id ? b.recipientId : b.requesterId),
      ...pending.map(b => b.requesterId),
      profile.id,
    ])
  }, [profile.id])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return players.filter(p => {
      if (existingBuddyIds.has(p.id)) return false
      if (!q) return true
      return p.name.toLowerCase().includes(q)
    })
  }, [players, query, existingBuddyIds])

  async function handleSend(recipientId: string, recipientName: string) {
    setSending(recipientId)
    try {
      await sendBuddyRequest(profile.id, profile.name, recipientId, recipientName)
      setSent(prev => new Set(prev).add(recipientId))
      onBuddyAdded?.()
    } catch (err) {
      console.warn('[Rally] Failed to send buddy request:', err)
    } finally {
      setSending(null)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      {/* Backdrop */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
      }} />

      {/* Sheet */}
      <div
        style={{
          position: 'relative',
          background: 'var(--color-surface)',
          borderRadius: '16px 16px 0 0',
          padding: '20px 16px 32px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div style={{
          width: 40,
          height: 4,
          borderRadius: 2,
          background: 'var(--color-divider)',
          margin: '0 auto 4px',
        }} />

        <div style={{ fontWeight: 700, fontSize: 17 }}>Add a Tennis Buddy</div>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: -6 }}>
          Find players in {profile.county} and send a buddy request.
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search by name…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-divider)',
            background: 'var(--color-surface-raised, #1c1c1e)',
            color: 'var(--color-text-primary)',
            fontSize: 14,
            outline: 'none',
            boxSizing: 'border-box',
          }}
          autoFocus
        />

        {/* Player list */}
        <div style={{
          overflowY: 'auto',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          {filtered.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', padding: '8px 0' }}>
              {query ? `No players found for "${query}".` : 'No other players in your county yet.'}
            </div>
          )}
          {filtered.map(player => {
            const isSent = sent.has(player.id)
            const isLoading = sending === player.id
            return (
              <div key={player.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 4px',
                borderBottom: '1px solid var(--color-divider)',
              }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'var(--color-accent-muted, rgba(59,130,246,0.15))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: 13,
                  color: 'var(--color-accent, #3b82f6)',
                  flexShrink: 0,
                }}>
                  {player.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{player.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                    Rating {Math.round(player.rating)}
                  </div>
                </div>
                <button
                  disabled={isSent || isLoading}
                  onClick={() => handleSend(player.id, player.name)}
                  style={{
                    background: isSent ? 'rgba(34,197,94,0.12)' : 'var(--color-accent, #3b82f6)',
                    color: isSent ? 'var(--color-positive-primary)' : '#fff',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    padding: '6px 14px',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: isSent ? 'default' : 'pointer',
                    opacity: isLoading ? 0.6 : 1,
                  }}
                >
                  {isSent ? 'Sent' : isLoading ? '…' : 'Add'}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
