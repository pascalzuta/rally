import { useEffect } from 'react'
import { getNotifications, markNotificationsRead, getMatchOffer } from '../store'
import type { PlayerProfile, Tournament, RallyNotification } from '../types'

interface Props {
  profile: PlayerProfile
  tournaments: Tournament[]
  onClose: () => void
  onNavigate: (route: string, focusMatchId?: string) => void
}

/** Classify a rally notification as either "rally" (trophy/rating) or "match" (offers/scheduling/scoring) */
function classifyNotification(n: RallyNotification): 'rally' | 'match' {
  switch (n.type) {
    case 'match_offer':
    case 'offer_accepted':
    case 'offer_declined':
    case 'offer_expired':
    case 'match_reminder':
    case 'score_reported':
    case 'score_correction_proposed':
    case 'score_correction_resolved':
    case 'score_issue_reported':
    case 'feedback_requested':
    case 'reliability_nudge':
      return 'match'
    default:
      return 'rally'
  }
}

function getNotifIcon(n: RallyNotification): string {
  switch (n.type) {
    case 'match_offer': return '📩'
    case 'offer_accepted': return '✅'
    case 'offer_declined': return '✗'
    case 'offer_expired': return '⏱'
    case 'score_reported': return '📊'
    case 'score_correction_proposed': return '🔄'
    case 'score_correction_resolved': return '✔️'
    case 'score_issue_reported': return '⚠️'
    case 'match_reminder': return '⏰'
    case 'feedback_requested': return '💬'
    case 'reliability_nudge': return '📋'
    default: return '🎾'
  }
}

function getNotifTint(n: RallyNotification): string {
  if (!n.read) {
    switch (n.type) {
      case 'match_offer':
      case 'offer_accepted':
        return 'notif-unread-blue'
      case 'offer_declined':
      case 'offer_expired':
      case 'score_issue_reported':
        return 'notif-unread-red'
      default:
        return 'notif-unread-gold'
    }
  }
  return ''
}

function getMatchActionIcon(status: string): string {
  switch (status) {
    case 'escalated': return '⚠️'
    case 'confirmed': return '🎾'
    case 'proposed': return '📩'
    default: return '📅'
  }
}

