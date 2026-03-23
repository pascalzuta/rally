import { useState } from 'react'
import { isTrialActive, getTrialMatchesRemaining } from '../subscriptionStore'

interface Props {
  onUpgrade?: () => void
}

export default function TrialBanner({ onUpgrade }: Props) {
  const [dismissed, setDismissed] = useState(false)

  if (!isTrialActive() || dismissed) return null

  const remaining = getTrialMatchesRemaining()

  return (
    <div style={{
      background: '#8b5cf615',
      borderBottom: '1px solid #8b5cf630',
      padding: '8px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      fontSize: 13,
    }}>
      <span style={{ color: '#8b5cf6', fontWeight: 700, flexShrink: 0 }}>Trial</span>
      <span style={{ color: 'var(--color-text-secondary)', flex: 1 }}>
        <span style={{ fontFamily: 'var(--font-mono, monospace)', fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-primary)' }}>
          {remaining}
        </span>
        {' '}of 5 trial matches remaining
      </span>
      {onUpgrade && (
        <button
          onClick={onUpgrade}
          style={{
            background: 'none',
            border: 'none',
            color: '#8b5cf6',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            padding: '2px 4px',
            flexShrink: 0,
          }}
        >
          Upgrade
        </button>
      )}
      <button
        onClick={() => setDismissed(true)}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--color-text-secondary)',
          fontSize: 14,
          cursor: 'pointer',
          padding: '2px 4px',
          lineHeight: 1,
          flexShrink: 0,
        }}
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  )
}
