import { Tournament } from '../types'

interface Props {
  tournament: Tournament
}

interface PlayerStats {
  id: string
  name: string
  wins: number
  losses: number
  setsWon: number
  setsLost: number
  gamesWon: number
  gamesLost: number
}

export default function Standings({ tournament }: Props) {
  const stats: PlayerStats[] = tournament.players.map(p => ({
    id: p.id, name: p.name, wins: 0, losses: 0,
    setsWon: 0, setsLost: 0, gamesWon: 0, gamesLost: 0,
  }))

  const relevantMatches = tournament.matches.filter(m => m.phase === 'group' || !m.phase)

  for (const match of relevantMatches) {
    if (!match.completed) continue
    const s1 = stats.find(s => s.id === match.player1Id)
    const s2 = stats.find(s => s.id === match.player2Id)
    if (!s1 || !s2) continue

    if (match.winnerId === match.player1Id) { s1.wins++; s2.losses++ }
    else { s2.wins++; s1.losses++ }

    for (let i = 0; i < match.score1.length; i++) {
      s1.gamesWon += match.score1[i]; s1.gamesLost += match.score2[i]
      s2.gamesWon += match.score2[i]; s2.gamesLost += match.score1[i]
      if (match.score1[i] > match.score2[i]) { s1.setsWon++; s2.setsLost++ }
      else { s2.setsWon++; s1.setsLost++ }
    }
  }

  stats.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins
    const aSetDiff = a.setsWon - a.setsLost
    const bSetDiff = b.setsWon - b.setsLost
    if (bSetDiff !== aSetDiff) return bSetDiff - aSetDiff
    return (b.gamesWon - b.gamesLost) - (a.gamesWon - a.gamesLost)
  })

  const totalMatches = (s: PlayerStats) => s.wins + s.losses
  const winPct = (s: PlayerStats) => totalMatches(s) > 0 ? Math.round((s.wins / totalMatches(s)) * 100) : 0

  return (
    <div className="standings">
      <div className="schedule-week-header">Standings</div>
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Player</th>
            <th>W-L</th>
            <th>Win %</th>
            <th>Sets</th>
            <th>+/-</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s, i) => (
            <tr key={s.id}>
              <td className="rank">{i + 1}</td>
              <td className="player-cell">{s.name}</td>
              <td className="stat-cell">{s.wins}-{s.losses}</td>
              <td className="stat-cell">
                <div className="standings-win-bar-container">
                  <div className="standings-win-bar" style={{ width: `${winPct(s)}%` }} />
                  <span className="standings-win-pct">{winPct(s)}%</span>
                </div>
              </td>
              <td className="stat-cell">{s.setsWon}-{s.setsLost}</td>
              <td className={`stat-cell ${(s.setsWon - s.setsLost) >= 0 ? 'stat-positive' : 'stat-negative'}`}>
                {(s.setsWon - s.setsLost) >= 0 ? '+' : ''}{s.setsWon - s.setsLost}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
