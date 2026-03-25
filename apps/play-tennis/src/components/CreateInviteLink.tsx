import { useState } from 'react'
import { createInviteLink, getMyInviteLinks, getInviteLinkUrl, shareInviteLink, getLobbyMembers } from '../invite'
import { PlayerProfile, InviteLink } from '../types'

interface Props {
  profile: PlayerProfile
}

export default function CreateInviteLink({ profile }: Props) {
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const myLinks = getMyInviteLinks(profile.id).filter(l => l.status === 'active')

  async function handleCreate() {
    setCreating(true)
    const link = await createInviteLink(profile.id, profile.name, profile.county)
    shareInviteLink(link)
    setCopied(link.shortcode)
    setTimeout(() => setCopied(null), 2000)
    setCreating(false)
  }

  function handleShare(link: InviteLink) {
    shareInviteLink(link)
    setCopied(link.shortcode)
    setTimeout(() => setCopied(null), 2000)
  }

  function handleCopyUrl(link: InviteLink) {
    const url = getInviteLinkUrl(link.shortcode)
    navigator.clipboard.writeText(url)
    setCopied(link.shortcode)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="card create-invite-card">
      <div className="card-status-row">
        <div className="card-status-label card-status-label--purple">Invite Friends</div>
      </div>
      <div className="card-summary-main">
        <div className="card-title">Grow your tennis community</div>
        <div className="card-supporting">
          Share an invite link to fill your next tournament faster.
        </div>
      </div>

      {myLinks.length > 0 && (
        <div className="create-invite-existing">
          {myLinks.map(link => {
            const memberCount = getLobbyMembers(link.id).length
            return (
              <div key={link.id} className="create-invite-link-row">
                <div className="create-invite-link-info">
                  <div className="create-invite-link-name">{link.lobbyName}</div>
                  <div className="create-invite-link-meta">{memberCount} joined · {link.county}</div>
                </div>
                <button
                  className="btn btn-small"
                  onClick={() => handleShare(link)}
                >
                  {copied === link.shortcode ? 'Copied!' : 'Share'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      <button
        className="btn btn-large create-invite-btn"
        onClick={handleCreate}
        disabled={creating}
      >
        {creating ? 'Creating...' : '+ Create Invite Link'}
      </button>
    </div>
  )
}
