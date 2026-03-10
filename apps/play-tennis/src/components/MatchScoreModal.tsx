import { useState } from 'react'
import { saveMatchScore, getPlayerName, getPlayerRating, winProbability } from '../store'
import { Tournament } from '../types'

interface Props {
  tournament: Tournament
  matchId: string
  onClose: () => void
  onSaved: () => void
}

export default function MatchScoreModal({ tournament, matchId, onClose, onSaved }: Props) {
  const match = tournament.matches.find(m => m.id === matchId)!
  const p1Name = getPlayerName(tournament, match.player1Id)
  const p2Name = getPlayerName(tournament, match.player2Id)

  const r1 = getPlayerRating(p1Name)
  const r2 = getPlayerRating(p2Name)
  const p1WinProb = winProbability(r1.rating, r2.rating)

  const [sets, setSets] = useState<Array<[string, string]>>([['', ''], ['', '']])

  function getScores(): { score1: number[]; score2: number[] } | null {
    const score1: number[] = []
    const score2: number[] = []

    for (const [s1, s2] of sets) {
      if (s1 === '' && s2 === '') continue
      const n1 = parseInt(s1, 10)
      const n2 = parseInt(s2, 10)
      if (isNaN(n1) || isNaN(n2) || n1 < 0 || n2 < 0) return null
      score1.push(n1)
      score2.push(n2)
    }

    return score1.length > 0 ? { score1, score2 } : null
  }

  function determineWinner(score1: number[], score2: number[]): string | null {
    let sets1 = 0
    let sets2 = 0
    for (let i = 0; i < score1.length; i++) {
      if (score1[i] > score2[i]) sets1++
      else if (score2[i] > score1[i]) sets2++
    }
    if (sets1 > sets2) return match.player1Id
    if (sets2 > sets1) return match.player2Id
    return null
  }

  function handleSave() {
    const scores = getScores()
    if (!scores) return

    const winnerId = determineWinner(scores.score1, scores.score2)
    if (!winnerId) return

    saveMatchScore(tournament.id, matchId, scores.score1, scores.score2, winnerId)
    onSaved()
  }

  function updateSet(setIndex: number, playerIndex: 0 | 1, value: string) {
    const updated = [...sets] as Array<[string, string]>
    updated[setIndex] = [...updated[setIndex]] as [string, string]
    updated[setIndex][playerIndex] = value
    setSets(updated)
  }

  const scores = getScores()
  const winnerId = scores ? determineWinner(scores.score1, scores.score2) : null
  const canSave = scores && winnerId

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Enter Score</h2>

        <div className="win-probability">
          <div className="prob-bar">
            <div className="prob-fill" style={{ width: `${Math.round(p1WinProb * 100)}%` }} />
          </div>
          <div className="prob-labels">
            <span>{p1Name} {Math.round(p1WinProb * 100)}%</span>
            <span>{Math.round((1 - p1WinProb) * 100)}% {p2Name}</span>
          </div>
        </div>

        <div className="score-grid">
          <div className="score-header"></div>
          {sets.map((_, i) => (
            <div key={i} className="score-header">Set {i + 1}</div>
          ))}

          <div className="score-player-name">{p1Name}</div>
          {sets.map((set, i) => (
            <input
              key={`p1-${i}`}
              type="number"
              min="0"
              max="7"
              className="score-input"
              value={set[0]}
              onChange={e => updateSet(i, 0, e.target.value)}
              inputMode="numeric"
            />
          ))}

          <div className="score-player-name">{p2Name}</div>
          {sets.map((set, i) => (
            <input
              key={`p2-${i}`}
              type="number"
              min="0"
              max="7"
              className="score-input"
              value={set[1]}
              onChange={e => updateSet(i, 1, e.target.value)}
              inputMode="numeric"
            />
          ))}
        </div>

        {winnerId && (
          <div className="winner-preview">
            Winner: <strong>{getPlayerName(tournament, winnerId)}</strong>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!canSave}>
            Save Score
          </button>
        </div>
      </div>
    </div>
  )
}
