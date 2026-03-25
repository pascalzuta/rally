import { useState } from 'react'
import { startTrial, getPlayerTier } from '../subscription'
import { PremiumFeature } from '../types'

interface Props {
  playerId: string
  feature: PremiumFeature
  children: React.ReactNode
}

const featureLabels: Record<PremiumFeature, string> = {
  algorithmic_matching: 'Smart Matching',
  priority_scheduling: 'Priority Scheduling',
  county_leaderboard_position: 'Leaderboard Position',
  advanced_stats: 'Advanced Stats',
  head_to_head_records: 'Head-to-Head Records',
  custom_tournament_formats: 'Custom Tournaments',
}

export default function PremiumGate({ playerId, feature, children }: Props) {
  const [starting, setStarting] = useState(false)
  const tier = getPlayerTier(playerId)

  if (tier === 'pro' || tier === 'trial') {
    return <>{children}</>
  }

  async function handleStartTrial() {
    setStarting(true)
    await startTrial(playerId)
    setStarting(false)
  }

  return (
    <div className="card premium-gate">
      <div className="card-status-row">
        <div className="card-status-label card-status-label--purple">Pro Feature</div>
      </div>
      <div className="card-summary-main">
        <div className="card-title">{featureLabels[feature] || 'Premium Feature'}</div>
        <div className="card-supporting">
          This feature is available with Rally Pro. Start a free trial to unlock it.
        </div>
      </div>
      <div className="premium-gate-trial">
        <button className="btn btn-large" onClick={handleStartTrial} disabled={starting}>
          {starting ? 'Starting...' : 'Start Free Trial'}
        </button>
        <div className="premium-gate-trial-info">5 matches free · 14 days · No card required</div>
      </div>
    </div>
  )
}
