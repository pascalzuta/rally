import { useState, useCallback } from 'react'
import { saveMatchScore, getPlayerName, getPlayerRating, getSeeds, winProbability, formatMatchScore, MatchResult } from '../store'
import { Tournament } from '../types'
import { SetScores, getScores, determineWinnerIndex, setValidation, shouldShowThirdSet } from '../score-utils'

interface Props {
  tournament: Tournament
  matchId: string
  onClose: () => void
  onSaved: (result?: MatchResult) => void
}

// Total cells: 2 players × 3 sets = 6 cells
// Layout: [p1-set1, p2-set1, p1-set2, p2-set2, p1-set3, p2-set3]
type CellIndex = number

function cellToSetPlayer(cell: CellIndex): { setIndex: number; playerIndex: 0 | 1 } {
  return { setIndex: Math.floor(cell / 2), playerIndex: (cell % 2) as 0 | 1 }
}

export default function ScoreEntryFullScreen({ tournament, matchId, onClose, onSaved }: Props) {
  const match = tournament.matches.find(m => m.id === matchId)!
  const p1Name = getPlayerName(tournament, match.player1Id)
  const p2Name = getPlayerName(tournament, match.player2Id)
  const seeds = getSeeds(tournament)
  const seed1 = match.player1Id ? seeds.get(match.player1Id) : null
  const seed2 = match.player2Id ? seeds.get(match.player2Id) : null

  const r1 = getPlayerRating(match.player1Id!, p1Name)
  const r2 = getPlayerRating(match.player2Id!, p2Name)
  const p1WinProb = winProbability(r1.rating, r2.rating)

  const [sets, setSets] = useState<SetScores>([['', ''], ['', ''], ['', '']])
  const [activeCell, setActiveCell] = useState<CellIndex>(0)
  const [showConfirm, setShowConfirm] = useState(false)
  const [saving, setSaving] = useState(false)

  const showThirdSet = shouldShowThirdSet(sets)
  const visibleSets = showThirdSet ? 3 : 2
  const totalCells = visibleSets * 2

  const scores = getScores(sets)
  const winnerIdx = scores ? determineWinnerIndex(scores.score1, scores.score2) : null
  const winnerId = winnerIdx === 0 ? match.player1Id : winnerIdx === 1 ? match.player2Id : null
  const canSave = scores && winnerId

  const handleNumpad = useCallback((digit: number) => {
    if (activeCell >= totalCells) return
    const { setIndex, playerIndex } = cellToSetPlayer(activeCell)

    const updated = [...sets] as SetScores
    updated[setIndex] = [...updated[setIndex]] as [string, string]
    updated[setIndex][playerIndex] = String(digit)
    setSets(updated)

    // Auto-advance to next cell
    const nextCell = activeCell + 1
    if (nextCell < totalCells) {
      setActiveCell(nextCell)
    } else {
      // If we're on the last cell, check if we need third set
      // Use a timeout to allow state to update
      setTimeout(() => setActiveCell(nextCell), 0)
    }
  }, [activeCell, totalCells, sets])

  const handleClear = useCallback(() => {
    if (activeCell >= totalCells) {
      // Move back to last cell
      setActiveCell(totalCells - 1)
      return
    }
    const { setIndex, playerIndex } = cellToSetPlayer(activeCell)
    const currentVal = sets[setIndex][playerIndex]

    if (currentVal === '' && activeCell > 0) {
      // Go back to previous cell and clear it
      const prevCell = activeCell - 1
      const prev = cellToSetPlayer(prevCell)
      const updated = [...sets] as SetScores
      updated[prev.setIndex] = [...updated[prev.setIndex]] as [string, string]
      updated[prev.setIndex][prev.playerIndex] = ''
      setSets(updated)
      setActiveCell(prevCell)
    } else {
      // Clear current cell
      const updated = [...sets] as SetScores
      updated[setIndex] = [...updated[setIndex]] as [string, string]
      updated[setIndex][playerIndex] = ''
      setSets(updated)
    }
  }, [activeCell, totalCells, sets])

  async function handleConfirm() {
    if (!scores || !winnerId) return
    setSaving(true)
    const result = await saveMatchScore(tournament.id, matchId, scores.score1, scores.score2, winnerId)
    setSaving(false)
    onSaved(result)
  }

  // When all cells filled and we have a winner, show confirm
  const readyToConfirm = canSave && !showConfirm

  const winnerName = winnerId === match.player1Id ? p1Name : p2Name
  const loserName = winnerId === match.player1Id ? p2Name : p1Name
  const currentProfile = typeof window !== 'undefined' ? localStorage.getItem('rally_profile') : null
  const profileId = currentProfile ? JSON.parse(currentProfile)?.id : null
  const isWin = profileId === winnerId

  return (
    <div className="score-fullscreen">
      {!showConfirm ? (
        <>
          {/* Header */}
          <div className="score-fs-header">
            <button className="score-fs-close" onClick={onClose}>✕</button>
            <h2 className="score-fs-title">Enter Score</h2>
          </div>

          {/* Win probability */}
          <div className="prob-split" style={{ margin: '0 var(--space-lg)' }}>
            <span className="prob-split-label prob-split-p1">{Math.round(p1WinProb * 100)}%</span>
            <div className="prob-split-bar">
              <div className="prob-split-fill-left" style={{ width: `${Math.round(p1WinProb * 100)}%` }} />
              <div className="prob-split-fill-right" style={{ width: `${Math.round((1 - p1WinProb) * 100)}%` }} />
            </div>
            <span className="prob-split-label prob-split-p2">{Math.round((1 - p1WinProb) * 100)}%</span>
          </div>

          {/* Score display grid */}
          <div className="score-fs-grid">
            {/* Header row */}
            <div className="score-fs-grid-header"></div>
            {Array.from({ length: visibleSets }).map((_, i) => (
              <div key={i} className="score-fs-grid-header">Set {i + 1}</div>
            ))}

            {/* Player 1 row */}
            <div className="score-fs-player-name">
              {p1Name}{seed1 != null && <span className="seed-label"> ({seed1})</span>}
            </div>
            {sets.slice(0, visibleSets).map((set, i) => {
              const cellIdx = i * 2
              const isActive = activeCell === cellIdx
              const err = setValidation(sets, i)
              return (
                <div
                  key={`p1-${i}`}
                  className={`score-fs-cell ${isActive ? 'score-cell-active' : ''} ${set[0] !== '' && err ? 'score-cell-invalid' : ''}`}
                  onClick={() => setActiveCell(cellIdx)}
                >
                  {set[0] || ''}
                </div>
              )
            })}

            {/* Player 2 row */}
            <div className="score-fs-player-name">
              {p2Name}{seed2 != null && <span className="seed-label"> ({seed2})</span>}
            </div>
            {sets.slice(0, visibleSets).map((set, i) => {
              const cellIdx = i * 2 + 1
              const isActive = activeCell === cellIdx
              const err = setValidation(sets, i)
              return (
                <div
                  key={`p2-${i}`}
                  className={`score-fs-cell ${isActive ? 'score-cell-active' : ''} ${set[1] !== '' && err ? 'score-cell-invalid' : ''}`}
                  onClick={() => setActiveCell(cellIdx)}
                >
                  {set[1] || ''}
                </div>
              )
            })}
          </div>

          {/* Validation errors */}
          {sets.slice(0, visibleSets).map((_, i) => {
            const err = setValidation(sets, i)
            return err ? <div key={i} className="score-error" style={{ textAlign: 'center' }}>Set {i + 1}: {err}</div> : null
          })}

          {/* Numpad */}
          <div className="score-numpad">
            {[0, 1, 2, 3, 4, 5, 6, 7].map(d => (
              <button
                key={d}
                className="score-numpad-btn"
                onClick={() => handleNumpad(d)}
              >
                {d}
              </button>
            ))}
            <button className="score-numpad-btn score-numpad-clear" onClick={handleClear}>
              ←
            </button>
          </div>

          {/* Confirm button */}
          {readyToConfirm && (
            <button className="btn btn-primary score-fs-confirm-btn" onClick={() => setShowConfirm(true)}>
              Confirm Score
            </button>
          )}
        </>
      ) : (
        /* Confirmation step */
        <div className="score-confirm-step">
          <div className="score-confirm-icon">{isWin ? '🎉' : '🎾'}</div>
          <h2 className="score-confirm-title">
            {isWin
              ? `You beat ${loserName}`
              : winnerId && profileId && winnerId !== profileId
              ? `${winnerName} takes the match`
              : `${winnerName} wins`}
          </h2>
          <div className="score-confirm-score">
            {formatMatchScore(scores!.score1, scores!.score2)}
          </div>
          <p className="score-confirm-question">Is this correct?</p>
          <div className="score-confirm-actions">
            <button className="btn" onClick={() => setShowConfirm(false)}>Edit</button>
            <button className="btn btn-primary" onClick={handleConfirm} disabled={saving}>
              {saving ? 'Saving...' : 'Confirm'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
