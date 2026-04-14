import { useState, useRef, useEffect } from 'react'
import { saveMatchScore, getPlayerName, clearPendingFeedback } from '../store'
import { Tournament } from '../types'
import { useToast, ConfirmationTone } from './Toast'
import { analytics } from '../analytics'
import PostMatchFeedbackInline from './PostMatchFeedbackInline'

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
  currentPlayerId?: string
  onSaved: () => void
  onActionComplete?: (message: string, tone: ConfirmationTone) => void
  embedded?: boolean
}

export default function InlineScoreEntry({ tournament, matchId, currentPlayerId, onSaved, onActionComplete, embedded = false }: Props) {
  const { showSuccess, showError } = useToast()
  const match = tournament.matches.find(m => m.id === matchId)!
  // Determine if the current user is player1 or player2 to show correct "You" label
  const isCurrentPlayer2 = currentPlayerId === match.player2Id
  const youName = isCurrentPlayer2
    ? getPlayerName(tournament, match.player2Id)
    : getPlayerName(tournament, match.player1Id)
  const opponentName = isCurrentPlayer2
    ? getPlayerName(tournament, match.player1Id)
    : getPlayerName(tournament, match.player2Id)

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

  const rawScores = getScores()
  // Map UI rows back to player1/player2 order for storage
  const scores = rawScores && isCurrentPlayer2
    ? { score1: rawScores.score2, score2: rawScores.score1 }
    : rawScores
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

  const prevShowThirdSet = useRef(false)

  // Auto-focus the first input of set 3 when it appears
  useEffect(() => {
    if (showThirdSet && !prevShowThirdSet.current) {
      // Set 3 player 1 input is at index 4 (0-based: set0p1=0, set0p2=1, set1p1=2, set1p2=3, set2p1=4)
      setTimeout(() => {
        const thirdSetInput = inputRefs.current[4]
        if (thirdSetInput) {
          thirdSetInput.focus()
          thirdSetInput.select()
        }
      }, 50)
    }
    prevShowThirdSet.current = showThirdSet
  }, [showThirdSet])

  const visibleSets = showThirdSet ? 3 : 2

  // Confirmation + success feedback state machine
  const [saveState, setSaveState] = useState<'idle' | 'confirming' | 'saving' | 'success' | 'error'>('idle')

  function handleSaveClick() {
    if (!scores || !winnerId || saveState === 'saving') return
    handleConfirm()
  }

  async function handleConfirm() {
    if (!scores || !winnerId) return
    setSaveState('saving')
    try {
      await saveMatchScore(tournament.id, matchId, scores.score1, scores.score2, winnerId, currentPlayerId)
      analytics.track('ScoreSubmitted', { userId: currentPlayerId, properties: { tournamentId: tournament.id, matchId } })
      setSaveState('success')
      showSuccess('Score reported — waiting for opponent to confirm')
    } catch {
      setSaveState('error')
      showError('Failed to save score')
    }
  }

  if (saveState === 'success') {
    const opponentId = match.player1Id === currentPlayerId ? match.player2Id! : match.player1Id!
    return (
      <div className={`inline-score-entry workflow-module ${embedded ? 'inline-score-entry--embedded' : ''}`}>
        {!embedded && (
          <div className="workflow-header">
            <div className="workflow-status workflow-status--green">Score Reported</div>
            <div className="schedule-panel-title">Waiting for opponent confirmation</div>
            <div className="schedule-panel-copy">Your opponent has 48 hours to confirm the result.</div>
          </div>
        )}
        {embedded && (
          <div className="schedule-panel-copy">Score reported. Your opponent has 48 hours to confirm.</div>
        )}
        <PostMatchFeedbackInline
          matchId={matchId}
          tournamentId={tournament.id}
          playerId={currentPlayerId!}
          opponentId={opponentId}
          opponentName={opponentName}
          onDone={() => {
            clearPendingFeedback()
            if (onActionComplete) {
              onActionComplete('Score submitted. Your opponent has 48 hours to confirm.', 'blue')
            } else {
              onSaved()
            }
          }}
        />
      </div>
    )
  }

  if (saveState === 'error') {
    return (
      <div className={`inline-score-entry workflow-module ${embedded ? 'inline-score-entry--embedded' : ''}`}>
        {!embedded ? (
          <div className="workflow-header">
            <div className="workflow-status workflow-status--red">Save Failed</div>
            <div className="schedule-panel-title">Could not report the score</div>
            <div className="schedule-panel-copy">Check the result and try again.</div>
          </div>
        ) : (
          <div className="schedule-panel-copy">Could not report the score. Please try again.</div>
        )}
        <div className="workflow-actions">
          <button className="btn" onClick={() => setSaveState('idle')} style={{ width: '100%' }}>Try Again</button>
        </div>
      </div>
    )
  }

  if (saveState === 'confirming' && scores && winnerId) {
    // Show scores from "You" perspective (your score first)
    const yourScores = isCurrentPlayer2 ? scores.score2 : scores.score1
    const oppScores = isCurrentPlayer2 ? scores.score1 : scores.score2
    const scoreSummary = yourScores.map((s, i) => `${s}-${oppScores[i]}`).join(', ')
    return (
      <div className={`inline-score-entry workflow-module ${embedded ? 'inline-score-entry--embedded' : ''}`}>
        {!embedded && (
          <div className="workflow-header">
            <div className="workflow-status workflow-status--amber">Report Score</div>
            <div className="schedule-panel-title">Confirm the final result</div>
            <div className="schedule-panel-copy">Review the score below before sending it to your opponent.</div>
          </div>
        )}
        <div className={`score-confirm-overlay ${embedded ? 'score-confirm-overlay--embedded' : ''}`}>
          <div className="score-confirm-summary">{scoreSummary}</div>
          <div className="score-confirm-winner">Winner: {getPlayerName(tournament, winnerId)}</div>
          <div className="score-confirm-actions">
            <button className="btn" onClick={() => setSaveState('idle')}>Edit</button>
            <button className="btn btn-primary" onClick={handleConfirm}>
              Report Score
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`inline-score-entry workflow-module ${embedded ? 'inline-score-entry--embedded' : ''}`}>
      {!embedded && (
        <>
          <div className="workflow-header">
            <div className="workflow-status workflow-status--amber">Report Score</div>
            <div className="schedule-panel-title">Enter the final result</div>
            <div className="schedule-panel-copy">Save it for your opponent to confirm.</div>
          </div>
          <div className="workflow-divider" />
        </>
      )}
      <div className="score-grid" style={{ gridTemplateColumns: `1fr repeat(${visibleSets}, 60px)` }}>
        <div className="score-header"></div>
        {sets.slice(0, visibleSets).map((_, i) => (
          <div key={i} className="score-header">Set {i + 1}</div>
        ))}

        <div className="score-player-name score-row-label score-row-label--you">You ({youName})</div>
        {sets.slice(0, visibleSets).map((set, i) => (
          <input
            key={`you-${i}`}
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

        <div className="score-player-name score-row-label score-row-label--opponent">{opponentName}</div>
        {sets.slice(0, visibleSets).map((set, i) => (
          <input
            key={`opp-${i}`}
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

      <div className="workflow-actions">
        <button className="btn btn-primary" onClick={handleSaveClick} disabled={!canSave || saveState === 'saving'} style={{ width: '100%' }}>
          {saveState === 'saving' ? 'Saving…' : 'Report Score'}
        </button>
      </div>
    </div>
  )
}
