import { useMemo, useState } from 'react'
import { getPlayerName, getPlayerSeed, getAvailability, getPlayerRating, getCountyLeaderboard, getTournamentsByCounty, getIncomingOffers, hasUnreadFrom, getConversationList } from '../store'
import { PlayerProfile, Tournament, Match } from '../types'
import Lobby from './Lobby'
import MatchSchedulePanel from './MatchSchedulePanel'
import MessagePanel from './MessagePanel'
import InlineScoreEntry from './InlineScoreEntry'

interface Props {
  profile: PlayerProfile
  tournaments: Tournament[]
  autoJoin?: boolean
  onAutoJoinConsumed?: () => void
  onTournamentCreated: (id: string) => void
  onViewTournament: (id: string) => void
  onViewMatch: (tournamentId: string, matchId: string) => void
  onViewLeaderboard?: () => void
  onViewOffers?: () => void
  onDataChanged?: () => void
  onViewHelp?: () => void
}

// --- Onboarding ---

interface ActivationStep {
  label: string
  completed: boolean
}

function getActivationSteps(
  profile: PlayerProfile,
  tournaments: Tournament[],
  hasAvailability: boolean,
  hasPlayedMatch: boolean
): ActivationStep[] {
  const inTournament = tournaments.some(t =>
    (t.status === 'setup' || t.status === 'in-progress') &&
    t.players.some(p => p.id === profile.id)
  )

  return [
    { label: 'Set up your profile', completed: true },
    { label: 'Join your local tournament', completed: inTournament || hasPlayedMatch },
    { label: 'Tell us when you\'re free (we\'ll auto-schedule your matches)', completed: hasAvailability },
    { label: 'Play your first match and get rated', completed: hasPlayedMatch },
  ]
}

function getInviteLink(county: string): string {
  const url = new URL(window.location.href)
  url.search = ''
  url.searchParams.set('join', county)
  return url.toString()
}

function handleInvite(county: string) {
  const link = getInviteLink(county)
  const message = `Join the Rally tennis tournament in ${county}. Let's start competing.\n${link}`
  if (navigator.share) {
    navigator.share({ title: 'Rally Tennis', text: message, url: link }).catch(() => {
      window.open(`sms:?body=${encodeURIComponent(message)}`, '_self')
    })
  } else {
    window.open(`sms:?body=${encodeURIComponent(message)}`, '_self')
  }
}

type ActionType = 'score' | 'respond' | 'schedule' | 'escalated' | 'message'

interface ActionCard {
  type: ActionType
  label: string
  detail: string
  opponentId: string
  opponentName: string
  tournamentId: string
  matchId: string
  priority: number
}

function isPlayerInTournament(tournament: Tournament, playerId: string): boolean {
  return tournament.players.some(p => p.id === playerId)
}

function isMyMatch(match: Match, playerId: string): boolean {
  return match.player1Id === playerId || match.player2Id === playerId
}

function getOpponentId(match: Match, playerId: string): string | null {
  if (match.player1Id === playerId) return match.player2Id
  if (match.player2Id === playerId) return match.player1Id
  return null
}

function playerNameWithSeed(tournament: Tournament, playerId: string | null): string {
  const name = getPlayerName(tournament, playerId)
  const seed = getPlayerSeed(tournament, playerId)
  return seed != null ? `${name} [#${seed}]` : name
}