function getMatchActionUrgency(status: string): string {
  switch (status) {
    case 'escalated': return 'notif-urgent'
    case 'confirmed': return 'notif-ready'
    case 'proposed': return 'notif-pending'
    default: return ''
  }
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

export default function NotificationsPanel({ profile, tournaments, onClose, onNavigate }: Props) {
  // Mark all notifications as read when panel opens
  useEffect(() => {
    markNotificationsRead(profile.id)
  }, [profile.id])

  const rallyNotifs = getNotifications(profile.id).slice(0, 20)

  // Separate into Rally Notifications vs Match Actions
  const rallyGroup = rallyNotifs.filter(n => classifyNotification(n) === 'rally')
  const matchNotifGroup = rallyNotifs.filter(n => classifyNotification(n) === 'match')

  // Build match action items from active tournaments
  const matchActions = tournaments
    .filter(t => t.status === 'in-progress')
    .flatMap(t =>
      t.matches
        .filter(m =>
          !m.completed &&
          (m.player1Id === profile.id || m.player2Id === profile.id) &&
          m.player1Id && m.player2Id &&
          (
            !m.schedule ||
            m.schedule.status === 'unscheduled' ||
            m.schedule.status === 'escalated' ||
            (m.schedule.activeRescheduleRequest && m.schedule.activeRescheduleRequest.requestedBy !== profile.id) ||
            (m.schedule.status === 'confirmed' && m.schedule.confirmedSlot) ||
            (m.schedule.status === 'proposed' && m.schedule.proposals.some(
              p => p.status === 'pending' && p.proposedBy !== profile.id
            ))
          )
        )
        .map(m => {
          const opponentId = m.player1Id === profile.id ? m.player2Id : m.player1Id
          const opponentName = t.players.find(p => p.id === opponentId)?.name ?? 'Opponent'
          let action = ''
          let status = ''

          if (m.schedule?.status === 'escalated') {
            action = 'Escalated \u2014 respond now'
            status = 'escalated'
          } else if (m.schedule?.status === 'confirmed') {
            action = 'Ready to score'
            status = 'confirmed'
          } else if (
            m.schedule?.status === 'proposed' &&
            m.schedule.proposals.some(p => p.status === 'pending' && p.proposedBy !== profile.id)
          ) {
            action = `${opponentName} proposed a time \u2014 tap to confirm`
            status = 'proposed'
          } else {
            action = 'Needs scheduling'
            status = 'unscheduled'
          }

          return {
            key: `${t.id}-${m.id}`,
            matchId: m.id,
            opponentName,
            tournamentName: t.name,
            action,
            status,
          }
        })
    )

  // Combine match-related notifications and match actions
  const allMatchItems = [...matchNotifGroup, ...matchActions]
  const hasRallyItems = rallyGroup.length > 0
  const hasMatchItems = allMatchItems.length > 0
  const isEmpty = !hasRallyItems && !hasMatchItems

  function handleNotifClick(n: RallyNotification) {
    if (n.type === 'match_offer') {
      onNavigate('playnow')
    } else if (n.type === 'offer_accepted') {
      if (n.relatedOfferId) {
        const offer = getMatchOffer(n.relatedOfferId)
        if (offer?.matchId) {
          onNavigate('bracket', offer.matchId)
          return
        }
      }
      onNavigate('bracket')
    } else if (n.relatedMatchId) {
      onNavigate('bracket', n.relatedMatchId)
    } else {
      onClose()
    }
  }

  function handleMatchActionClick(matchId: string) {
    onNavigate('bracket', matchId)
  }

  return (
    <div className="rating-panel-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="rating-panel">
        <div className="rating-panel-header">
          <h2 className="rating-panel-title">Notifications</h2>
          <button className="rating-panel-close" onClick={onClose} aria-label="Close">{'\u2715'}</button>
        </div>

        <div className="rating-panel-body">
          {isEmpty ? (
            <div className="notif-empty">
              All caught up!
            </div>
          ) : (
            <div className="notif-list">
              {/* Rally Notifications section */}
              {hasRallyItems && (
                <>
                  <div className="section-label">Rally Notifications</div>
                  {rallyGroup.map(n => (
                    <button
                      key={n.id}
                      className={`notif-item ${getNotifTint(n)}`}
                      onClick={() => handleNotifClick(n)}
                    >
                      <span className="notif-icon">{getNotifIcon(n)}</span>
                      <div className="notif-body">
                        <div className="notif-action">{n.message}</div>
                        {n.detail && <div className="notif-detail">{n.detail}</div>}
                        <div className="notif-time">{timeAgo(n.createdAt)}</div>
                      </div>
                    </button>
                  ))}
                </>
              )}

              {/* Match Actions section */}
              {hasMatchItems && (
                <>
                  <div className="section-label">Match Actions</div>
                  {/* Match-related notifications */}
                  {matchNotifGroup.map(n => (
                    <button
                      key={n.id}
                      className={`notif-item ${getNotifTint(n)}`}
                      onClick={() => handleNotifClick(n)}
                    >
                      <span className="notif-icon">{getNotifIcon(n)}</span>
                      <div className="notif-body">
                        <div className="notif-action">{n.message}</div>
                        {n.detail && <div className="notif-detail">{n.detail}</div>}
                        <div className="notif-time">{timeAgo(n.createdAt)}</div>
                      </div>
                    </button>
                  ))}
                  {/* Active match actions from tournaments */}
                  {matchActions.map(item => (
                    <button
                      key={item.key}
                      className={`notif-item ${getMatchActionUrgency(item.status)}`}
                      onClick={() => handleMatchActionClick(item.matchId)}
                    >
                      <span className="notif-icon">{getMatchActionIcon(item.status)}</span>
                      <div className="notif-body">
                        <div className="notif-action">{item.action}</div>
                        <div className="notif-detail">vs {item.opponentName}</div>
                        <div className="notif-time">{item.tournamentName}</div>
                      </div>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
