import { useState } from 'react'
import { titleCase } from '../dateUtils'
import {
  cancelFriendTournament, startFriendTournament,
} from '../store'
import { PlayerProfile, Tournament } from '../types'

interface Props {
  profile: PlayerProfile
  tournaments: Tournament[]
  onDataChanged?: () => void
  onViewTournament?: (id: string) => void
}

function getInviteLink(inviteCode: string): string {
  const url = new URL(window.location.href)
  url.search = ''
  url.hash = ''
  url.searchParams.set('tournament', inviteCode)
  return url.toString()
}

function FriendTournamentCard({
  tournament,
  currentPlayerId,
  onShare,
  onCancel,
  onStart,
  onView,
}: {
  tournament: Tournament
  currentPlayerId: string
  onShare: () => void
  onCancel: () => void
  onStart: () => void
  onView: (id: string) => void
}) {
  const isCreator = tournament.createdBy === currentPlayerId
  const max = tournament.maxPlayers ?? 8
  const count = tournament.players.length
  const isReady = count >= 6
  const isFull = count >= max
  const isActive = tournament.status === 'in-progress'
  const isCompleted = tournament.status === 'completed'

  function getStatusBadge(): { label: string; colorClass: string } {
    if (isCompleted) return { label: 'Completed', colorClass: 'card-status-label--slate' }
    if (isActive) return { label: 'In Progress', colorClass: 'card-status-label--slate' }
    if (isReady) return { label: 'Ready', colorClass: 'card-status-label--green' }
    return { label: 'Waiting', colorClass: 'card-status-label--blue' }
  }

  const badge = getStatusBadge()
  const playersNeeded = Math.max(0, 6 - count)

  return (
    <div className="card friend-tournament-card">
      <div className="card-status-row">
        <div className={`card-status-label ${badge.colorClass}`}>{badge.label}</div>
        <div className="card-meta-chip card-meta-chip--green">Free</div>
      </div>
      <div className="card-summary-main">
        <div className="card-title">{titleCase(tournament.name)}</div>
        <div className="card-supporting">
          {isCompleted && 'Tournament complete.'}
          {isActive && `${count} players · Round robin`}
          {!isActive && !isCompleted && (
            isReady
              ? `Ready to start! ${max - count} spot${max - count !== 1 ? 's' : ''} remaining.`
              : `${playersNeeded} more player${playersNeeded !== 1 ? 's' : ''} needed to start.`
          )}
        </div>
      </div>

      {!isActive && !isCompleted && (
        <>
          <div className="formation-player-count">
            <span className="formation-count-mono">{count}</span>
            <span className="formation-count-sep">/</span>
            <span className="formation-count-mono">{max}</span>
            <span className="formation-count-label">players joined</span>
          </div>
          <div className="formation-progress-bar">
            <div
              className="formation-progress-fill"
              style={{
                width: `${(count / max) * 100}%`,
                background: isReady ? 'var(--color-positive-primary)' : 'var(--color-accent-primary)',
              }}
            />
          </div>
        </>
      )}

      <div className="formation-actions">
        {!isActive && !isCompleted && (
          <>
            {isCreator && isReady && !isFull && (
              <button className="btn btn-primary btn-large formation-cta-primary" onClick={onStart}>
                Start Tournament
              </button>
            )}
            {isCreator && isReady && isFull && (
              <button className="btn btn-primary btn-large formation-cta-primary" onClick={onStart}>
                Start Tournament
              </button>
            )}
            <button
              className={`btn btn-large ${!isReady || !isCreator ? 'btn-primary formation-cta-primary' : 'formation-cta-secondary'}`}
              onClick={onShare}
            >
              Share Invite Link
            </button>
            {isCreator && (
              <button className="btn-link friend-tournament-cancel" onClick={onCancel}>
                Cancel Tournament
              </button>
            )}
          </>
        )}
        {(isActive || isCompleted) && (
          <button className="btn btn-primary btn-large formation-cta-primary" onClick={() => onView(tournament.id)}>
            View Bracket
          </button>
        )}
      </div>
    </div>
  )
}

export default function FriendTournamentSection({
  profile,
  tournaments,
  onDataChanged,
  onViewTournament,
}: Props) {
  const [showShareSheet, setShowShareSheet] = useState(false)
  const [shareInviteCode, setShareInviteCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  async function handleCancel(tournamentId: string) {
    if (!confirm('Cancel this tournament? All invited players will be removed.')) return
    await cancelFriendTournament(tournamentId, profile.id)
    // Data provider auto-refreshes via Supabase Realtime
    onDataChanged?.()
  }

  async function handleStart(tournamentId: string) {
    await startFriendTournament(tournamentId, profile.id)
    // Data provider auto-refreshes via Supabase Realtime
    onDataChanged?.()
  }

  function handleShare(inviteCode: string) {
    const link = getInviteLink(inviteCode)
    const message = `Join my free Rally tennis tournament!\n${link}`
    if (navigator.share) {
      navigator.share({ title: 'Rally Tennis', text: message, url: link }).catch(() => {
        setShareInviteCode(inviteCode)
        setShowShareSheet(true)
      })
    } else {
      setShareInviteCode(inviteCode)
      setShowShareSheet(true)
    }
  }

  function handleCopyLink() {
    if (!shareInviteCode) return
    const link = getInviteLink(shareInviteCode)
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleSMS() {
    if (!shareInviteCode) return
    const link = getInviteLink(shareInviteCode)
    const message = `Join my free Rally tennis tournament!\n${link}`
    window.open(`sms:?body=${encodeURIComponent(message)}`, '_self')
    setShowShareSheet(false)
  }

  function handleWhatsApp() {
    if (!shareInviteCode) return
    const link = getInviteLink(shareInviteCode)
    const message = `Join my free Rally tennis tournament!\n${link}`
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank')
    setShowShareSheet(false)
  }

  // Only show setup/in-progress/completed friend tournaments
  const friendTournaments = tournaments.filter(t => t.type === 'friend')

  if (friendTournaments.length === 0 && !showShareSheet) return null

  return (
    <div className="friend-tournament-section">
      {friendTournaments.length > 0 && (
        <div className="friend-tournament-header">Your Tournaments</div>
      )}

      {friendTournaments.map(t => (
        <FriendTournamentCard
          key={t.id}
          tournament={t}
          currentPlayerId={profile.id}
          onShare={() => handleShare(t.inviteCode!)}
          onCancel={() => handleCancel(t.id)}
          onStart={() => handleStart(t.id)}
          onView={(id) => onViewTournament?.(id)}
        />
      ))}

      {showShareSheet && (
        <div className="modal-overlay" onClick={() => setShowShareSheet(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Share Invite Link</h2>
            <p className="share-subtitle">Anyone with this link can join your tournament for free.</p>
            <div className="share-options">
              <button className="btn btn-large" onClick={handleSMS}>Text Message</button>
              <button className="btn btn-large" onClick={handleWhatsApp}>WhatsApp</button>
              <button className="btn btn-large" onClick={() => { handleCopyLink(); setShowShareSheet(false) }}>
                {copied ? 'Copied!' : 'Copy Invite Link'}
              </button>
            </div>
            <div className="share-close">
              <button className="btn-link" onClick={() => setShowShareSheet(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
