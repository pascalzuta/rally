import { getCountyLeaderboard } from '../store'
import type { LeaderboardEntry } from '../store'

interface Props {
  county: string
  currentPlayerName: string
  onBack: () => void
}

export default function Leaderboard({ county, currentPlayerName, onBack }: Props) {
  const leaderboard = getCountyLeaderboard(county)

  // Find current player's position
  const myIndex = leaderboard.findIndex(e => e.name.toLowerCase() === currentPlayerName.toLowerCase())

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
    return (
      <div key={entry.name} className={`lb-row ${isMe ? 'lb-row-me' : ''}`}>
        <span className="lb-row-rank">#{entry.rank}</span>
        <span className="lb-row-name">{entry.name}</span>
        <span className="lb-row-rating">{Math.round(entry.rating)}</span>
      </div>
    )
  }

  return (
    <div className="leaderboard-screen">
      <header className="lb-header">
        <button className="btn-back" onClick={onBack}>← Back</button>
        <h2 className="lb-title">{county} Leaderboard</h2>
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

      <div className="lb-total">{leaderboard.length} players ranked</div>
    </div>
  )
}
