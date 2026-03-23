import { formatSlotInline as formatSlotInlineNumeric, formatTimeFull } from '../dateUtils'
import { useMemo, useState } from 'react'
import { getPlayerName, getPlayerSeed, getAvailability, getPlayerRating, getCountyLeaderboard, getTournamentsByCounty, getIncomingOffers, hasUnreadFrom, getConversationList, getRescheduleUiState } from '../store'
import { getBuddies, sendBuddyRequest } from '../buddyStore'
import { PlayerProfile, Tournament, Match } from '../types'
import Lobby from './Lobby'
import MessagePanel from './MessagePanel'
import InlineScoreEntry from './InlineScoreEntry'
import UpcomingMatchPanel from './UpcomingMatchPanel'
import ScoreConfirmationPanel from './ScoreConfirmationPanel'
import CreateInviteLink from './CreateInviteLink'
import BuddiesSection from './BuddiesSection'

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

type ActionType = 'score' | 'respond' | 'schedule' | 'confirmed' | 'escalated' | 'message' | 'confirm-score'

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

function actionCardTone(type: ActionType): 'blue' | 'green' | 'amber' | 'red' | 'slate' {
  switch (type) {
    case 'respond':
    case 'message':
    case 'confirm-score':
      return 'blue'
    case 'confirmed':
      return 'green'
    case 'escalated':
      return 'red'
    case 'score':
    case 'schedule':
      return 'amber'
    default:
      return 'slate'
  }
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

const HOME_DAY_MAP: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
}

const SCORE_CONFIRMATION_WINDOW_MS = 48 * 60 * 60 * 1000

/** Format a { day, startHour } slot as inline text using shared dateUtils */
function formatSlotInline(slot: { day: string; startHour: number }): string {
  const dayNum = HOME_DAY_MAP[slot.day] ?? 1
  return formatSlotInlineNumeric({ day: dayNum, startHour: slot.startHour })
}

