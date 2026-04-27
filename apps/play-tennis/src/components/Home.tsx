import { useMemo, useState } from 'react'
import { getPlayerRating, getCountyLeaderboard, getIncomingOffers, getConversationList, getPendingFeedback, clearPendingFeedback, getPlayerName } from '../store'
import { getMatchCardView } from '../matchCardModel'
import { PlayerProfile, Tournament, Match } from '../types'
import { useStableOrder } from '../useStableOrder'
import HomeHeroCard from './HomeHeroCard'
import FriendTournamentSection from './FriendTournamentSection'
import MessagePanel from './MessagePanel'
import MatchActionCard from './MatchActionCard'
import PostMatchFeedbackInline from './PostMatchFeedbackInline'

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
  const pendingFeedback = getPendingFeedback()

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
    if (pinnedUpNextKey === null) {
      // Re-check: a new match may have become available (new tournament, etc.)
      if (latestUpNext) {
        pinnedUpNextKey = `${latestUpNext.tournament.id}-${latestUpNext.match.id}`
        return latestUpNext
      }
      return null
    }
    // Keep using the originally pinned upNext card
    const match = activeTournaments
      .flatMap(t => t.matches.map(m => ({ tournament: t, match: m })))
      .find(({ tournament, match }) => `${tournament.id}-${match.id}` === pinnedUpNextKey)
    if (!match) {
      // Pinned match gone (completed, tournament ended). Reset and pick next available.
      pinnedUpNextKey = latestUpNext ? `${latestUpNext.tournament.id}-${latestUpNext.match.id}` : null
      return latestUpNext
    }
    return match
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
        '',
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
          {actionCards.map((card, i) => {
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
                style={{'--i': i} as React.CSSProperties}
                onToggleExpanded={() => {
                  setMessagingCardKey(null)
                  setExpandedCardKey(isExpanded ? null : cardKey)
                }}
                onToggleMessaging={() => {
                  setExpandedCardKey(null)
                  setMessagingCardKey(isMessaging ? null : cardKey)
                }}
                onUpdated={() => onDataChanged?.()}
              />
            )
          })}
          {messageCards.map((card, i) => {
            const cardKey = `message-${card.opponentId}`
            const isMessaging = messagingCardKey === cardKey
            return (
              <div
                key={cardKey}
                className="action-card action-message"
                style={{'--i': actionCards.length + i} as React.CSSProperties}
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

      {/* Post-match feedback — takes priority over Up Next card */}
      {(() => {
        const pf = pendingFeedback
        if (!pf) return null
        const fbTournament = activeTournaments.find(t => t.id === pf.tournamentId)
        if (!fbTournament) return null
        const fbMatch = fbTournament.matches.find(m => m.id === pf.matchId)
        if (!fbMatch || !fbMatch.player1Id || !fbMatch.player2Id) return null
        const opponentId = fbMatch.player1Id === profile.id ? fbMatch.player2Id : fbMatch.player1Id
        const opponentName = getPlayerName(fbTournament, opponentId)
        const isPlayer2 = fbMatch.player2Id === profile.id
        const myScores = isPlayer2 ? fbMatch.score2 : fbMatch.score1
        const oppScores = isPlayer2 ? fbMatch.score1 : fbMatch.score2
        const score = myScores?.length > 0
          ? myScores.map((s: number, i: number) => `${s}-${oppScores[i]}`).join(', ')
          : null
        return (
          <div className="card action-card action-completed upnext-card">
            <div className="action-card-status-row">
              <div className="card-status-label card-status-label--green">Score Reported</div>
            </div>
            <div className="action-card-main">
              <div className="action-card-opponent">vs {opponentName}</div>
              {score && <div className="action-card-supporting">{score}</div>}
            </div>
            <div className="action-card-expansion">
              <div className="schedule-panel-copy">Score reported. Your opponent has 48 hours to confirm.</div>
              <PostMatchFeedbackInline
                matchId={pf.matchId}
                tournamentId={fbTournament.id}
                playerId={profile.id}
                opponentId={opponentId}
                opponentName={opponentName}
                onDone={() => {
                  clearPendingFeedback()
                  onDataChanged?.()
                }}
              />
            </div>
          </div>
        )
      })()}

      {/* Up Next Card — hidden when pending feedback is showing */}
      {!pendingFeedback && upNext && (() => {
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

      {/* Leaderboard Teaser */}
      {renderLeaderboardTeaser('', 'Ratings update after each match.')}

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
