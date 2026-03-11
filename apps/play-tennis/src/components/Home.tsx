import { useMemo } from 'react'
import { getPlayerName, getPlayerSeed, getAvailability, getPlayerRating, getCountyLeaderboard, getTournamentsByCounty, getIncomingOffers } from '../store'
import { PlayerProfile, Tournament, Match } from '../types'
import Lobby from './Lobby'

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
    { label: 'Create profile', completed: true },
    { label: 'Start or join tournament', completed: inTournament || hasPlayedMatch },
    { label: 'Add availability', completed: hasAvailability },
    { label: 'Play your first match', completed: hasPlayedMatch },
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

type ActionType = 'score' | 'respond' | 'schedule' | 'escalated'

interface ActionCard {
  type: ActionType
  label: string
  detail: string
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
  return seed != null ? `${name} (${seed})` : name
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
          label: 'Score Match',
          detail: 'Match confirmed — enter result',
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
            label: 'Respond',
            detail: `${respondableCount} time slot${respondableCount === 1 ? '' : 's'} proposed`,
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
          opponentName,
          tournamentId: tournament.id,
          matchId: match.id,
          priority: 3,
        })
        continue
      }
    }
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

function formatSlot(slot: { day: string; startHour: number; endHour: number }): string {
  const day = slot.day.charAt(0).toUpperCase() + slot.day.slice(1)
  const fmt = (h: number) => {
    const period = h >= 12 ? 'pm' : 'am'
    const hour = h % 12 || 12
    return `${hour}${period}`
  }
  return `${day} ${fmt(slot.startHour)}–${fmt(slot.endHour)}`
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
}: Props) {
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
          <h3 className="onboarding-title">Welcome to Rally</h3>
          <p className="onboarding-subtitle">Your next steps</p>
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
          <button className="btn btn-primary onboarding-cta" onClick={() => handleInvite(profile.county)}>Invite Players</button>
        </div>
      )}

      {/* Tournament Summary Card */}
      {activeTournaments.map(tournament => {
        const totalMatches = tournament.matches.filter(m => m.player1Id && m.player2Id).length
        const completedMatches = tournament.matches.filter(m => m.completed).length
        const progressPct = totalMatches > 0 ? Math.round((completedMatches / totalMatches) * 100) : 0
        return (
          <div key={tournament.id} className="card tournament-card" onClick={() => onViewTournament(tournament.id)}>
            <div className="card-top">
              <h3>{tournament.name}</h3>
              <span className="badge badge-live">
                {tournament.format === 'single-elimination' ? 'Knockout' : tournament.format === 'group-knockout' ? 'Group + Knockout' : 'Round Robin'}
              </span>
            </div>
            <div className="card-meta">
              <span>{tournament.players.length} players</span>
              <span>{getProgressText(tournament)}</span>
            </div>
            <div className="tournament-progress-bar">
              <div className="tournament-progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        )
      })}

      {/* Incoming Match Offers */}
      {(() => {
        const offers = getIncomingOffers(profile.id)
        if (offers.length === 0) return null
        return (
          <div className="action-cards">
            {offers.map(offer => (
              <div
                key={offer.offerId}
                className="action-card action-respond"
                onClick={onViewOffers}
              >
                <div className="action-card-type">Match Offer</div>
                <div className="action-card-opponent">{offer.senderName}</div>
                <div className="action-card-detail">{offer.proposedTime} · {offer.proposedDate}</div>
              </div>
            ))}
          </div>
        )
      })()}

      {/* Action Cards */}
      {actionCards.length > 0 ? (
        <div className="action-cards">
          {actionCards.map(card => (
            <div
              key={`${card.tournamentId}-${card.matchId}`}
              className={`action-card action-${card.type}`}
              onClick={() => onViewMatch(card.tournamentId, card.matchId)}
            >
              <div className="action-card-type">{card.label}</div>
              <div className="action-card-opponent">vs {card.opponentName}</div>
              <div className="action-card-detail">{card.detail}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          <div className="caught-up">
            <p>You're all caught up</p>
            <p className="caught-up-sub">No matches need your attention right now</p>
          </div>
        </div>
      )}

      {/* Up Next Card */}
      {upNext && upNext.match.schedule?.confirmedSlot && (
        <div className="card upnext-card">
          <div>
            <div className="upnext-label">Up Next</div>
            <div className="upnext-opponent">
              vs {playerNameWithSeed(upNext.tournament, getOpponentId(upNext.match, profile.id))}
            </div>
          </div>
          <div className="upnext-time">
            <div>{formatSlot(upNext.match.schedule.confirmedSlot)}</div>
          </div>
        </div>
      )}

      {/* Leaderboard Teaser */}
      {topPlayers.length > 1 && (
        <div className="card leaderboard-teaser" onClick={onViewLeaderboard}>
          <h3 className="leaderboard-teaser-title">Top Players in {profile.county}</h3>
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
          View bracket
        </button>
      </div>
    </div>
  )
}