function formatScoreConfirmationTimeLeft(reportedAt: string | null | undefined): string | null {
  if (!reportedAt) return null
  const remainingMs = Math.max(0, new Date(reportedAt).getTime() + SCORE_CONFIRMATION_WINDOW_MS - Date.now())
  const totalMinutes = Math.ceil(remainingMs / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    const remHours = hours % 24
    return `${days}d ${remHours}h left`
  }
  if (hours > 0) return `${hours}h ${minutes}m left`
  return `${Math.max(0, totalMinutes)}m left`
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
      const rescheduleUiState = getRescheduleUiState(match, playerId)

      // Score reported by opponent — needs confirmation
      if (match.scoreReportedBy && match.scoreReportedBy !== playerId) {
        const scoreStr = match.score1.map((s, i) => `${s}-${match.score2[i]}`).join(', ')
        const timeLeft = formatScoreConfirmationTimeLeft(match.scoreReportedAt)
        cards.push({
          type: 'confirm-score',
          label: 'CONFIRM SCORE',
          detail: timeLeft ? `${opponentName} reported: ${scoreStr} · ${timeLeft}` : `${opponentName} reported: ${scoreStr}`,
          opponentId: opponentId!,
          opponentName,
          tournamentId: tournament.id,
          matchId: match.id,
          priority: 0.5,
        })
        continue
      }

      if (rescheduleUiState === 'soft_request_received') {
        cards.push({
          type: 'respond',
          label: 'NEEDS RESPONSE',
          detail: 'Your opponent asked to move the current time.',
          opponentId: opponentId!,
          opponentName,
          tournamentId: tournament.id,
          matchId: match.id,
          priority: 1,
        })
        continue
      }

      if (rescheduleUiState === 'hard_request_received') {
        cards.push({
          type: 'schedule',
          label: 'NEEDS NEW TIME',
          detail: 'Find a new time for this match.',
          opponentId: opponentId!,
          opponentName,
          tournamentId: tournament.id,
          matchId: match.id,
          priority: 1,
        })
        continue
      }

      if (rescheduleUiState === 'hard_request_sent') {
        cards.push({
          type: 'schedule',
          label: 'NEEDS NEW TIME',
          detail: 'Find a new time for this match.',
          opponentId: opponentId!,
          opponentName,
          tournamentId: tournament.id,
          matchId: match.id,
          priority: 1.5,
        })
        continue
      }

      // Score already reported by me — waiting for opponent
      if (match.scoreReportedBy && match.scoreReportedBy === playerId) {
        continue // Don't show any action card — waiting for confirmation
      }

      // Escalated matches
      if (schedule?.status === 'escalated') {
        cards.push({
          type: 'escalated',
          label: 'RESPOND NOW',
          detail: 'Scheduling needs your response.',
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
          type: 'confirmed',
          label: 'CONFIRMED',
          detail: 'Confirmed and ready to play.',
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
          const firstPending = [...pendingSystem, ...pendingFromOpponent][0]
          const dateStr = firstPending ? formatSlotInline(firstPending) : 'Rally found a time'
          cards.push({
            type: 'respond',
            label: 'NEEDS RESPONSE',
            detail: 'Review the proposed time and confirm if it works.',
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
          label: 'NEEDS SCHEDULING',
          detail: 'Set a time with your opponent.',
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
      label: 'MESSAGE',
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



/** Shows "Add X as a Tennis Buddy?" card after playing 2+ matches with someone */
function PostMatchBuddySuggestions({
  tournaments,
  profile,
}: {
  tournaments: Tournament[]
  profile: PlayerProfile
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [added, setAdded] = useState<Set<string>>(new Set())

  const suggestions = useMemo(() => {
    const existingBuddyIds = new Set(
      getBuddies(profile.id).map(b =>
        b.requesterId === profile.id ? b.recipientId : b.requesterId
      )
    )
    const counts = new Map<string, { name: string; count: number }>()
    for (const t of tournaments) {
      for (const m of t.matches) {
        if (!m.completed) continue
        if (!isMyMatch(m, profile.id)) continue
        const opponentId = getOpponentId(m, profile.id)
        if (!opponentId) continue
        if (existingBuddyIds.has(opponentId)) continue
        const opponentName = getPlayerName(t, opponentId)
        const prev = counts.get(opponentId)
        counts.set(opponentId, { name: opponentName, count: (prev?.count ?? 0) + 1 })
      }
    }
    return Array.from(counts.entries())
      .filter(([id, { count }]) => count >= 2 && !dismissed.has(id) && !added.has(id))
      .map(([id, { name, count }]) => ({ id, name, count }))
  }, [tournaments, profile.id, dismissed, added])

  if (suggestions.length === 0) return null

  return (
    <>
      {suggestions.map(s => (
        <div key={s.id} className="card" style={{ cursor: 'default' }}>
          <div className="card-status-row">
            <div className="card-status-label card-status-label--green">Tennis Buddies</div>
          </div>
          <div className="card-summary-main">
            <div className="card-title">Add {s.name} as a Tennis Buddy?</div>
            <div className="card-supporting">
              You've played {s.count} matches together. Buddies let you ping each other for a hit anytime.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              className="btn-primary"
              style={{ flex: 1, fontSize: 13 }}
              onClick={async () => {
                await sendBuddyRequest(profile.id, profile.name, s.id, s.name)
                setAdded(prev => new Set(prev).add(s.id))
              }}
            >
              Send Request
            </button>
            <button
              style={{
                flex: 1,
                background: 'none',
                border: '1px solid var(--color-divider)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text-secondary)',
                fontSize: 13,
                padding: '8px',
                cursor: 'pointer',
              }}
              onClick={() => setDismissed(prev => new Set(prev).add(s.id))}
            >
              Not now
            </button>
          </div>
        </div>
      ))}
    </>
  )
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

        <CreateInviteLink profile={profile} />

        {availabilityReminder}

        <BuddiesSection profile={profile} />

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

      </div>
    )
  }

  // Setup tournament: show lobby + status + leaderboard
  if (activeTournaments.length === 0 && setupTournaments.length > 0) {
    return (
      <div className="home-section home-section-spaced">
        <Lobby profile={profile} autoJoin={autoJoin} onAutoJoinConsumed={onAutoJoinConsumed} onTournamentCreated={onTournamentCreated} />

        <CreateInviteLink profile={profile} />

        {availabilityReminder}

        {/* User Status Block */}
        {renderUserStatusCard('Tournament forming', 'Waiting for more players to join your bracket.', 'Status')}

        {/* Leaderboard Block */}
        {renderLeaderboardTeaser(`Top players in ${profile.county}`, 'Ratings update after each result, even while the bracket is forming.')}

        <BuddiesSection profile={profile} />
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
                onClick={() => {
                  if (card.type === 'message') {
                    setExpandedCardKey(null)
                    setMessagingCardKey(isMessaging ? null : cardKey)
                    return
                  }
                  setMessagingCardKey(null)
                  setExpandedCardKey(isExpanded ? null : cardKey)
                }}
              >
                <div className="action-card-status-row">
                  <div className={`card-status-label card-status-label--${actionCardTone(card.type)}`}>{card.label}</div>
                </div>
                <div className="action-card-main">
                  <div className="action-card-opponent">{card.type === 'message' ? 'From' : 'vs'} {card.opponentName}</div>
                  <div className="action-card-supporting">{card.detail}</div>
                </div>
                <div className="action-card-buttons">
                  {card.type === 'message' ? (
                    <button className="action-card-btn" onClick={e => {
                      e.stopPropagation()
                      setExpandedCardKey(null)
                      setMessagingCardKey(isMessaging ? null : cardKey)
                    }}>
                      Reply
                    </button>
                  ) : card.type === 'confirm-score' ? (
                    <button className="action-card-btn" onClick={e => {
                      e.stopPropagation()
                      setMessagingCardKey(null)
                      setExpandedCardKey(isExpanded ? null : cardKey)
                    }}>
                      Confirm Score
                    </button>
                  ) : !isExpanded ? (
                    <button className="action-card-btn" onClick={e => {
                      e.stopPropagation()
                      setMessagingCardKey(null)
                      setExpandedCardKey(cardKey)
                    }}>
                      {card.type === 'score'
                        ? 'Enter Score'
                        : card.type === 'respond'
                          ? 'Confirm Time'
                          : card.type === 'confirmed'
                            ? 'View Match'
                            : card.type === 'escalated'
                              ? 'Respond Now'
                              : 'Find a Time'}
                    </button>
                  ) : null}
                  {card.type !== 'message' && (
                    <button
                      className={`match-card-msg-btn ${isMessaging ? 'active' : ''}`}
                      onClick={e => {
                        e.stopPropagation()
                        setExpandedCardKey(null)
                        setMessagingCardKey(isMessaging ? null : cardKey)
                      }}
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
                  <div className="action-card-expansion" onClick={e => e.stopPropagation()}>
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
                  <div className="action-card-expansion" onClick={e => e.stopPropagation()}>
                    {card.type === 'confirm-score' ? (
                      <ScoreConfirmationPanel
                        tournament={cardTournament}
                        match={cardMatch}
                        currentPlayerId={profile.id}
                        onUpdated={() => {
                          setExpandedCardKey(null)
                          onDataChanged?.()
                        }}
                      />
                    ) : cardMatch.schedule ? (
                      <UpcomingMatchPanel
                        tournament={cardTournament}
                        match={cardMatch}
                        currentPlayerId={profile.id}
                        mode="schedule"
                        onUpdated={() => {
                          setExpandedCardKey(null)
                          onDataChanged?.()
                        }}
                      />
                    ) : card.type === 'score' ? (
                      <InlineScoreEntry
                        tournament={cardTournament}
                        matchId={cardMatch.id}
                        currentPlayerId={profile.id}
                        onSaved={() => {
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
        const slot = upNext.match.schedule!.confirmedSlot!
        const st = (() => {
          const target = HOME_DAY_MAP[slot.day] ?? 1
          const today = new Date()
          const diff = (target - today.getDay() + 7) % 7
          const date = new Date(today)
          date.setDate(today.getDate() + diff)
          const dayStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
          const period = slot.startHour >= 12 ? 'pm' : 'am'
          const hour = slot.startHour % 12 || 12
          return { day: dayStr, time: `${hour}${period}` }
        })()
        const upNextKey = `${upNext.tournament.id}-${upNext.match.id}`
        const upNextExpanded = expandedCardKey === upNextKey
        return (
          <div
            className="card action-card action-confirmed upnext-card"
            onClick={() => {
              setMessagingCardKey(null)
              setExpandedCardKey(upNextExpanded ? null : upNextKey)
            }}
          >
            <div className="action-card-status-row">
              <div className="card-status-label card-status-label--green">Confirmed</div>
              <div className="card-meta-chip">{`${st.day} ${st.time}`}</div>
            </div>
            <div className="action-card-main">
              <div className="action-card-opponent">
                vs {playerNameWithSeed(upNext.tournament, getOpponentId(upNext.match, profile.id))}
              </div>
              <div className="action-card-supporting">Confirmed and ready to play.</div>
            </div>
            <div className="action-card-buttons">
              <button
                className="action-card-btn"
                onClick={e => {
                  e.stopPropagation()
                  setMessagingCardKey(null)
                  setExpandedCardKey(upNextExpanded ? null : upNextKey)
                }}
              >
                View Match
              </button>
            </div>
            {upNextExpanded && (
              <div className="action-card-expansion" onClick={e => e.stopPropagation()}>
                <UpcomingMatchPanel
                  tournament={upNext.tournament}
                  match={upNext.match}
                  currentPlayerId={profile.id}
                  mode="schedule"
                  onUpdated={() => {
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
      {renderLeaderboardTeaser(`Top players in ${profile.county}`, 'Ratings update after each match.')}

      {/* Tennis Buddies */}
      <BuddiesSection profile={profile} />

      {/* Post-match buddy suggestions */}
      <PostMatchBuddySuggestions tournaments={activeTournaments} profile={profile} />

      {/* View All */}
      <div className="home-view-all">
        <button className="btn-link" onClick={() => onViewTournament(activeTournaments[0].id)}>
          View full bracket and standings
        </button>
      </div>
    </div>
  )
}
