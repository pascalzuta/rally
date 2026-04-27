import { getCountyLeaderboard, isDefendingChampion, getRecentResults } from '../store'
import type { LeaderboardEntry } from '../store'

interface Props {
  county: string
  currentPlayerId: string
  currentPlayerName: string
  onBack: () => void
}

export default function Leaderboard({ county, currentPlayerId, currentPlayerName, onBack }: Props) {
  const leaderboard = getCountyLeaderboard(county)
  const recentResults = getRecentResults(county, 5)

  // Find current player's position
  const myIndex = leaderboard.findIndex(e => e.name.toLowerCase() === currentPlayerName.toLowerCase())
  const myEntry = myIndex >= 0 ? leaderboard[myIndex] : null

  // Show players near the current user (context window)
  // Always show top 3 + players around current user
  const showAll = leaderboard.length <= 10

  let nearbyStart = 0
  let nearbyEnd = leaderboard.length
  if (!showAll && myIndex > 5) {
    nearbyStart = myIndex - 2
    nearbyEnd = Math.min(myIndex + 3, leaderboard.length)
  }

  function renderRow(entry: LeaderboardEntry) {
    const isMe = entry.name.toLowerCase() === currentPlayerName.toLowerCase()
    const initial = entry.name[0].toUpperCase()
    const record = entry.wins + entry.losses > 0 ? `${entry.wins}W–${entry.losses}L` : ''
    const champion = isDefendingChampion(entry.name, county)
    return (
      <div key={entry.name} className={`lb-row ${isMe ? 'lb-row-me' : ''}`}>
        <span className="lb-row-rank">{entry.rank === 1 ? '🥇' : `#${entry.rank}`}</span>
        <span className={`lb-row-avatar ${isMe ? 'lb-avatar-me' : ''}`}>{initial}</span>
        <span className="lb-row-info">
          <span className="lb-row-name">
            {entry.name}
            {champion && <span className="lb-champion-badge" title="Won the last tournament">🏆</span>}
          </span>
          {record && <span className="lb-row-record">{record}</span>}
        </span>
        <span className="lb-row-rating">{Math.round(entry.rating)}</span>
      </div>
    )
  }

  return (
    <div className="leaderboard-screen">
      <header className="lb-header">
        <button className="btn-back" onClick={onBack}>← Back</button>
        <h2 className="lb-title"><em className="bg-em">Leaderboard</em></h2>
      </header>

      <div className="lb-list">
        {showAll ? (
          leaderboard.map(renderRow)
        ) : (
          <>
            {/* Top 3 */}
            {leaderboard.slice(0, 3).map(renderRow)}

            {/* Gap indicator if needed */}
            {nearbyStart > 3 && (
              <div className="lb-gap">···</div>
            )}

            {/* Players near current user */}
            {nearbyStart > 3 && leaderboard.slice(nearbyStart, nearbyEnd).map(renderRow)}

            {/* Bottom gap */}
            {nearbyEnd < leaderboard.length && (
              <div className="lb-gap">···</div>
            )}
          </>
        )}
      </div>

      <div className="lb-total">
        {myEntry
          ? `Rank #${myEntry.rank} of ${leaderboard.length} players`
          : `${leaderboard.length} players ranked`
        }
      </div>

      {recentResults.length > 0 && (
        <div className="card recent-activity" style={{ marginTop: '16px' }}>
          <div className="card-status-row">
            <div className="card-status-label card-status-label--slate">Recent Matches</div>
          </div>
          <div className="recent-results-list">
            {recentResults.map(result => (
              <div key={result.matchId} className="recent-result-item">
                <div className="recent-result-players">
                  <span className={`recent-result-name ${result.winnerId === currentPlayerId ? 'is-me' : ''}`}>{result.winnerName}</span>
                  <span className="recent-result-def">def.</span>
                  <span className={`recent-result-name ${result.loserId === currentPlayerId ? 'is-me' : ''}`}>{result.loserName}</span>
                </div>
                <div className="recent-result-score">{result.score}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
