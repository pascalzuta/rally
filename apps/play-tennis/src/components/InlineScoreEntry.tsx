import { useState, useRef } from 'react'
import { saveMatchScore, getPlayerName, getPlayerRating, getSeeds, winProbability } from '../store'
import { Tournament } from '../types'
import { useToast } from './Toast'

function isValidSet(s1: number, s2: number): boolean {
  if (s1 === 6 && s2 <= 4) return true
  if (s2 === 6 && s1 <= 4) return true
  if (s1 === 7 && s2 === 5) return true
  if (s2 === 7 && s1 === 5) return true
  if (s1 === 7 && s2 === 6) return true
  if (s2 === 7 && s1 === 6) return true
  return false
}

interface Props {
  tournament: Tournament
  matchId: string
  onSaved: () => void
}

export default function InlineScoreEntry({ tournament, matchId, onSaved }: Props) {
  const { showSuccess, showError } = useToast()
  const match = tournament.matches.find(m => m.id === matchId)!
  const p1Name = getPlayerName(tournament, match.player1Id)
  const p2Name = getPlayerName(tournament, match.player2Id)
  const seeds = getSeeds(tournament)
  const seed1 = match.player1Id ? seeds.get(match.player1Id) : null
  const seed2 = match.player2Id ? seeds.get(match.player2Id) : null

  const r1 = getPlayerRating(match.player1Id!, p1Name)
  const r2 = getPlayerRating(match.player2Id!, p2Name)
  const p1WinProb = winProbability(r1.rating, r2.rating)

  const [sets, setSets] = useState<Array<[string, string]>>([['', ''], ['', ''], ['', '']])
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

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
    return null
  }

  function updateSet(setIndex: number, playerIndex: 0 | 1, value: string) {
    const updated = [...sets] as Array<[string, string]>
    updated[setIndex] = [...updated[setIndex]] as [string, string]
    updated[setIndex][playerIndex] = value
    setSets(updated)

    if (value.length === 1) {
      const currentIdx = setIndex * 2 + playerIndex
      const nextRef = inputRefs.current[currentIdx + 1]
      if (nextRef) {
        nextRef.focus()
        nextRef.select()
      }
    }
  }

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

  const scores = getScores()
  const winnerId = scores ? determineWinner(scores.score1, scores.score2) : null
  const canSave = scores && winnerId

  const showThirdSet = (() => {
    const s1a = parseInt(sets[0][0], 10)
    const s1b = parseInt(sets[0][1], 10)
    const s2a = parseInt(sets[1][0], 10)
    const s2b = parseInt(sets[1][1], 10)
    if (isNaN(s1a) || isNaN(s1b) || isNaN(s2a) || isNaN(s2b)) return false
    if (!isValidSet(s1a, s1b) || !isValidSet(s2a, s2b)) return false
    return (s1a > s1b ? 1 : 2) !== (s2a > s2b ? 1 : 2)
  })()

  const visibleSets = showThirdSet ? 3 : 2

  // R-07: Confirmation + R-16: Success feedback state machine
  const [saveState, setSaveState] = useState<'idle' | 'confirming' | 'saving' | 'success' | 'error'>('idle')

  function handleSaveClick() {
    if (!scores || !winnerId) return
    setSaveState('confirming')
  }

  async function handleConfirm() {
    if (!scores || !winnerId) return
    setSaveState('saving')
    try {
      await saveMatchScore(tournament.id, matchId, scores.score1, scores.score2, winnerId)
      setSaveState('success')
      showSuccess('Score saved!')
      setTimeout(() => onSaved(), 2000)
    } catch {
      setSaveState('error')
      showError('Failed to save score')
    }
  }

  // R-16: Success toast
  if (saveState === 'success') {
    return (
      <div className="score-toast score-toast--success">
        <span className="score-toast-check">✓</span>
        <strong>Score saved!</strong>
        <div style={{ fontSize: '13px', marginTop: '4px', opacity: 0.8 }}>
          Your opponent has 48 hours to confirm.
        </div>
      </div>
    )
  }

  if (saveState === 'error') {
    return (
      <div className="score-toast score-toast--error">
        <strong>Failed to save score</strong>
        <div style={{ marginTop: '8px' }}>
          <button className="btn" onClick={() => setSaveState('idle')}>Try Again</button>
        </div>
      </div>
    )
  }

  // R-07: Confirmation step
  if (saveState === 'confirming' && scores && winnerId) {
    const scoreSummary = scores.score1.map((s, i) => `${s}-${scores.score2[i]}`).join(', ')
    return (
      <div className="score-confirm-overlay">
        <div className="score-confirm-summary">You entered: {scoreSummary}</div>
        <div className="score-confirm-winner">Winner: {getPlayerName(tournament, winnerId)}</div>
        <div className="score-confirm-actions">
          <button className="btn" onClick={() => setSaveState('idle')}>Edit</button>
          <button className="btn btn-primary" onClick={handleConfirm}>
            Confirm
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="inline-score-entry">
      <div className="prob-split">
        <span className="prob-split-label prob-split-p1">{Math.round(p1WinProb * 100)}%</span>
        <div className="prob-split-bar">
          <div className="prob-split-fill-left" style={{ width: `${Math.round(p1WinProb * 100)}%` }} />
          <div className="prob-split-fill-right" style={{ width: `${Math.round((1 - p1WinProb) * 100)}%` }} />
        </div>
        <span className="prob-split-label prob-split-p2">{Math.round((1 - p1WinProb) * 100)}%</span>
      </div>

      {/* R-26: Player labels with You/Opponent distinction */}
      <div className="score-grid" style={{ gridTemplateColumns: `1fr repeat(${visibleSets}, 60px)` }}>
        <div className="score-header"></div>
        {sets.slice(0, visibleSets).map((_, i) => (
          <div key={i} className="score-header">Set {i + 1}</div>
        ))}

        <div className="score-player-name score-row-label score-row-label--you">You ({p1Name})</div>
        {sets.slice(0, visibleSets).map((set, i) => (
          <input
            key={`p1-${i}`}
            ref={el => { inputRefs.current[i * 2] = el }}
            type="number"
            min="0"
            max="7"
            className={`score-input ${setValidation(i) ? 'score-invalid' : ''}`}
            value={set[0]}
            onChange={e => updateSet(i, 0, e.target.value)}
            inputMode="numeric"
          />
        ))}

        <div className="score-player-name score-row-label score-row-label--opponent">{p2Name}</div>
        {sets.slice(0, visibleSets).map((set, i) => (
          <input
            key={`p2-${i}`}
            ref={el => { inputRefs.current[i * 2 + 1] = el }}
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

      {winnerId && (
        <div className="winner-preview">
          Winner: <strong>{getPlayerName(tournament, winnerId)}</strong>
        </div>
      )}

      <button className="btn btn-primary" onClick={handleSaveClick} disabled={!canSave} style={{ width: '100%', marginTop: '0.5rem' }}>
        Save Score
      </button>
    </div>
  )
}
