import { useState } from 'react'
import { PremiumFeature } from '../types'
import { isPro, isTrialActive, startTrial } from '../subscriptionStore'

interface Props {
  feature: PremiumFeature
  title: string
  description: string
  preview?: string   // e.g. "12 players near your rating available this week"
  onTrialStarted?: () => void
}

const FEATURE_LABELS: Record<PremiumFeature, string> = {
  algorithmic_matching: 'Algorithmic Matching',
  priority_scheduling: 'Priority Scheduling',
  county_leaderboard: 'County Leaderboard',
  advanced_stats: 'Advanced Stats',
}

export default function PremiumGate({ feature, title, description, preview, onTrialStarted }: Props) {
  const [starting, setStarting] = useState(false)

  // Don't show gate if already pro or trial active
  if (isPro() || isTrialActive()) return null

  async function handleStartTrial() {
    setStarting(true)
    try {
      await startTrial()
      onTrialStarted?.()
    } catch {
      // ignore
    } finally {
      setStarting(false)
    }
  }

  return (
    <div style={{
      background: 'var(--color-surface)',
      borderRadius: 'var(--radius-md)',
      borderLeft: '3px solid #8b5cf6',
      padding: '14px 16px',
      boxShadow: 'var(--shadow-sm)',
    }}>
      {/* Badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{
          background: '#8b5cf620',
          color: '#8b5cf6',
          fontSize: 11,
          fontWeight: 700,
          padding: '2px 8px',
          borderRadius: 20,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}>
          Rally Pro — {FEATURE_LABELS[feature]}
        </span>
      </div>

      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5, marginBottom: 10 }}>
        {description}
      </div>

      {preview && (
        <div style={{
          background: 'var(--color-surface-raised, rgba(139,92,246,0.07))',
          borderRadius: 8,
          padding: '8px 12px',
          fontSize: 13,
          color: 'var(--color-text-secondary)',
          marginBottom: 12,
          fontFamily: 'var(--font-mono, monospace)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {preview}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          className="btn btn-primary"
          onClick={handleStartTrial}
          disabled={starting}
          style={{ flex: 1, background: '#8b5cf6', borderColor: '#8b5cf6' }}
        >
          {starting ? 'Starting...' : 'Start Free Trial'}
        </button>
        <a
          href="#help"
          style={{ fontSize: 13, color: '#8b5cf6', textDecoration: 'none', flexShrink: 0 }}
          onClick={e => { e.preventDefault(); window.location.hash = 'help' }}
        >
          Learn More
        </a>
      </div>
    </div>
  )
}
