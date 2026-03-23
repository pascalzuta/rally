import { useState } from 'react'
import { Buddy } from '../types'

interface Props {
  buddy: Buddy
  currentPlayerId: string
  onSend: (proposedDate: string, proposedTime: string, location?: string) => void
  onClose: () => void
}

const TIME_OPTIONS = [
  '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
  '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM',
  '6:00 PM', '7:00 PM', '8:00 PM',
]

function formatDateValue(date: Date): string {
  return date.toISOString().split('T')[0]
}

function getMinDate(): string {
  return formatDateValue(new Date())
}

export default function PingSheet({ buddy, currentPlayerId, onSend, onClose }: Props) {
  const recipientName = buddy.requesterId === currentPlayerId
    ? buddy.recipientName
    : buddy.requesterName

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)

  const [proposedDate, setProposedDate] = useState(formatDateValue(tomorrow))
  const [proposedTime, setProposedTime] = useState('10:00 AM')
  const [location, setLocation] = useState('')
  const [sending, setSending] = useState(false)

  async function handleSend() {
    if (!proposedDate || !proposedTime) return
    setSending(true)
    onSend(proposedDate, proposedTime, location.trim() || undefined)
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
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />

      <div
        style={{
          position: 'relative',
          background: 'var(--color-surface)',
          borderRadius: '16px 16px 0 0',
          padding: '20px 16px 36px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div style={{
          width: 40,
          height: 4,
          borderRadius: 2,
          background: 'var(--color-divider)',
          margin: '0 auto 4px',
        }} />

        <div style={{ fontWeight: 700, fontSize: 17 }}>Ping {recipientName.split(' ')[0]} to Play</div>

        {/* Date */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Date
          </label>
          <input
            type="date"
            value={proposedDate}
            min={getMinDate()}
            onChange={e => setProposedDate(e.target.value)}
            style={{
              display: 'block',
              width: '100%',
              marginTop: 6,
              padding: '10px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-divider)',
              background: 'var(--color-surface-raised, #1c1c1e)',
              color: 'var(--color-text-primary)',
              fontSize: 14,
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Time */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Time
          </label>
          <select
            value={proposedTime}
            onChange={e => setProposedTime(e.target.value)}
            style={{
              display: 'block',
              width: '100%',
              marginTop: 6,
              padding: '10px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-divider)',
              background: 'var(--color-surface-raised, #1c1c1e)',
              color: 'var(--color-text-primary)',
              fontSize: 14,
              boxSizing: 'border-box',
            }}
          >
            {TIME_OPTIONS.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Location */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Location <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
          </label>
          <input
            type="text"
            placeholder="e.g. Wimbledon Park courts"
            value={location}
            onChange={e => setLocation(e.target.value)}
            style={{
              display: 'block',
              width: '100%',
              marginTop: 6,
              padding: '10px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-divider)',
              background: 'var(--color-surface-raised, #1c1c1e)',
              color: 'var(--color-text-primary)',
              fontSize: 14,
              boxSizing: 'border-box',
            }}
          />
        </div>

        <button
          className="btn-primary"
          disabled={!proposedDate || !proposedTime || sending}
          onClick={handleSend}
          style={{ width: '100%', marginTop: 4, opacity: sending ? 0.7 : 1 }}
        >
          {sending ? 'Sending…' : `Ping ${recipientName.split(' ')[0]}`}
        </button>
      </div>
    </div>
  )
}
