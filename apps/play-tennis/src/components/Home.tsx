import { useMemo, useState } from 'react'
import { getPlayerRating, getCountyLeaderboard } from '../store'
import { PlayerProfile, Tournament, Match } from '../types'
import HomeHeroCard from './HomeHeroCard'
import FriendTournamentSection from './FriendTournamentSection'
import MatchActionCard from './MatchActionCard'
import NeedsYouBlock from './NeedsYouBlock'
import ScoreConfirmBanner from './ScoreConfirmBanner'
import { usePendingActions } from '../hooks/usePendingActions'

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
  onJoinLobby?: () => void
  onSetAvailability?: () => void
  onFindMatch?: () => void
  onLogout?: () => void
  onGoToBracket?: (focusMatchId?: string) => void
  onOpenMessages?: () => void
}

// Module-level pin: survives component remounts, resets on page reload.
// Keeps Up Next stable across action re-renders.
let pinnedUpNextKey: string | null | undefined = undefined // undefined = not yet captured

function isPlayerInTournament(tournament: Tournament, playerId: string): boolean {
  return tournament.players.some(p => p.id === playerId)
}

function isMyMatch(match: Match, playerId: string): boolean {
  return match.player1Id === playerId || match.player2Id === playerId
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
  onDataChanged,
  onJoinLobby,
  onSetAvailability,
  onFindMatch,
  onLogout,
  onViewLeaderboard,
  onGoToBracket,
  onOpenMessages,
}: Props) {
  const [expandedCardKey, setExpandedCardKey] = useState<string | null>(null)
  const [messagingCardKey, setMessagingCardKey] = useState<string | null>(null)

  async function handleLogout() {
    onLogout?.()
  }

  const activeTournaments = useMemo(
    () => tournaments.filter(
      t => t.status === 'in-progress' && isPlayerInTournament(t, profile.id)
    ),
    [tournaments, profile.id]
  )

  const latestUpNext = useMemo(
    () => getUpNextMatch(activeTournaments, profile.id),
    [activeTournaments, profile.id]
  )

  // Pin which card is upNext so cards don't jump between sections after an action
  const upNext = useMemo(() => {
    if (pinnedUpNextKey === undefined) {
      pinnedUpNextKey = latestUpNext ? `${latestUpNext.tournament.id}-${latestUpNext.match.id}` : null
      return latestUpNext
    }
    if (pinnedUpNextKey === null) {
      if (latestUpNext) {
        pinnedUpNextKey = `${latestUpNext.tournament.id}-${latestUpNext.match.id}`
        return latestUpNext
      }
      return null
    }
    const match = activeTournaments
      .flatMap(t => t.matches.map(m => ({ tournament: t, match: m })))
      .find(({ tournament, match }) => `${tournament.id}-${match.id}` === pinnedUpNextKey)
    if (!match) {
      pinnedUpNextKey = latestUpNext ? `${latestUpNext.tournament.id}-${latestUpNext.match.id}` : null
      return latestUpNext
    }
    return match
  }, [latestUpNext, activeTournaments])

  // Pending actions: summary only. Substance (match cards, feedback forms, etc.)
  // lives on Tournament/Messages tabs. Home surfaces COUNTS and URGENCY.
  const pendingActions = usePendingActions(profile.id)

  // Tournament callback: scroll-focus a match if provided, else just go to tab
  const goToBracket = (focusMatchId?: string) => {
    onGoToBracket?.(focusMatchId)
  }
  const openMessages = () => {
    onOpenMessages?.()
  }

  // Leaderboard teaser
  const leaderboard = useMemo(() => getCountyLeaderboard(profile.county), [profile.county, tournaments])
  const topPlayers = leaderboard.slice(0, 3)

  const myLeaderboardEntry = leaderboard.find(
    e => e.name.toLowerCase() === profile.name.toLowerCase()
  )
  const myRating = getPlayerRating(profile.id, profile.name)

  const renderLeaderboardTeaser = (_title: string, supporting: string) => {
    if (topPlayers.length <= 1) return null
    return (
      <div className="card leaderboard-teaser" onClick={onViewLeaderboard}>
        <div className="card-status-row">
          <h2 className="lb-title"><em className="bg-em">Leaderboard</em></h2>
        </div>
        <div className="card-supporting" style={{ marginBottom: 'var(--space-md)' }}>{supporting}</div>
        <div className="lb-list">
          {topPlayers.map(entry => {
            const isMe = entry.name.toLowerCase() === profile.name.toLowerCase()
            const record = entry.wins + entry.losses > 0 ? `${entry.wins}W–${entry.losses}L` : ''
            return (
              <div key={entry.name} className={`lb-row ${isMe ? 'lb-row-me' : ''}`}>
                <span className="lb-row-rank">{entry.rank === 1 ? '🥇' : `#${entry.rank}`}</span>
                <span className={`lb-row-avatar ${isMe ? 'lb-avatar-me' : ''}`}>{entry.name[0].toUpperCase()}</span>
                <span className="lb-row-info">
                  <span className="lb-row-name">{entry.name}{isMe ? ' (You)' : ''}</span>
                  {record && <span className="lb-row-record">{record}</span>}
                </span>
                <span className="lb-row-rating">{Math.round(entry.rating)}</span>
              </div>
            )
          })}
          {myLeaderboardEntry && !topPlayers.some(e => e.name.toLowerCase() === profile.name.toLowerCase()) && (
            <>
              <div className="lb-gap">···</div>
              <div className="lb-row lb-row-me">
                <span className="lb-row-rank">#{myLeaderboardEntry.rank}</span>
                <span className="lb-row-avatar lb-avatar-me">{profile.name[0].toUpperCase()}</span>
                <span className="lb-row-info"><span className="lb-row-name">You</span></span>
                <span className="lb-row-rating">{Math.round(myLeaderboardEntry.rating)}</span>
              </div>
            </>
          )}
          {!myLeaderboardEntry && (
            <>
              <div className="lb-gap">···</div>
              <div className="lb-row lb-row-me">
                <span className="lb-row-rank">—</span>
                <span className="lb-row-avatar lb-avatar-me">{profile.name[0].toUpperCase()}</span>
                <span className="lb-row-info"><span className="lb-row-name">You</span></span>
                <span className="lb-row-rating">{Math.round(myRating.rating)}</span>
              </div>
            </>
          )}
        </div>
        <button className="btn-link leaderboard-see-all" style={{ marginTop: 'var(--space-md)' }}>See full leaderboard →</button>
      </div>
    )
  }

  return (
    <div className="home-section home-section-spaced">
      <FriendTournamentSection
        profile={profile}
        tournaments={tournaments}
        onDataChanged={onDataChanged}
        onViewTournament={onViewTournament}
      />

      <HomeHeroCard
        profile={profile}
        tournaments={tournaments}
        autoJoin={autoJoin}
        onAutoJoinConsumed={onAutoJoinConsumed}
        onTournamentCreated={onTournamentCreated}
        onSetAvailability={onSetAvailability}
        onJoinLobby={onJoinLobby}
        onFindMatch={onFindMatch}
        actionCardCount={pendingActions.bracketBadgeCount}
      />

      {/* Urgency banner for <6h score-confirms — defense in depth for the
          48h window. Intentionally redundant with Needs You row. */}
      <ScoreConfirmBanner actions={pendingActions} onGoToBracket={goToBracket} />

      {/* Leaderboard (pre-tournament states) */}
      {activeTournaments.length === 0 && renderLeaderboardTeaser(
        '',
        'See where you stand before your next tournament.'
      )}

      {/* Score-confirm override: even when there's no active tournament,
          a pending confirmation must surface. NeedsYouBlock handles the
          hide-when-empty logic itself. */}
      {(activeTournaments.length > 0 || pendingActions.scoreConfirmPending.length > 0) && (
        <>
          {/* Up Next — the one match that earns its pixels on Home */}
          {upNext && (() => {
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
                onUpdated={() => onDataChanged?.()}
              />
            )
          })()}

          {/* Needs You — summary of pending actions across tabs */}
          <NeedsYouBlock
            actions={pendingActions}
            onGoToBracket={goToBracket}
            onOpenMessages={openMessages}
          />

          {activeTournaments.length > 0 && renderLeaderboardTeaser(
            '',
            'Ratings update after each match.'
          )}

          {activeTournaments.length > 0 && (
            <div className="home-view-all">
              <button className="btn-link" onClick={() => onViewTournament(activeTournaments[0].id)}>
                View full bracket and standings
              </button>
            </div>
          )}
        </>
      )}

      <button className="btn btn-large logout-btn" onClick={handleLogout}>Sign Out</button>
    </div>
  )
}
