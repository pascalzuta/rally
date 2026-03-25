import { useState } from 'react'
import { createInviteLink, getInviteLinkUrl, shareInviteLink } from '../invite'
import { createViralReferral } from '../referrals'
import { getReferralSource, clearReferralSource } from '../referrals'
import { PlayerProfile } from '../types'

interface Props {
  profile: PlayerProfile
  onDismiss: () => void
}

export default function PostSignupShare({ profile, onDismiss }: Props) {
  const [shared, setShared] = useState(false)
  const [creating, setCreating] = useState(false)

  async function handleShare() {
    setCreating(true)
    const parentSlug = getReferralSource() ?? undefined
    // Create a viral referral for this new user
    await createViralReferral(profile.id, profile.name, parentSlug)
    clearReferralSource()
    // Create an invite link they can share
    const link = await createInviteLink(profile.id, profile.name, profile.county)
    shareInviteLink(link)
    setShared(true)
    setCreating(false)
  }

  return (
    <div className="card post-signup-share">
      <div className="post-signup-share-emoji">🎾</div>
      <div className="card-title">Welcome to Rally!</div>
      <div className="card-supporting">
        Know someone who'd enjoy competitive tennis? Share your personal invite link.
      </div>
      {shared ? (
        <div className="post-signup-share-done">
          <div className="post-signup-share-check">✓ Link copied!</div>
          <button className="btn btn-large" onClick={onDismiss}>Continue to Home</button>
        </div>
      ) : (
        <div className="post-signup-share-actions">
          <button className="btn btn-large" onClick={handleShare} disabled={creating}>
            {creating ? 'Creating...' : 'Share Invite Link'}
          </button>
          <button className="btn-link" onClick={onDismiss}>Skip for now</button>
        </div>
      )}
    </div>
  )
}
