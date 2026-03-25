import { useState, useEffect } from 'react'
import { resolveReferralSlug, trackReferralClick, setReferralSource } from '../referrals'
import { Referral } from '../types'

interface Props {
  slug: string
  onContinue: () => void
}

export default function ReferralLanding({ slug, onContinue }: Props) {
  const [referral, setReferral] = useState<Referral | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const r = await resolveReferralSlug(slug)
      setReferral(r)
      if (r) {
        setReferralSource(slug)
        await trackReferralClick(slug)
      }
      setLoading(false)
    }
    load()
  }, [slug])

  if (loading) {
    return (
      <div className="referral-landing">
        <div className="referral-landing-loading">Loading...</div>
      </div>
    )
  }

  if (!referral) {
    return (
      <div className="referral-landing">
        <div className="card referral-landing-card">
          <div className="card-title">Link not found</div>
          <div className="card-supporting">This referral link may have expired.</div>
          <button className="btn btn-large" onClick={onContinue}>Go to Rally</button>
        </div>
      </div>
    )
  }

  return (
    <div className="referral-landing">
      <div className="card referral-landing-card">
        <div className="referral-landing-emoji">🎾</div>
        <div className="card-title">
          {referral.type === 'influencer'
            ? `${referral.creatorName} invited you to Rally`
            : `${referral.creatorName} thinks you'd love Rally`}
        </div>
        <div className="card-supporting">
          Join your local tennis community. Find players, enter tournaments, and track your rating.
        </div>
        <button className="btn btn-large referral-landing-cta" onClick={onContinue}>
          Get Started — It's Free
        </button>
        <div className="referral-landing-stats">
          {referral.signupCount > 0 && (
            <span className="referral-landing-stat">{referral.signupCount} player{referral.signupCount !== 1 ? 's' : ''} joined</span>
          )}
        </div>
      </div>
    </div>
  )
}
