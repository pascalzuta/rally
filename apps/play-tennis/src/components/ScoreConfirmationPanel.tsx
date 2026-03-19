import { useState, useRef, useEffect } from 'react'
import { confirmMatchScore, proposeScoreCorrection, resolveScoreDispute, reportMatchIssue, getPlayerName } from '../store'
import { Tournament, Match } from '../types'

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
  match: Match
  currentPlayerId: string
  onUpdated: () => void
}

type Mode = 'options' | 'correction' | 'issue' | 'dispute-review'

export default function ScoreConfirmationPanel({ tournament, match, currentPlayerId, onUpdated }: Props) {
  const isReporter = match.scoreReportedBy === currentPlayerId
  const hasDispute = match.scoreDispute?.status === 'pending'
  const initialMode: Mode = hasDispute && isReporter ? 'dispute-review' : 'options'

  const [mode, setMode] = useState<Mode>(initialMode)
  const [sets, setSets] = useState<Array<[string, string]>>([['', ''], ['', ''], ['', '']])
  const [issueText, setIssueText] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const p1Name = getPlayerName(tournament, match.player1Id)
  const p2Name = getPlayerName(tournament, match.player2Id)
  const reportedScore = match.score1.map((s, i) => `${s}-${match.score2[i]}`).join(', ')

  // Correction score logic
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
  const scores = getScores()
  const winnerId = scores ? determineWinner(scores.score1, scores.score2) : null
  const canSubmitCorrection = scores && winnerId

  const prevShowThirdSet = useRef(false)
  useEffect(() => {
    if (showThirdSet && !prevShowThirdSet.current) {
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

  async function handleConfirm() {
    setSaving(true)
    await confirmMatchScore(tournament.id, match.id, currentPlayerId)
    onUpdated()
  }

  async function handleSubmitCorrection() {
    if (!scores || !winnerId) return
    setSaving(true)
    await proposeScoreCorrection(tournament.id, match.id, currentPlayerId, scores.score1, scores.score2, winnerId)
    onUpdated()
  }

  async function handleSubmitIssue() {
    if (!issueText.trim()) return
    setSaving(true)
    await reportMatchIssue(tournament.id, match.id, currentPlayerId, issueText.trim())
    onUpdated()
  }

  async function handleResolveDispute(action: 'accept' | 'reject') {
    setSaving(true)
    await resolveScoreDispute(tournament.id, match.id, currentPlayerId, action)
    onUpdated()
  }

  // Dispute review mode (for original reporter when opponent proposed correction)
  if (mode === 'dispute-review' && match.scoreDispute) {
    const dispute = match.scoreDispute
    const proposedScore = dispute.proposedScore1?.map((s, i) => `${s}-${dispute.proposedScore2?.[i]}`).join(', ') ?? ''
    const proposedWinnerName = getPlayerName(tournament, dispute.proposedWinnerId ?? null)
    const disputerName = tournament.players.find(p => p.id === dispute.disputedBy)?.name ?? 'Your opponent'

    return (
      <div className="score-confirmation-panel" onClick={e => e.stopPropagation()}>
        <div className="dispute-review">
          <div className="dispute-review-title">Score Dispute</div>
          <div className="dispute-review-desc">{disputerName} disagrees with the reported score.</div>

          <div className="dispute-compare">
            <div className="dispute-score-col">
              <div className="dispute-score-label">Your score</div>
              <div className="dispute-score-value">{reportedScore}</div>
            </div>
            <div className="dispute-score-divider">vs</div>
            <div className="dispute-score-col">
              <div className="dispute-score-label">Their score</div>
              <div className="dispute-score-value">{proposedScore}</div>
            </div>
          </div>

          <div className="dispute-winner-compare">
            <span>Their winner: <strong>{proposedWinnerName}</strong></span>
          </div>

          <div className="dispute-actions">
            <button className="btn" onClick={() => handleResolveDispute('reject')} disabled={saving}>
              Reject (Split Decision)
            </button>
            <button className="btn btn-primary" onClick={() => handleResolveDispute('accept')} disabled={saving}>
              Accept Their Score
            </button>
          </div>
          <div className="dispute-note">
            Split decision: match recorded as played but won't count toward standings.
          </div>
        </div>
      </div>
    )
  }

  // Correction entry mode
  if (mode === 'correction') {
    return (
      <div className="score-confirmation-panel" onClick={e => e.stopPropagation()}>
        <div className="correction-header">
          <div className="correction-title">Suggest a correction</div>
          <div className="correction-reported">Reported: {reportedScore}</div>
        </div>

        <div className="score-grid" style={{ gridTemplateColumns: `1fr repeat(${visibleSets}, 60px)` }}>
          <div className="score-header"></div>
          {sets.slice(0, visibleSets).map((_, i) => (
            <div key={i} className="score-header">Set {i + 1}</div>
          ))}

          <div className="score-player-name score-row-label">{p1Name}</div>
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

          <div className="score-player-name score-row-label">{p2Name}</div>
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

        <div className="correction-actions">
          <button className="btn" onClick={() => setMode('options')}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmitCorrection} disabled={!canSubmitCorrection || saving}>
            Submit Correction
          </button>
        </div>
      </div>
    )
  }

  // Issue report mode
  if (mode === 'issue') {
    return (
      <div className="score-confirmation-panel" onClick={e => e.stopPropagation()}>
        <div className="issue-header">
          <div className="issue-title">Report an issue</div>
          <div className="issue-desc">Describe what happened. This will be reviewed by the organizer.</div>
        </div>
        <textarea
          className="issue-text"
          placeholder="What went wrong?"
          value={issueText}
          onChange={e => setIssueText(e.target.value)}
          rows={3}
        />
        <div className="issue-actions">
          <button className="btn" onClick={() => setMode('options')}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmitIssue} disabled={!issueText.trim() || saving}>
            Submit Report
          </button>
        </div>
      </div>
    )
  }

  // Default: three options
  return (
    <div className="score-confirmation-panel" onClick={e => e.stopPropagation()}>
      <div className="confirm-reported-score">
        Score: {reportedScore}
        <span className="confirm-winner-label"> — Winner: {getPlayerName(tournament, match.winnerId)}</span>
      </div>
      <div className="confirm-options">
        <button className="btn btn-primary confirm-option-btn" onClick={handleConfirm} disabled={saving}>
          Confirm Score
        </button>
        <button className="btn confirm-option-btn" onClick={() => setMode('correction')}>
          Suggest Correction
        </button>
        <button className="btn confirm-option-btn confirm-option--issue" onClick={() => setMode('issue')}>
          Report Issue
        </button>
      </div>
    </div>
  )
}