function buildActionCards(
  tournaments: Tournament[],
  playerId: string
): ActionCard[] {
  const cards: ActionCard[] = []

  for (const tournament of tournaments) {
    for (const match of tournament.matches) {
      if (match.completed) continue
      if (!isMyMatch(match, playerId)) continue
      if (!match.player1Id || !match.player2Id) continue

      const opponentId = getOpponentId(match, playerId)
      const opponentName = playerNameWithSeed(tournament, opponentId)
      const schedule = match.schedule

      // Escalated matches
      if (schedule?.status === 'escalated') {
        cards.push({
          type: 'escalated',
          label: 'Urgent',
          detail: `Escalation day ${schedule.escalationDay} — respond now`,
          opponentId: opponentId!,
          opponentName,
          tournamentId: tournament.id,
          matchId: match.id,
          priority: 0,
        })
        continue
      }

      // Matches needing scoring: confirmed + not completed + is my match
      if (schedule?.status === 'confirmed' && schedule.confirmedSlot) {
        cards.push({
          type: 'score',
          label: 'Report Score',
          detail: 'Match confirmed — enter result',
          opponentId: opponentId!,
          opponentName,
          tournamentId: tournament.id,
          matchId: match.id,
          priority: 1,
        })
        continue
      }

      // Matches with pending proposals from opponent (not from me)
      if (schedule?.status === 'proposed') {
        const pendingFromOpponent = schedule.proposals.filter(
          p => p.status === 'pending' && p.proposedBy !== playerId && p.proposedBy !== 'system'
        )
        // Also count system proposals as needing a response
        const pendingSystem = schedule.proposals.filter(
          p => p.status === 'pending' && p.proposedBy === 'system'
        )
        const respondableCount = pendingFromOpponent.length + pendingSystem.length

        if (respondableCount > 0) {
          cards.push({
            type: 'respond',
            label: 'Match Ready',
            detail: 'Rally found a time — confirm it',
            opponentId: opponentId!,
            opponentName,
            tournamentId: tournament.id,
            matchId: match.id,
            priority: 2,
          })
          continue
        }
      }

      // Unscheduled matches or proposed with no acceptable proposals
      if (
        !schedule ||
        schedule.status === 'unscheduled' ||
        (schedule.status === 'proposed' &&
          schedule.proposals.every(p => p.status === 'rejected' || p.proposedBy === playerId))
      ) {
        cards.push({
          type: 'schedule',
          label: 'Schedule',
          detail: 'Find a time to play',
          opponentId: opponentId!,
          opponentName,
          tournamentId: tournament.id,
          matchId: match.id,
          priority: 3,
        })
        continue
      }
    }
  }

  // Add unread message action cards
  const conversations = getConversationList(playerId)
  const existingOpponentIds = new Set(cards.map(c => c.opponentId))
  for (const conv of conversations) {
    if (conv.unreadCount === 0) continue
    // Only show if this opponent is in an active tournament
    const inActiveTournament = tournaments.some(t =>
      t.status === 'in-progress' && t.players.some(p => p.id === conv.otherPlayerId)
    )
    if (!inActiveTournament) continue
    // Don't duplicate if already has a match action card for this opponent
    if (existingOpponentIds.has(conv.otherPlayerId)) continue
    cards.push({
      type: 'message',
      label: 'Message',
      detail: `${conv.unreadCount} unread message${conv.unreadCount !== 1 ? 's' : ''}`,
      opponentId: conv.otherPlayerId,
      opponentName: conv.otherPlayerName,
      tournamentId: '',
      matchId: '',
      priority: 2.5,
    })
  }

  cards.sort((a, b) => a.priority - b.priority)
  return cards
}

function getProgressText(tournament: Tournament): string {
  if (tournament.format === 'single-elimination') {
    const totalRounds = Math.max(...tournament.matches.map(m => m.round), 1)
    const completedRounds = tournament.matches.reduce((max, m) => {
      if (!m.completed) return max
      return Math.max(max, m.round)
    }, 0)
    const incompleteMatches = tournament.matches.filter(m => !m.completed && m.player1Id && m.player2Id)
    const currentRound = incompleteMatches.length > 0
      ? Math.min(...incompleteMatches.map(m => m.round))
      : completedRounds
    return `Round ${currentRound} of ${totalRounds}`
  }

  if (tournament.format === 'group-knockout') {
    const groupMatches = tournament.matches.filter(m => m.phase === 'group')
    const groupDone = groupMatches.filter(m => m.completed).length
    if (!tournament.groupPhaseComplete) {
      return `Group stage: ${groupDone} of ${groupMatches.length} matches`
    }
    const knockoutMatches = tournament.matches.filter(m => m.phase === 'knockout')
    const knockoutDone = knockoutMatches.filter(m => m.completed).length
    if (knockoutDone === 0) return 'Semifinals'
    if (knockoutDone < knockoutMatches.length) return 'Final'
    return 'Completed'
  }

  const completed = tournament.matches.filter(m => m.completed).length
  const total = tournament.matches.length
  return `${completed} of ${total} matches played`
}

function getUpNextMatch(
  tournaments: Tournament[],
  playerId: string
): { tournament: Tournament; match: Match } | null {
  for (const tournament of tournaments) {
    for (const match of tournament.matches) {
      if (
        !match.completed &&
        isMyMatch(match, playerId) &&
        match.schedule?.status === 'confirmed' &&
        match.schedule.confirmedSlot
      ) {
        return { tournament, match }
      }
    }
  }
  return null
}



