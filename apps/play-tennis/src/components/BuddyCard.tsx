import { useState } from 'react'
import { Buddy } from '../types'

interface Props {
  buddy: Buddy
  currentPlayerId: string
  /** Rally rating for the buddy (pass 0 if unknown) */
  rating?: number
  /** ISO date of the last match played with this buddy */
  lastPlayedAt?: string
  onPing: (buddy: Buddy) => void
  onRemove: (buddyId: string) => void
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function getBuddyName(buddy: Buddy, currentPlayerId: string): string {
  return buddy.requesterId === currentPlayerId ? buddy.recipientName : buddy.requesterName
}

function getBuddyId(buddy: Buddy, currentPlayerId: string): string {
  return buddy.requesterId === currentPlayerId ? buddy.recipientId : buddy.requesterId
}

export default function BuddyCard({ buddy, currentPlayerId, rating, lastPlayedAt, onPing, onRemove }: Props) {
  const [expanded, setExpanded] = useState(false)
  const name = getBuddyName(buddy, currentPlayerId)
  const initials = getInitials(name)
  const buddyId = getBuddyId(buddy, currentPlayerId)

  const lastPlayedLabel = lastPlayedAt
    ? new Date(lastPlayedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null

  return (
    <div
      className="buddy-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        cursor: 'pointer',
        minWidth: 64,
      }}
      onClick={() => setExpanded(e => !e)}
    >
      {/* Avatar */}
      <div style={{
        width: 48,
        height: 48,
        borderRadius: '50%',
        background: 'var(--color-accent-muted, rgba(59,130,246,0.18))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: 15,
        color: 'var(--color-accent, #3b82f6)',
        border: expanded ? '2px solid var(--color-accent, #3b82f6)' : '2px solid transparent',
        transition: 'border-color 0.15s',
        flexShrink: 0,
      }}>
        {initials}
      </div>

      {/* Name */}
      <span style={{
        fontSize: 11,
        fontWeight: 500,
        color: 'var(--color-text-primary)',
        maxWidth: 60,
        textAlign: 'center',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {name.split(' ')[0]}
      </span>

      {/* Expanded panel */}
      {expanded && (
        <div
          style={{
            position: 'absolute',
            top: 70,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-divider)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-sm)',
            padding: '12px 14px',
            minWidth: 180,
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{name}</div>
          {rating !== undefined && rating > 0 && (
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 2 }}>
              Rally Score <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--color-text-primary)' }}>{Math.round(rating)}</span>
            </div>
          )}
          {lastPlayedLabel && (
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 10 }}>
              Last played {lastPlayedLabel}
            </div>
          )}
          <button
            className="btn-primary"
            style={{ width: '100%', marginBottom: 8, fontSize: 13 }}
            onClick={() => { onPing(buddy); setExpanded(false) }}
          >
            Ping to Play
          </button>
          <button
            style={{
              width: '100%',
              background: 'none',
              border: 'none',
              color: 'var(--color-text-tertiary, #6b7280)',
              fontSize: 12,
              cursor: 'pointer',
              padding: '4px 0',
            }}
            onClick={() => { onRemove(buddy.id); setExpanded(false) }}
          >
            Remove buddy
          </button>
          <div style={{
            fontSize: 11,
            color: 'var(--color-text-secondary)',
            marginTop: 4,
            wordBreak: 'break-all',
          }}>
            ID: {buddyId.slice(0, 8)}
          </div>
        </div>
      )}
    </div>
  )
}
