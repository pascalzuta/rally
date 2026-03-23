import { useState, useEffect } from 'react'
import { LobbyMember, InviteLinkStatus } from '../types'
import { getLobbyMembers, subscribeLobbyUpdates } from '../inviteStore'

interface Props {
  shortcode: string
  inviteLinkId: string
  maxPlayers?: number
  linkStatus?: InviteLinkStatus
  tournamentId?: string | null
  onViewTournament?: (id: string) => void
  /** If true, renders a compact inline version */
  compact?: boolean
}

export default function LobbyStatus({
  shortcode,
  inviteLinkId,
  maxPlayers = 16,
  linkStatus,
  tournamentId,
  onViewTournament,
  compact = false,
}: Props) {
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
  const isTournamentCreated = linkStatus === 'tournament_created'
  const isExpired = linkStatus === 'expired'

  if (loading) {
    return <div className="lobby-status-loading" style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>Loading...</div>
  }

  // Tournament created banner
  if (isTournamentCreated) {
    return (
      <div className="lobby-status lobby-status--tournament-created">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: 22,
            fontWeight: 800,
            color: 'var(--color-positive-primary)',
          }}>
            {count}/{maxPlayers}
          </span>
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            padding: '3px 8px',
            borderRadius: 4,
            background: 'rgba(34,197,94,0.15)',
            color: 'var(--color-positive-primary)',
          }}>
            Tournament Created!
          </span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 12 }}>
          The lobby hit {count} players. Your tournament has been created and is ready to play.
        </div>
        {tournamentId && onViewTournament && (
          <button
            className="btn-primary"
            style={{ width: '100%' }}
            onClick={() => onViewTournament(tournamentId)}
          >
            View Tournament
          </button>
        )}
      </div>
    )
  }

  if (compact) {
    return (
      <div className="lobby-status-compact">
        <span className="lobby-status-count" style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
          {count}/{maxPlayers}
        </span>
        <span style={{ color: 'var(--color-text-secondary)', fontSize: 13, marginLeft: 6 }}>
          {isExpired ? 'Lobby expired' : isFull ? 'Lobby full' : 'players joined'}
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
        {isExpired && (
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            padding: '2px 7px',
            borderRadius: 4,
            background: 'rgba(156,163,175,0.15)',
            color: 'var(--color-text-secondary)',
            marginLeft: 4,
          }}>Expired</span>
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
          background: isFull || isExpired ? 'var(--color-text-secondary)' : 'var(--color-positive-primary)',
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