export default function Home({
  profile,
  tournaments,
  autoJoin,
  onAutoJoinConsumed,
  onTournamentCreated,
  onViewTournament,
  onViewMatch,
  onViewLeaderboard,
  onViewOffers,
  onDataChanged,
  onViewHelp,
}: Props) {
  const [expandedCardKey, setExpandedCardKey] = useState<string | null>(null)
  const [messagingCardKey, setMessagingCardKey] = useState<string | null>(null)
  const [hiwDismissed, setHiwDismissed] = useState(() => localStorage.getItem('rally_hiw_dismissed') === '1')

  const activeTournaments = useMemo(
    () => tournaments.filter(
      t => t.status === 'in-progress' && isPlayerInTournament(t, profile.id)
    ),
    [tournaments, profile.id]
  )

  const setupTournaments = useMemo(
    () => tournaments.filter(
      t => t.status === 'setup' && isPlayerInTournament(t, profile.id)
    ),
    [tournaments, profile.id]
  )

  const actionCards = useMemo(
    () => buildActionCards(activeTournaments, profile.id),
    [activeTournaments, profile.id]
  )

  const upNext = useMemo(
    () => getUpNextMatch(activeTournaments, profile.id),
    [activeTournaments, profile.id]
  )

  // Onboarding state
  const hasAvailability = getAvailability(profile.id).length > 0
  const hasPlayedMatch = tournaments.some(t =>
    t.matches.some(m =>
      m.completed &&
      (m.player1Id === profile.id || m.player2Id === profile.id)
    )
  )
  const activationSteps = getActivationSteps(profile, tournaments, hasAvailability, hasPlayedMatch)
  const showOnboarding = !activationSteps.every(s => s.completed)

  // Leaderboard teaser
  const leaderboard = useMemo(() => getCountyLeaderboard(profile.county), [profile.county, tournaments])
  const topPlayers = leaderboard.slice(0, 3)

  // Player's own leaderboard entry (for personalized leaderboard)
  const myLeaderboardEntry = leaderboard.find(
    e => e.name.toLowerCase() === profile.name.toLowerCase()
  )
  const myRating = getPlayerRating(profile.id, profile.name)

  // No active or setup tournament: show lobby + status + leaderboard
  if (activeTournaments.length === 0 && setupTournaments.length === 0) {
    return (
      <div className="home-section home-section-spaced">
        <Lobby profile={profile} autoJoin={autoJoin} onAutoJoinConsumed={onAutoJoinConsumed} onTournamentCreated={onTournamentCreated} />

        {!hasAvailability && (
          <div className="card" style={{ borderLeft: '3px solid var(--color-warning, #f59e0b)', background: 'var(--color-surface)' }}>
            <div style={{ padding: '2px 0', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
              <strong>Add your availability</strong> so matches can be scheduled around your calendar. Go to Profile to set your times.
            </div>
          </div>
        )}

        {/* How Rally Works card */}
        {!hiwDismissed && (
          <div className="how-rally-works">
            <div className="how-rally-works-header">
              <h3>How Rally Works</h3>
              <button className="how-rally-works-dismiss" onClick={() => { setHiwDismissed(true); localStorage.setItem('rally_hiw_dismissed', '1') }} aria-label="Dismiss">&#10005;</button>
            </div>
            <div className="how-rally-steps">
              <div className="how-rally-step">
                <div className="how-rally-step-icon how-rally-step-icon--join">1</div>
                <div className="how-rally-step-text">
                  <strong>Join</strong>
                  <span>Sign up for a tournament in your area</span>
                </div>
              </div>
              <div className="how-rally-step">
                <div className="how-rally-step-icon how-rally-step-icon--play">2</div>
                <div className="how-rally-step-text">
                  <strong>Play</strong>
                  <span>Matches auto-scheduled from your availability</span>
                </div>
              </div>
              <div className="how-rally-step">
                <div className="how-rally-step-icon how-rally-step-icon--compete">3</div>
                <div className="how-rally-step-text">
                  <strong>Compete</strong>
                  <span>Top 4 advance to finals for the championship</span>
                </div>
              </div>
            </div>
            <div className="how-rally-footer">
              ~30 days per season
              {onViewHelp && <button className="how-rally-learn-more" onClick={onViewHelp}>Learn more</button>}
            </div>
          </div>
        )}

        {/* User Status Block */}
        <div className="card user-status-card">
          <div className="user-status-row">
            <div className="user-status-info">
              <div className="user-status-headline">Not in a tournament</div>
              <div className="user-status-sub">Join the lobby above to start competing</div>
            </div>
            <div className="user-status-rating">
              <span className="user-status-rating-value">{Math.round(myRating.rating)}</span>
              <span className="user-status-rating-label">Elo</span>
            </div>
          </div>
        </div>

        {/* Leaderboard Block */}
        {topPlayers.length > 1 && (
          <div className="card leaderboard-teaser" onClick={onViewLeaderboard}>
            <h3 className="leaderboard-teaser-title">Top Players in {profile.county}</h3>
            {topPlayers.map(entry => (
              <div key={entry.name} className={`leaderboard-teaser-row ${entry.name.toLowerCase() === profile.name.toLowerCase() ? 'is-me' : ''}`}>
                <span className="leaderboard-rank">#{entry.rank}</span>
                <span className="leaderboard-name">{entry.name}{entry.name.toLowerCase() === profile.name.toLowerCase() ? ' (You)' : ''}</span>
                <span className="leaderboard-rating">{Math.round(entry.rating)}</span>
              </div>
            ))}
            {/* Show user's own rank if not in top 3 */}
            {myLeaderboardEntry && !topPlayers.some(e => e.name.toLowerCase() === profile.name.toLowerCase()) && (
              <>
                <div className="leaderboard-teaser-divider" />
                <div className="leaderboard-teaser-row is-me">
                  <span className="leaderboard-rank">#{myLeaderboardEntry.rank}</span>
                  <span className="leaderboard-name">You</span>
                  <span className="leaderboard-rating">{Math.round(myLeaderboardEntry.rating)}</span>
                </div>
              </>
            )}
            {!myLeaderboardEntry && (
              <>
                <div className="leaderboard-teaser-divider" />
                <div className="leaderboard-teaser-row is-me">
                  <span className="leaderboard-rank">—</span>
                  <span className="leaderboard-name">You</span>
                  <span className="leaderboard-rating">{Math.round(myRating.rating)}</span>
                </div>
              </>
            )}
            <button className="btn-link leaderboard-see-all">See full leaderboard</button>
          </div>
        )}

      </div>
    )
  }

  // Setup tournament: show lobby + status + leaderboard
  if (activeTournaments.length === 0 && setupTournaments.length > 0) {
    return (
      <div className="home-section home-section-spaced">
        <Lobby profile={profile} autoJoin={autoJoin} onAutoJoinConsumed={onAutoJoinConsumed} onTournamentCreated={onTournamentCreated} />

        {!hasAvailability && (
          <div className="card" style={{ borderLeft: '3px solid var(--color-warning, #f59e0b)', background: 'var(--color-surface)' }}>
            <div style={{ padding: '2px 0', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
              <strong>Add your availability</strong> so matches can be scheduled around your calendar. Go to Profile to set your times.
            </div>
          </div>
        )}

        {/* User Status Block */}
        <div className="card user-status-card">
          <div className="user-status-row">
            <div className="user-status-info">
              <div className="user-status-headline">Tournament forming</div>
              <div className="user-status-sub">Waiting for more players to join</div>
            </div>
            <div className="user-status-rating">
              <span className="user-status-rating-value">{Math.round(myRating.rating)}</span>
              <span className="user-status-rating-label">Elo</span>
            </div>
          </div>
        </div>

        {/* Leaderboard Block */}
        {topPlayers.length > 1 && (
          <div className="card leaderboard-teaser" onClick={onViewLeaderboard}>
            <h3 className="leaderboard-teaser-title">Top Players in {profile.county}</h3>
            {topPlayers.map(entry => (
              <div key={entry.name} className={`leaderboard-teaser-row ${entry.name.toLowerCase() === profile.name.toLowerCase() ? 'is-me' : ''}`}>
                <span className="leaderboard-rank">#{entry.rank}</span>
                <span className="leaderboard-name">{entry.name}{entry.name.toLowerCase() === profile.name.toLowerCase() ? ' (You)' : ''}</span>
                <span className="leaderboard-rating">{Math.round(entry.rating)}</span>
              </div>
            ))}
            {myLeaderboardEntry && !topPlayers.some(e => e.name.toLowerCase() === profile.name.toLowerCase()) && (
              <>
                <div className="leaderboard-teaser-divider" />
                <div className="leaderboard-teaser-row is-me">
                  <span className="leaderboard-rank">#{myLeaderboardEntry.rank}</span>
                  <span className="leaderboard-name">You</span>
                  <span className="leaderboard-rating">{Math.round(myLeaderboardEntry.rating)}</span>
                </div>
              </>
            )}
            <button className="btn-link leaderboard-see-all">See full leaderboard</button>
          </div>
        )}
      </div>
    )
  }

  // Active tournament dashboard
  return (
    <div className="home-section">
      {/* Onboarding (shows until all steps complete) */}
      {showOnboarding && (
        <div className="card onboarding-card">
          <h3 className="onboarding-title">Welcome to Rally!</h3>
          <p className="onboarding-subtitle">Here's how to get started — we'll handle the scheduling.</p>
          <div className="onboarding-steps">
            {activationSteps.map((step, i) => (
              <div key={i} className={`onboarding-step ${step.completed ? 'completed' : ''}`}>
                <span className="onboarding-step-icon">
                  {step.completed ? (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="8" fill="var(--color-positive-primary)" />
                      <path d="M5 8l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="7.5" stroke="var(--color-divider)" />
                    </svg>
                  )}
                </span>
                <span className="onboarding-step-label">{step.label}</span>
              </div>
            ))}
          </div>
          <button className="btn btn-primary onboarding-cta" onClick={() => handleInvite(profile.county)}>Invite Friends — Fill Your Tournament Faster</button>
        </div>
      )}

      {/* Tournament Summary Card */}
      {activeTournaments.map(tournament => {
        const totalMatches = tournament.matches.filter(m => m.player1Id && m.player2Id).length
        const completedMatches = tournament.matches.filter(m => m.completed).length
        const progressPct = totalMatches > 0 ? Math.round((completedMatches / totalMatches) * 100) : 0
        return (
          <div key={tournament.id} className="card tournament-card" onClick={() => onViewTournament(tournament.id)}>
            <div className="card-eyebrow" style={{ color: 'var(--color-text-secondary)' }}>Your Tournament</div>
            <div className="card-title">{tournament.name}</div>
            <div className="card-secondary">
              {tournament.players.length} players · {tournament.format === 'single-elimination' ? 'Playoffs' : tournament.format === 'group-knockout' ? 'Group + Playoffs' : 'Round robin'} · {getProgressText(tournament)}
            </div>
            <div className="tournament-progress-bar">
              <div className="tournament-progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        )
      })}

      {/* Match Offers summary — details on Find Match tab */}
      {(() => {
        const incoming = getIncomingOffers(profile.id)
        if (incoming.length === 0) return null
        return (
          <div className="card offer-summary-card" onClick={onViewOffers} style={{ cursor: 'pointer' }}>
            <div className="card-eyebrow" style={{ color: 'var(--color-accent-blue, #2563eb)' }}>Match Offers</div>
            <div className="card-title">{incoming.length} offer{incoming.length !== 1 ? 's' : ''} waiting</div>
            <button className="btn-link">View on Find Match</button>
          </div>
        )
      })()}

      {/* Action Cards */}
      {actionCards.length > 0 ? (
        <div className="action-cards">
          {actionCards.map(card => {
            const cardKey = `${card.tournamentId}-${card.matchId}`
            const isExpanded = expandedCardKey === cardKey
            const cardTournament = activeTournaments.find(t => t.id === card.tournamentId)
            const cardMatch = cardTournament?.matches.find(m => m.id === card.matchId)

            const isMessaging = messagingCardKey === cardKey
            const hasUnread = card.opponentId ? hasUnreadFrom(profile.id, card.opponentId) : false

            return (
              <div
                key={cardKey}
                className={`action-card action-${card.type}`}
                onClick={() => card.type === 'message'
                  ? setMessagingCardKey(isMessaging ? null : cardKey)
                  : setExpandedCardKey(isExpanded ? null : cardKey)
                }
              >
                <div className="action-card-type">{card.label}</div>
                <div className="action-card-opponent">{card.type === 'message' ? 'from' : 'vs'} {card.opponentName}</div>
                <div className="action-card-detail">{card.detail}</div>
                <div className="action-card-buttons">
                  {card.type === 'message' ? (
                    <button className="action-card-btn" onClick={e => {
                      e.stopPropagation()
                      setMessagingCardKey(isMessaging ? null : cardKey)
                    }}>
                      Reply
                    </button>
                  ) : !isExpanded ? (
                    <button className="action-card-btn" onClick={e => {
                      e.stopPropagation()
                      setExpandedCardKey(cardKey)
                    }}>
                      {card.type === 'score' ? 'Enter Score' : card.type === 'respond' ? 'Confirm Time' : card.type === 'escalated' ? 'Respond Now' : 'Schedule Match'}
                    </button>
                  ) : null}
                  {card.type !== 'message' && (
                    <button
                      className={`match-card-msg-btn ${isMessaging ? 'active' : ''}`}
                      onClick={e => { e.stopPropagation(); setMessagingCardKey(isMessaging ? null : cardKey) }}
                      aria-label="Message opponent"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M2 3h12v8H4l-2 2V3z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                      </svg>
                      {hasUnread && <span className="msg-unread-dot" />}
                    </button>
                  )}
                </div>
                {isMessaging && card.opponentId && (
                  <div onClick={e => e.stopPropagation()}>
                    <MessagePanel
                      currentPlayerId={profile.id}
                      currentPlayerName={profile.name}
                      otherPlayerId={card.opponentId}
                      otherPlayerName={card.opponentName.replace(/\s*\(\d+\)$/, '')}
                      onClose={() => setMessagingCardKey(null)}
                    />
                  </div>
                )}
                {isExpanded && cardTournament && cardMatch && (
                  <div onClick={e => e.stopPropagation()}>
                    {card.type === 'score' ? (
                      <InlineScoreEntry
                        tournament={cardTournament}
                        matchId={cardMatch.id}
                        onSaved={() => {
                          setExpandedCardKey(null)
                          onDataChanged?.()
                        }}
                      />
                    ) : cardMatch.schedule ? (
                      <MatchSchedulePanel
                        tournament={cardTournament}
                        match={cardMatch}
                        currentPlayerId={profile.id}
                        onUpdated={() => {
                          setExpandedCardKey(null)
                          onDataChanged?.()
                        }}
                      />
                    ) : null}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="card" style={{ cursor: 'default' }}>
          <div className="caught-up">
            <p>You're all caught up</p>
            <p className="caught-up-sub">No matches need your attention right now</p>
          </div>
        </div>
      )}

      {/* Up Next Card */}
      {upNext && upNext.match.schedule?.confirmedSlot && (() => {
        const slot = upNext.match.schedule!.confirmedSlot!
        const day = slot.day.charAt(0).toUpperCase() + slot.day.slice(1, 3)
        const period = slot.startHour >= 12 ? 'pm' : 'am'
        const hour = slot.startHour % 12 || 12
        const upNextKey = `${upNext.tournament.id}-${upNext.match.id}`
        const upNextExpanded = expandedCardKey === upNextKey
        return (
          <div className="card upnext-card" onClick={() => setExpandedCardKey(upNextExpanded ? null : upNextKey)}>
            <div>
              <div className="upnext-label">Confirmed</div>
              <div className="upnext-opponent">
                vs {playerNameWithSeed(upNext.tournament, getOpponentId(upNext.match, profile.id))}
              </div>
            </div>
            <div className="upnext-time">
              <span className="upnext-time-day">{day}</span>
              <span className="upnext-time-hour">{hour}{period}</span>
            </div>
            {upNextExpanded && (
              <div onClick={e => e.stopPropagation()} style={{ gridColumn: '1 / -1' }}>
                <InlineScoreEntry
                  tournament={upNext.tournament}
                  matchId={upNext.match.id}
                  onSaved={() => {
                    setExpandedCardKey(null)
                    onDataChanged?.()
                  }}
                />
              </div>
            )}
          </div>
        )
      })()}

      {/* Leaderboard Teaser */}
      {topPlayers.length > 1 && (
        <div className="card leaderboard-teaser" onClick={onViewLeaderboard}>
          <div className="card-eyebrow" style={{ color: 'var(--color-text-secondary)' }}>Rally Ratings</div>
          <div className="card-secondary" style={{ marginBottom: 8 }}>Ratings update after each match</div>
          {topPlayers.map(entry => (
            <div key={entry.name} className={`leaderboard-teaser-row ${entry.name.toLowerCase() === profile.name.toLowerCase() ? 'is-me' : ''}`}>
              <span className="leaderboard-rank">#{entry.rank}</span>
              <span className="leaderboard-name">{entry.name}</span>
              <span className="leaderboard-rating">{Math.round(entry.rating)}</span>
            </div>
          ))}
          <button className="btn-link leaderboard-see-all">See full leaderboard</button>
        </div>
      )}

      {/* View All */}
      <div className="home-view-all">
        <button className="btn-link" onClick={() => onViewTournament(activeTournaments[0].id)}>
          View full bracket and standings
        </button>
      </div>
    </div>
  )
}
