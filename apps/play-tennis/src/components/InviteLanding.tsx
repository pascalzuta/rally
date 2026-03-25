import { useState, useEffect } from 'react'
import { resolveShortcode, joinLobbyViaLink, getLobbyMembers, refreshLobbyMembersFromRemote } from '../invite'
import { InviteLink, LobbyMember, PlayerProfile } from '../types'

interface Props {
  shortcode: string
  profile: PlayerProfile | null
  onJoined?: () => void
}

export default function InviteLanding({ shortcode, profile, onJoined }: Props) {
  const [link, setLink] = useState<InviteLink | null>(null)
  const [members, setMembers] = useState<LobbyMember[]>([])
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [joined, setJoined] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const resolved = await resolveShortcode(shortcode)
      setLink(resolved)
      if (resolved) {
        const m = await refreshLobbyMembersFromRemote(resolved.id)
        setMembers(m)
      }
      setLoading(false)
    }
    load()
  }, [shortcode])

  async function handleJoin() {
    if (!link) return
    const name = profile?.name || displayName.trim()
    if (!name) { setError('Enter your name to join'); return }
    setJoining(true)
    const member = await joinLobbyViaLink(shortcode, name, profile?.id)
    if (member) {
      setJoined(true)
      const m = await refreshLobbyMembersFromRemote(link.id)
      setMembers(m)
      onJoined?.()
    } else {
      setError('Could not join — lobby may be full')
    }
    setJoining(false)
  }

  if (loading) {
    return (
      <div className="invite-landing">
        <div className="invite-landing-loading">Loading invite...</div>
      </div>
    )
  }

  if (!link) {
    return (
      <div className="invite-landing">
        <div className="card invite-landing-card">
          <div className="card-title">Invite not found</div>
          <div className="card-supporting">This invite link may have expired or been removed.</div>
        </div>
      </div>
    )
  }

  const isFull = link.status === 'full' || members.length >= (link.maxPlayers ?? 16)
  const isExpired = link.status === 'expired' || new Date() > new Date(link.expiresAt)

  return (
    <div className="invite-landing">
      <div className="card invite-landing-card">
        <div className="invite-landing-emoji">🎾</div>
        <div className="card-title">{link.lobbyName || `${link.creatorName}'s Tournament`}</div>
        <div className="card-supporting">
          Created by {link.creatorName} · {link.county}
        </div>

        <div className="invite-landing-members">
          <div className="invite-landing-count">
            <span className="invite-landing-count-number">{members.length}</span>
            <span className="invite-landing-count-label">/ {link.maxPlayers ?? 16} players</span>
          </div>
          <div className="invite-landing-progress">
            <div
              className="invite-landing-progress-bar"
              style={{ width: `${Math.min(100, (members.length / (link.maxPlayers ?? 16)) * 100)}%` }}
            />
          </div>
          {members.length > 0 && (
            <div className="invite-landing-names">
              {members.slice(0, 8).map(m => (
                <span key={m.id} className="invite-landing-name-chip">{m.displayName}</span>
              ))}
              {members.length > 8 && (
                <span className="invite-landing-name-chip">+{members.length - 8} more</span>
              )}
            </div>
          )}
        </div>

        {joined ? (
          <div className="invite-landing-joined">
            <div className="invite-landing-joined-check">✓</div>
            <div className="card-title">You're in!</div>
            <div className="card-supporting">
              {members.length >= 6
                ? 'Enough players to start — tournament will be created soon.'
                : `${6 - members.length} more player${6 - members.length !== 1 ? 's' : ''} needed to start.`}
            </div>
          </div>
        ) : isFull ? (
          <div className="invite-landing-status">This lobby is full.</div>
        ) : isExpired ? (
          <div className="invite-landing-status">This invite has expired.</div>
        ) : (
          <div className="invite-landing-action">
            {!profile && (
              <input
                className="input"
                type="text"
                placeholder="Your name"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleJoin()}
              />
            )}
            {error && <div className="invite-landing-error">{error}</div>}
            <button
              className="btn btn-large invite-landing-join-btn"
              onClick={handleJoin}
              disabled={joining}
            >
              {joining ? 'Joining...' : profile ? `Join as ${profile.name}` : 'Join Lobby'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
