import { useState, useEffect } from 'react'
import { PlayerProfile } from '../types'
import { InviteLink } from '../types'
import { createInviteLink, getInviteUrl } from '../inviteStore'

interface Props {
  profile: PlayerProfile
  onDismiss: () => void
}

export default function PostSignupShare({ profile, onDismiss }: Props) {
  const [link, setLink] = useState<InviteLink | null>(null)
  const [copied, setCopied] = useState(false)
  const [generating, setGenerating] = useState(true)

  // Auto-generate an invite link on mount
  useEffect(() => {
    createInviteLink(profile.id, profile.county, `${profile.county} Tournament`)
      .then(l => {
        setLink(l)
        setGenerating(false)
      })
      .catch(() => {
        setGenerating(false)
      })
  }, [profile.id, profile.county])

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
    const text = `I just joined Rally Tennis in ${profile.county}. Join me — matches auto-schedule around your availability.\n${url}`
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
    const text = `I just joined Rally Tennis in ${profile.county} 🎾 Join me!\n${url}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  function handleSMS() {
    if (!link) return
    const url = getInviteUrl(link.shortcode)
    const text = `Join me on Rally Tennis in ${profile.county}.\n${url}`
    window.open(`sms:?body=${encodeURIComponent(text)}`, '_self')
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '0 0 env(safe-area-inset-bottom, 0)',
    }} onClick={e => { if (e.target === e.currentTarget) onDismiss() }}>
      <div style={{
        background: 'var(--color-surface)',
        borderRadius: '20px 20px 0 0',
        padding: '24px 20px 32px',
        width: '100%',
        maxWidth: 480,
        position: 'relative',
      }}>
        {/* Dismiss handle */}
        <div style={{
          width: 36,
          height: 4,
          background: 'var(--color-divider)',
          borderRadius: 2,
          margin: '0 auto 20px',
        }} />

        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          style={{
            position: 'absolute',
            top: 20,
            right: 20,
            background: 'none',
            border: 'none',
            color: 'var(--color-text-secondary)',
            fontSize: 18,
            cursor: 'pointer',
            padding: 4,
          }}
        >
          ✕
        </button>

        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🎾</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>
            You're in, {profile.name.split(' ')[0]}!
          </div>
          <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
            Tournaments fill faster with friends. Send this link to your tennis crew.
          </div>
        </div>

        {generating && (
          <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 13, padding: '12px 0' }}>
            Generating your link...
          </div>
        )}

        {!generating && link && (
          <>
            {/* Link display */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--color-surface-raised, #1e1e1e)',
              borderRadius: 10,
              padding: '10px 14px',
              marginBottom: 14,
            }}>
              <span style={{
                flex: 1,
                fontSize: 13,
                fontFamily: 'var(--font-mono, monospace)',
                color: 'var(--color-text-secondary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {getInviteUrl(link.shortcode)}
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
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleShare}>
                Share Link
              </button>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={handleWhatsApp}>
                WhatsApp
              </button>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={handleSMS}>
                SMS
              </button>
            </div>
          </>
        )}

        {!generating && !link && (
          <div style={{ color: 'var(--color-text-secondary)', fontSize: 13, textAlign: 'center', padding: '8px 0 12px' }}>
            Could not generate link right now.
          </div>
        )}

        <button
          onClick={onDismiss}
          style={{
            width: '100%',
            background: 'none',
            border: 'none',
            color: 'var(--color-text-secondary)',
            fontSize: 14,
            cursor: 'pointer',
            padding: '8px 0',
          }}
        >
          Skip for now
        </button>
      </div>
    </div>
  )
}
