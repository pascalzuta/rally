import { useState, useEffect } from 'react'
import { PlayerProfile } from '../types'
import { InviteLink } from '../types'
import { createInviteLink, getMyInviteLinks, getInviteUrl, subscribeLobbyUpdates, getLobbyMembers } from '../inviteStore'

interface Props {
  profile: PlayerProfile
}

type State = 'idle' | 'creating' | 'created'

export default function CreateInviteLink({ profile }: Props) {
  const [state, setState] = useState<State>('idle')
  const [lobbyName, setLobbyName] = useState('')
  const [link, setLink] = useState<InviteLink | null>(null)
  const [memberCount, setMemberCount] = useState(0)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // On mount, check if user already has an active invite link
  useEffect(() => {
    const existing = getMyInviteLinks(profile.id).filter(l => l.status === 'open')
    if (existing.length > 0) {
      const latest = existing[existing.length - 1]
      setLink(latest)
      setState('created')
      // Load member count
      getLobbyMembers(latest.shortcode).then(m => setMemberCount(m.length))
    }
  }, [profile.id])

  // Subscribe to real-time updates once link is created
  useEffect(() => {
    if (!link) return
    const unsub = subscribeLobbyUpdates(link.id, members => setMemberCount(members.length))
    return unsub
  }, [link?.id])

  async function handleCreate() {
    setState('creating')
    setError(null)
    try {
      const name = lobbyName.trim() || `${profile.county} Tournament`
      const newLink = await createInviteLink(profile.id, profile.county, name)
      setLink(newLink)
      setState('created')
    } catch (e) {
      setError('Failed to create link. Please try again.')
      setState('idle')
      console.error(e)
    }
  }

  function handleCopy() {
    if (!link) return
    const url = getInviteUrl(link.shortcode)
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleShare() {
    if (!link) return
    const url = getInviteUrl(link.shortcode)
    const text = `Join my tennis tournament in ${profile.county} on Rally. We'll auto-schedule your matches around your availability.\n${url}`
    if (navigator.share) {
      navigator.share({ title: 'Rally Tennis', text, url }).catch(() => {
        window.open(`sms:?body=${encodeURIComponent(text)}`, '_self')
      })
    } else {
      handleCopy()
    }
  }

  function handleWhatsApp() {
    if (!link) return
    const url = getInviteUrl(link.shortcode)
    const text = `Join my tennis tournament in ${profile.county} on Rally 🎾\n${url}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  function handleSMS() {
    if (!link) return
    const url = getInviteUrl(link.shortcode)
    const text = `Join my tennis tournament in ${profile.county} on Rally.\n${url}`
    window.open(`sms:?body=${encodeURIComponent(text)}`, '_self')
  }

  // --- Idle: prompt to start a tournament ---
  if (state === 'idle') {
    return (
      <div className="card invite-link-card">
        <div className="card-status-row">
          <div className="card-status-label card-status-label--green">Grow Your Tournament</div>
        </div>
        <div className="card-summary-main">
          <div className="card-title">Start a tournament with your group</div>
          <div className="card-supporting">
            Create a shareable link — friends join, matches auto-schedule.
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <input
            type="text"
            placeholder={`${profile.county} Tournament`}
            value={lobbyName}
            onChange={e => setLobbyName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            style={{
              width: '100%',
              background: 'var(--color-surface-raised, #1e1e1e)',
              border: '1px solid var(--color-divider)',
              borderRadius: 8,
              padding: '10px 12px',
              fontSize: 15,
              color: 'var(--color-text-primary)',
              marginBottom: 10,
              outline: 'none',
            }}
          />
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleCreate}>
            Create Invite Link
          </button>
          {error && <div style={{ color: '#ef4444', fontSize: 13, marginTop: 8 }}>{error}</div>}
        </div>
      </div>
    )
  }

  // --- Creating spinner ---
  if (state === 'creating') {
    return (
      <div className="card invite-link-card">
        <div className="card-status-row">
          <div className="card-status-label card-status-label--slate">Creating...</div>
        </div>
        <div className="card-summary-main">
          <div className="card-title">Setting up your lobby</div>
        </div>
      </div>
    )
  }

  // --- Created: show link + live status ---
  if (!link) return null
  const url = getInviteUrl(link.shortcode)
  const maxPlayers = link.maxPlayers

  return (
    <div className="card invite-link-card">
      <div className="card-status-row">
        <div className="card-status-label card-status-label--green">Your Tournament</div>
        <div className="card-meta-chip card-meta-chip--green" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {memberCount}/{maxPlayers} joined
        </div>
      </div>

      <div className="card-summary-main">
        <div className="card-title">{link.lobbyName}</div>
        <div className="card-supporting">
          Share this link to fill your lobby. Matches auto-schedule once you have 6+ players.
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        height: 4,
        background: 'var(--color-divider)',
        borderRadius: 2,
        overflow: 'hidden',
        margin: '12px 0 4px',
      }}>
        <div style={{
          height: '100%',
          width: `${Math.min(100, Math.round((memberCount / maxPlayers) * 100))}%`,
          background: 'var(--color-positive-primary)',
          borderRadius: 2,
          transition: 'width 0.4s ease',
        }} />
      </div>

      {/* Link display + copy */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginTop: 14,
        background: 'var(--color-surface-raised, #1e1e1e)',
        borderRadius: 8,
        padding: '8px 12px',
        marginBottom: 12,
      }}>
        <span style={{
          flex: 1,
          fontSize: 12,
          fontFamily: 'var(--font-mono, monospace)',
          color: 'var(--color-text-secondary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {url}
        </span>
        <button
          onClick={handleCopy}
          style={{
            background: 'none',
            border: 'none',
            color: copied ? 'var(--color-positive-primary)' : 'var(--color-text-secondary)',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 700,
            flexShrink: 0,
            padding: '2px 4px',
          }}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      {/* Share buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleShare}>
          Share Link
        </button>
        <button
          className="btn btn-secondary"
          style={{ flex: 1 }}
          onClick={handleWhatsApp}
        >
          WhatsApp
        </button>
        <button
          className="btn btn-secondary"
          style={{ flex: 1 }}
          onClick={handleSMS}
        >
          SMS
        </button>
      </div>
    </div>
  )
}
