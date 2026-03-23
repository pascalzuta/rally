import { BuddyPing } from '../types'

interface Props {
  ping: BuddyPing
  currentPlayerId: string
  onAccept?: (pingId: string) => void
  onDecline?: (pingId: string) => void
}

export default function BuddyPingCard({ ping, currentPlayerId, onAccept, onDecline }: Props) {
  const isIncoming = ping.recipientId === currentPlayerId
  const otherName = isIncoming ? ping.senderName : ping.recipientName

  const dateLabel = (() => {
    try {
      return new Date(ping.proposedDate).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    } catch {
      return ping.proposedDate
    }
  })()

  const statusLabel = ping.response === 'accepted'
    ? 'Accepted'
    : ping.response === 'declined'
      ? 'Declined'
      : isIncoming
        ? 'Incoming Ping'
        : 'Waiting'

  const tone = ping.response === 'accepted'
    ? 'green'
    : ping.response === 'declined'
      ? 'slate'
      : isIncoming
        ? 'blue'
        : 'amber'

  return (
    <div className="card action-card" style={{ cursor: 'default' }}>
      {/* Eyebrow row */}
      <div className="action-card-status-row">
        <div className={`card-status-label card-status-label--${tone}`}>{statusLabel}</div>
        <div className="card-meta-chip">{dateLabel} · {ping.proposedTime}</div>
      </div>

      {/* Opponent row */}
      <div className="action-card-main">
        <div className="action-card-opponent">
          {isIncoming ? 'From' : 'To'} {otherName}
        </div>
        <div className="action-card-supporting">
          {ping.location ? `📍 ${ping.location}` : 'Location TBD'}
        </div>
      </div>

      {/* Action row */}
      {isIncoming && !ping.response && (
        <div className="action-card-buttons">
          <button
            className="btn-primary"
            style={{ fontSize: 13 }}
            onClick={() => onAccept?.(ping.id)}
          >
            Accept
          </button>
          <button
            style={{
              background: 'none',
              border: '1px solid var(--color-divider)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--color-text-secondary)',
              fontSize: 13,
              padding: '6px 14px',
              cursor: 'pointer',
            }}
            onClick={() => onDecline?.(ping.id)}
          >
            Decline
          </button>
        </div>
      )}

      {!isIncoming && !ping.response && (
        <div className="action-card-buttons">
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', padding: '4px 0' }}>
            Waiting for {ping.recipientName.split(' ')[0]} to respond…
          </span>
        </div>
      )}
    </div>
  )
}
