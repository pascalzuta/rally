import { useMemo, useState } from 'react'
import { titleCase } from '../dateUtils'
import { getPlayerRating, getCountyLeaderboard, getIncomingOffers, getConversationList } from '../store'
import { getMatchCardView } from '../matchCardModel'
import { PlayerProfile, Tournament, Match } from '../types'
import { useStableOrder } from '../useStableOrder'
import HomeHeroCard from './HomeHeroCard'
import FriendTournamentSection from './FriendTournamentSection'
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
  onJoinLobby?: () => void
  onSetAvailability?: () => void
  onFindMatch?: () => void
  onLogout?: () => void
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

// Module-level pin: survives component remounts, resets on page reload
let pinnedUpNextKey: string | null | undefined = undefined // undefined = not yet captured

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
  onJoinLobby,
  onSetAvailability,
  onFindMatch,
  onLogout,
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

  const setupTournaments = useMemo(
    () => tournaments.filter(
      t => t.status === 'setup' && isPlayerInTournament(t, profile.id)
    ),
    [tournaments, profile.id]
  )

  const matchCardsRaw = useMemo(
    () => buildHomeMatchCards(activeTournaments, profile.id),
    [activeTournaments, profile.id]
  )

  const matchCards = useStableOrder(
    matchCardsRaw,
    card => `${card.tournament.id}-${card.match.id}`,
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
    if (pinnedUpNextKey === null) return null
    // Keep using the originally pinned upNext card
    const match = activeTournaments
      .flatMap(t => t.matches.map(m => ({ tournament: t, match: m })))
      .find(({ tournament, match }) => `${tournament.id}-${match.id}` === pinnedUpNextKey)
    return match ?? null
  }, [latestUpNext, activeTournaments])

  const actionCards = useMemo(
    () => matchCards.filter(card => !(upNext && card.tournament.id === upNext.tournament.id && card.match.id === upNext.match.id)),
    [matchCards, upNext]
  )

  const messageCards = useMemo(
    () => buildMessageCards(activeTournaments, profile.id, matchCards),
    [activeTournaments, profile.id, matchCards]
  )

  // Leaderboard teaser
  const leaderboard = useMemo(() => getCountyLeaderboard(profile.county), [profile.county, tournaments])
  const topPlayers = leaderboard.slice(0, 3)

  const myLeaderboardEntry = leaderboard.find(
    e => e.name.toLowerCase() === profile.name.toLowerCase()
  )
  const myRating = getPlayerRating(profile.id, profile.name)

  const renderLeaderboardTeaser = (title: string, supporting: string) => {
    if (topPlayers.length <= 1) return null
    return (
      <div className="card leaderboard-teaser" onClick={onViewLeaderboard}>
        <div className="card-status-row">
          <div className="card-status-label card-status-label--blue">Leaderboard</div>
          <div className="card-meta-chip">{titleCase(profile.county)}</div>
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

  // Unified hero card for all states
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
        actionCardCount={actionCards.length + messageCards.length}
      />

      {/* Leaderboard (pre-tournament states) */}
      {activeTournaments.length === 0 && renderLeaderboardTeaser(
        `Top players in ${titleCase(profile.county)}`,
        setupTournaments.length > 0
          ? 'Ratings update after each result, even while the bracket is forming.'
          : 'See where you stand before your next tournament.'
      )}

      {/* === Active tournament content below the hero card === */}
      {activeTournaments.length === 0 ? null : (
        <>

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
      {(actionCards.length > 0 || messageCards.length > 0) && (
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
      {renderLeaderboardTeaser(`Top players in ${titleCase(profile.county)}`, 'Ratings update after each match.')}

      {/* View All */}
      <div className="home-view-all">
        <button className="btn-link" onClick={() => onViewTournament(activeTournaments[0].id)}>
          View full bracket and standings
        </button>
      </div>
        </>
      )}

      <button className="btn btn-large logout-btn" onClick={handleLogout}>Sign Out</button>
    </div>
  )
}
