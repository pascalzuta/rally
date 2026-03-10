import { useState } from 'react'
import { saveMatchScore, getPlayerName, getPlayerRating, winProbability } from '../store'
import { Tournament } from '../types'

interface Props {
  tournament: Tournament
  matchId: string
  onClose: () => void
  onSaved: () => void
}

function isValidSet(s1: number, s2: number): boolean {
  // Standard set: one player reaches 6 with 2+ game lead
  if (s1 === 6 && s2 <= 4) return true
  if (s2 === 6 && s1 <= 4) return true
  // 7-5 is valid
  if (s1 === 7 && s2 === 5) return true
  if (s2 === 7 && s1 === 5) return true
  // Tiebreak: 7-6
  if (s1 === 7 && s2 === 6) return true
  if (s2 === 7 && s1 === 6) return true
  return false
}

export default function MatchScoreModal({ tournament, matchId, onClose, onSaved }: Props) {
  const match = tournament.matches.find(m => m.id === matchId)!
  const p1Name = getPlayerName(tournament, match.player1Id)
  const p2Name = getPlayerName(tournament, match.player2Id)

  const r1 = getPlayerRating(p1Name)
  const r2 = getPlayerRating(p2Name)
  const p1WinProb = winProbability(r1.rating, r2.rating)

  const [sets, setSets] = useState<Array<[string, string]>>([['', ''], ['', ''], ['', '']])

  function getScores(): { score1: number[]; score2: number[] } | null {
    const score1: number[] = []
    const score2: number[] = []

    for (const [s1, s2] of sets) {
      if (s1 === '' && s2 === '') continue
      const n1 = parseInt(s1, 10)
      const n2 = parseInt(s2, 10)
      if (isNaN(n1) || isNaN(n2) || n1 < 0 || n2 < 0) return null
      if (!isValidSet(n1, n2)) return null
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
    if (sets1 >= 2) return match.player1Id
    if (sets2 >= 2) return match.player2Id
    // Need more sets to determine winner
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

  // Determine which sets to show: always show 2, show 3rd if split 1-1
  // Use raw input values from sets 1 & 2 only, so typing in set 3 doesn't cause it to vanish
  const showThirdSet = (() => {
    const s1a = parseInt(sets[0][0], 10)
    const s1b = parseInt(sets[0][1], 10)
    const s2a = parseInt(sets[1][0], 10)
    const s2b = parseInt(sets[1][1], 10)
    if (isNaN(s1a) || isNaN(s1b) || isNaN(s2a) || isNaN(s2b)) return false
    if (!isValidSet(s1a, s1b) || !isValidSet(s2a, s2b)) return false
    const set1Winner = s1a > s1b ? 1 : 2
    const set2Winner = s2a > s2b ? 1 : 2
    return set1Winner !== set2Winner
  })()

  // Check which individual sets have invalid scores for feedback
  function setValidation(setIndex: number): string | null {
    const [s1, s2] = sets[setIndex]
    if (s1 === '' && s2 === '') return null
    if (s1 === '' || s2 === '') return 'Enter both scores'
    const n1 = parseInt(s1, 10)
    const n2 = parseInt(s2, 10)
    if (isNaN(n1) || isNaN(n2)) return 'Invalid number'
    if (!isValidSet(n1, n2)) return 'Invalid score (e.g. 6-4, 7-5, 7-6)'
    return null
  }

  const visibleSets = showThirdSet ? 3 : 2

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

        <div className="score-grid" style={{ gridTemplateColumns: `1fr repeat(${visibleSets}, 60px)` }}>
          <div className="score-header"></div>
          {sets.slice(0, visibleSets).map((_, i) => (
            <div key={i} className="score-header">Set {i + 1}</div>
          ))}

          <div className="score-player-name">{p1Name}</div>
          {sets.slice(0, visibleSets).map((set, i) => (
            <input
              key={`p1-${i}`}
              type="number"
              min="0"
              max="7"
              className={`score-input ${setValidation(i) ? 'score-invalid' : ''}`}
              value={set[0]}
              onChange={e => updateSet(i, 0, e.target.value)}
              inputMode="numeric"
            />
          ))}

          <div className="score-player-name">{p2Name}</div>
          {sets.slice(0, visibleSets).map((set, i) => (
            <input
              key={`p2-${i}`}
              type="number"
              min="0"
              max="7"
              className={`score-input ${setValidation(i) ? 'score-invalid' : ''}`}
              value={set[1]}
              onChange={e => updateSet(i, 1, e.target.value)}
              inputMode="numeric"
            />
          ))}
        </div>

        {sets.slice(0, visibleSets).map((_, i) => {
          const err = setValidation(i)
          return err ? <div key={i} className="score-error">Set {i + 1}: {err}</div> : null
        })}

        {!showThirdSet && setsWon1 === 1 && setsWon2 === 0 && scores && scores.score1.length === 1 && (
          <p className="subtle" style={{ textAlign: 'center', marginTop: '0.5rem' }}>Enter Set 2 to continue</p>
        )}

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
