import { useState, useEffect } from 'react'
import { LobbyMember } from '../types'
import { getLobbyMembers, subscribeLobbyUpdates } from '../inviteStore'

interface Props {
  shortcode: string
  inviteLinkId: string
  maxPlayers?: number
  /** If true, renders a compact inline version */
  compact?: boolean
}

export default function LobbyStatus({ shortcode, inviteLinkId, maxPlayers = 16, compact = false }: Props) {
  const [members, setMembers] = useState<LobbyMember[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    getLobbyMembers(shortcode).then(m => {
      if (!cancelled) {
        setMembers(m)
        setLoading(false)
      }
    })

    const unsub = subscribeLobbyUpdates(inviteLinkId, m => {
      if (!cancelled) setMembers(m)
    })

    return () => {
      cancelled = true
      unsub()
    }
  }, [shortcode, inviteLinkId])

  const count = members.length
  const pct = Math.min(100, Math.round((count / maxPlayers) * 100))
  const isFull = count >= maxPlayers

  if (loading) {
    return <div className="lobby-status-loading" style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>Loading...</div>
  }

  if (compact) {
    return (
      <div className="lobby-status-compact">
        <span className="lobby-status-count" style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
          {count}/{maxPlayers}
        </span>
        <span style={{ color: 'var(--color-text-secondary)', fontSize: 13, marginLeft: 6 }}>
          {isFull ? 'Lobby full' : 'players joined'}
        </span>
      </div>
    )
  }

  return (
    <div className="lobby-status">
      {/* Count + label */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
        <span style={{
          fontFamily: 'var(--font-mono, monospace)',
          fontVariantNumeric: 'tabular-nums',
          fontSize: 28,
          fontWeight: 800,
          color: isFull ? 'var(--color-text-secondary)' : 'var(--color-positive-primary)',
        }}>
          {count}
        </span>
        <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
          of {maxPlayers} joined
        </span>
        {isFull && (
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            padding: '2px 7px',
            borderRadius: 4,
            background: 'rgba(239,68,68,0.12)',
            color: '#ef4444',
            marginLeft: 4,
          }}>Full</span>
        )}
      </div>

      {/* Progress bar */}
      <div style={{
        height: 5,
        background: 'var(--color-divider)',
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 12,
      }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: isFull ? 'var(--color-text-secondary)' : 'var(--color-positive-primary)',
          borderRadius: 3,
          transition: 'width 0.4s ease',
        }} />
      </div>

      {/* Player chips */}
      {members.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {members.map(m => (
            <span key={m.id} style={{
              background: 'var(--color-surface-raised, #242424)',
              borderRadius: 20,
              padding: '3px 10px',
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--color-text-primary)',
            }}>
              {m.displayName.split(' ')[0]}
            </span>
          ))}
        </div>
      )}

      {members.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
          No one has joined yet — be the first!
        </div>
      )}
    </div>
  )
}
