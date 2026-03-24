import { useMemo, useState } from 'react'
import { getAvailability, getPlayerRating, getCountyLeaderboard, getTournamentsByCounty, getIncomingOffers, getConversationList, logout } from '../store'
import { PlayerProfile, Tournament, Match } from '../types'
import { getMatchCardView } from '../matchCardModel'
import Lobby from './Lobby'
import MessagePanel from './MessagePanel'
import MatchActionCard from './MatchActionCard'

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
  onLogout?: () => void
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

interface HomeMatchCard {
  tournament: Tournament
  match: Match
  priority: number
}

interface MessageCard {
  label: string
  detail: string
  opponentId: string
  opponentName: string
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

function buildHomeMatchCards(
  tournaments: Tournament[],
  playerId: string
): HomeMatchCard[] {
  const cards: HomeMatchCard[] = []

  for (const tournament of tournaments) {
    for (const match of tournament.matches) {
      if (!isMyMatch(match, playerId)) continue
      if (!match.player1Id || !match.player2Id) continue
      const view = getMatchCardView(tournament, match, playerId)
      if (!view.showOnHome) continue
      cards.push({
        tournament,
        match,
        priority: view.priority,
      })
    }
  }

  cards.sort((a, b) => a.priority - b.priority)
  return cards
}

function buildMessageCards(
  tournaments: Tournament[],
  playerId: string,
  matchCards: HomeMatchCard[]
): MessageCard[] {
  const cards: MessageCard[] = []
  const conversations = getConversationList(playerId)
  const existingOpponentIds = new Set(
    matchCards
      .map(card => getMatchCardView(card.tournament, card.match, playerId).opponentId)
      .filter((opponentId): opponentId is string => Boolean(opponentId))
  )

  for (const conv of conversations) {
    if (conv.unreadCount === 0) continue
    const inActiveTournament = tournaments.some(
      tournament => tournament.status === 'in-progress' && tournament.players.some(player => player.id === conv.otherPlayerId)
    )
    if (!inActiveTournament) continue
    if (existingOpponentIds.has(conv.otherPlayerId)) continue
    cards.push({
      label: 'MESSAGE',
      detail: `${conv.unreadCount} unread message${conv.unreadCount !== 1 ? 's' : ''}`,
      opponentId: conv.otherPlayerId,
      opponentName: conv.otherPlayerName,
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
  onLogout,
}: Props) {
  const [expandedCardKey, setExpandedCardKey] = useState<string | null>(null)
  const [messagingCardKey, setMessagingCardKey] = useState<string | null>(null)
  const [hiwDismissed, setHiwDismissed] = useState(() => localStorage.getItem('rally_hiw_dismissed') === '1')

  async function handleLogout() {
    if (confirm('Sign out? You can sign back in with your email.')) {
      await logout()
      onLogout?.()
    }
  }

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

  const matchCards = useMemo(
    () => buildHomeMatchCards(activeTournaments, profile.id),
    [activeTournaments, profile.id]
  )

  const upNext = useMemo(
    () => getUpNextMatch(activeTournaments, profile.id),
    [activeTournaments, profile.id]
  )

  const actionCards = useMemo(
    () => matchCards.filter(card => !(upNext && card.tournament.id === upNext.tournament.id && card.match.id === upNext.match.id)),
    [matchCards, upNext]
  )

  const messageCards = useMemo(
    () => buildMessageCards(activeTournaments, profile.id, matchCards),
    [activeTournaments, profile.id, matchCards]
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

  const availabilityReminder = !hasAvailability ? (
    <div className="card card-inline-alert card-inline-alert--warning">
      <div className="card-status-row">
        <div className="card-status-label card-status-label--amber">Needs Setup</div>
      </div>
      <div className="card-summary-main">
        <div className="card-title">Add your availability</div>
        <div className="card-supporting">Matches schedule around your calendar. Go to Profile to set your times.</div>
      </div>
    </div>
  ) : null

  const renderUserStatusCard = (headline: string, supporting: string, statusLabel: string) => (
    <div className="card user-status-card">
      <div className="card-status-row">
        <div className="card-status-label card-status-label--slate">{statusLabel}</div>
        <div className="card-meta-chip card-meta-chip--blue">Rating {Math.round(myRating.rating)}</div>
      </div>
      <div className="card-summary-main">
        <div className="card-title">{headline}</div>
        <div className="card-supporting">{supporting}</div>
      </div>
    </div>
  )

  const renderLeaderboardTeaser = (title: string, supporting: string) => {
    if (topPlayers.length <= 1) return null
    return (
      <div className="card leaderboard-teaser" onClick={onViewLeaderboard}>
        <div className="card-status-row">
          <div className="card-status-label card-status-label--blue">Leaderboard</div>
          <div className="card-meta-chip">{profile.county}</div>
        </div>
        <div className="card-summary-main">
          <div className="card-title">{title}</div>
          <div className="card-supporting">{supporting}</div>
        </div>
        <div className="leaderboard-teaser-list">
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
        </div>
        <button className="btn-link leaderboard-see-all">See full leaderboard</button>
      </div>
    )
  }

  // No active or setup tournament: show lobby + status + leaderboard
  if (activeTournaments.length === 0 && setupTournaments.length === 0) {
    return (
      <div className="home-section home-section-spaced">
        <Lobby profile={profile} autoJoin={autoJoin} onAutoJoinConsumed={onAutoJoinConsumed} onTournamentCreated={onTournamentCreated} />

        {availabilityReminder}

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
        {renderUserStatusCard('Not in a tournament', 'Join the lobby above to start competing.', 'Status')}

        {/* Leaderboard Block */}
        {renderLeaderboardTeaser(`Top players in ${profile.county}`, 'See where you stand before your next tournament.')}

        <button className="btn btn-large logout-btn" onClick={handleLogout}>Sign Out</button>
      </div>
    )
  }

  // Setup tournament: show lobby + status + leaderboard
  if (activeTournaments.length === 0 && setupTournaments.length > 0) {
    return (
      <div className="home-section home-section-spaced">
        <Lobby profile={profile} autoJoin={autoJoin} onAutoJoinConsumed={onAutoJoinConsumed} onTournamentCreated={onTournamentCreated} />

        {availabilityReminder}

        {/* User Status Block */}
        {renderUserStatusCard('Tournament forming', 'Waiting for more players to join your bracket.', 'Status')}

        {/* Leaderboard Block */}
        {renderLeaderboardTeaser(`Top players in ${profile.county}`, 'Ratings update after each result, even while the bracket is forming.')}

        <button className="btn btn-large logout-btn" onClick={handleLogout}>Sign Out</button>
      </div>
    )
  }

  // Active tournament dashboard
  return (
    <div className="home-section">
      {/* Onboarding (shows until all steps complete) */}
      {showOnboarding && (
        <div className="card onboarding-card">
          <div className="card-status-row">
            <div className="card-status-label card-status-label--blue">Get Started</div>
            <div className="card-meta-chip">{activationSteps.filter(step => step.completed).length}/{activationSteps.length} complete</div>
          </div>
          <div className="card-summary-main">
            <div className="card-title">Welcome to Rally</div>
            <div className="card-supporting">Finish these steps and Rally will handle the scheduling for you.</div>
          </div>
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
            <div className="card-status-row">
              <div className="card-status-label card-status-label--slate">Your Tournament</div>
              <div className="card-meta-chip">{progressPct}% complete</div>
            </div>
            <div className="card-summary-main">
              <div className="card-title">{tournament.name}</div>
              <div className="card-supporting">
                {tournament.players.length} players · {tournament.format === 'single-elimination' ? 'Playoffs' : tournament.format === 'group-knockout' ? 'Group + Playoffs' : 'Round robin'} · {getProgressText(tournament)}
              </div>
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
            <div className="card-status-row">
              <div className="card-status-label card-status-label--blue">Match Offers</div>
              <div className="card-meta-chip card-meta-chip--blue">{incoming.length} waiting</div>
            </div>
            <div className="card-summary-main">
              <div className="card-title">{incoming.length} offer{incoming.length !== 1 ? 's' : ''} waiting</div>
              <div className="card-supporting">Reply from the Find Match tab to keep your requests organized.</div>
            </div>
            <button className="btn btn-small">View on Find Match</button>
          </div>
        )
      })()}

      {/* Action Cards */}
      {actionCards.length > 0 || messageCards.length > 0 ? (
        <div className="action-cards">
          {actionCards.map(card => {
            const cardKey = `${card.tournament.id}-${card.match.id}`
            const isExpanded = expandedCardKey === cardKey
            const isMessaging = messagingCardKey === cardKey

            return (
              <MatchActionCard
                key={cardKey}
                tournament={card.tournament}
                match={card.match}
                currentPlayerId={profile.id}
                currentPlayerName={profile.name}
                isExpanded={isExpanded}
                isMessaging={isMessaging}
                onToggleExpanded={() => {
                  setMessagingCardKey(null)
                  setExpandedCardKey(isExpanded ? null : cardKey)
                }}
                onToggleMessaging={() => {
                  setExpandedCardKey(null)
                  setMessagingCardKey(isMessaging ? null : cardKey)
                }}
                onUpdated={() => {
                  setExpandedCardKey(null)
                  onDataChanged?.()
                }}
              />
            )
          })}
          {messageCards.map(card => {
            const cardKey = `message-${card.opponentId}`
            const isMessaging = messagingCardKey === cardKey
            return (
              <div
                key={cardKey}
                className="action-card action-message"
                onClick={() => {
                  setExpandedCardKey(null)
                  setMessagingCardKey(isMessaging ? null : cardKey)
                }}
              >
                <div className="action-card-status-row">
                  <div className="card-status-label card-status-label--blue">{card.label}</div>
                </div>
                <div className="action-card-main">
                  <div className="action-card-opponent">From {card.opponentName}</div>
                  <div className="action-card-supporting">{card.detail}</div>
                </div>
                <div className="action-card-buttons">
                  <button
                    className="action-card-btn"
                    onClick={event => {
                      event.stopPropagation()
                      setExpandedCardKey(null)
                      setMessagingCardKey(isMessaging ? null : cardKey)
                    }}
                  >
                    Reply
                  </button>
                </div>
                {isMessaging && (
                  <div className="action-card-expansion" onClick={event => event.stopPropagation()}>
                    <MessagePanel
                      currentPlayerId={profile.id}
                      currentPlayerName={profile.name}
                      otherPlayerId={card.opponentId}
                      otherPlayerName={card.opponentName}
                      onClose={() => setMessagingCardKey(null)}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="card card-inline-alert" style={{ cursor: 'default' }}>
          <div className="card-status-row">
            <div className="card-status-label card-status-label--green">All Clear</div>
          </div>
          <div className="card-summary-main">
            <div className="card-title">You're all caught up</div>
            <div className="card-supporting">No matches need your attention right now.</div>
          </div>
        </div>
      )}

      {/* Up Next Card */}
      {upNext && upNext.match.schedule?.confirmedSlot && (() => {
        const upNextKey = `${upNext.tournament.id}-${upNext.match.id}`
        const upNextExpanded = expandedCardKey === upNextKey
        const upNextMessaging = messagingCardKey === upNextKey
        return (
          <MatchActionCard
            className="upnext-card"
            tournament={upNext.tournament}
            match={upNext.match}
            currentPlayerId={profile.id}
            currentPlayerName={profile.name}
            isExpanded={upNextExpanded}
            isMessaging={upNextMessaging}
            onToggleExpanded={() => {
              setMessagingCardKey(null)
              setExpandedCardKey(upNextExpanded ? null : upNextKey)
            }}
            onToggleMessaging={() => {
              setExpandedCardKey(null)
              setMessagingCardKey(upNextMessaging ? null : upNextKey)
            }}
            onUpdated={() => {
              setExpandedCardKey(null)
              onDataChanged?.()
            }}
          />
        )
      })()}

      {/* Leaderboard Teaser */}
      {renderLeaderboardTeaser(`Top players in ${profile.county}`, 'Ratings update after each match.')}

      {/* View All */}
      <div className="home-view-all">
        <button className="btn-link" onClick={() => onViewTournament(activeTournaments[0].id)}>
          View full bracket and standings
        </button>
      </div>

      <button className="btn btn-large logout-btn" onClick={handleLogout}>Sign Out</button>
    </div>
  )
}
