import { getSubscription, getPlayerTier } from '../subscription'

interface Props {
  playerId: string
}

export default function TrialBanner({ playerId }: Props) {
  const tier = getPlayerTier(playerId)
  const sub = getSubscription(playerId)

  if (tier !== 'trial' || !sub) return null

  const daysLeft = sub.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(sub.trialEndsAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : 0

  return (
    <div className="trial-banner">
      <div className="trial-banner-text">
        <span className="trial-banner-label">Free Trial</span>
        <span className="trial-banner-detail">
          {sub.trialMatchesRemaining} match{sub.trialMatchesRemaining !== 1 ? 'es' : ''} left · {daysLeft} day{daysLeft !== 1 ? 's' : ''} remaining
        </span>
      </div>
    </div>
  )
}
