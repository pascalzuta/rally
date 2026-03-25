import { useState, useRef, useEffect } from 'react'
import { confirmMatchScore, proposeScoreCorrection, resolveScoreDispute, reportMatchIssue, getPlayerName, clearPendingFeedback } from '../store'
import { Tournament, Match } from '../types'
import PostMatchFeedbackInline from './PostMatchFeedbackInline'

const SCORE_CONFIRMATION_WINDOW_MS = 48 * 60 * 60 * 1000

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

function formatCountdown(ms: number): string {
  const totalMinutes = Math.max(0, Math.ceil(ms / 60000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    const remHours = hours % 24
    return `${days}d ${remHours}h left`
  }
  if (hours > 0) return `${hours}h ${minutes}m left`
  return `${minutes}m left`
}

function formatDeadline(iso: string | null | undefined): string | null {
  if (!iso) return null
  const deadline = new Date(new Date(iso).getTime() + SCORE_CONFIRMATION_WINDOW_MS)
  return deadline.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function ScoreConfirmationPanel({ tournament, match, currentPlayerId, onUpdated }: Props) {
  const isReporter = match.scoreReportedBy === currentPlayerId
  const hasDispute = match.scoreDispute?.status === 'pending'
  const initialMode: Mode = hasDispute && isReporter ? 'dispute-review' : 'options'

  const [mode, setMode] = useState<Mode>(initialMode)
  const [sets, setSets] = useState<Array<[string, string]>>([['', ''], ['', ''], ['', '']])
  const [issueText, setIssueText] = useState('')
  const [saving, setSaving] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const p1Name = getPlayerName(tournament, match.player1Id)
  const p2Name = getPlayerName(tournament, match.player2Id)
  const reportedScore = match.score1.map((s, i) => `${s}-${match.score2[i]}`).join(', ')
  const reporterName = getPlayerName(tournament, match.scoreReportedBy ?? null)
  const reportedWinnerName = getPlayerName(tournament, match.winnerId)
  const countdownDeadline = formatDeadline(match.scoreReportedAt)
  const remainingMs = match.scoreReportedAt
    ? Math.max(0, new Date(match.scoreReportedAt).getTime() + SCORE_CONFIRMATION_WINDOW_MS - now)
    : SCORE_CONFIRMATION_WINDOW_MS

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

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60000)
    return () => window.clearInterval(interval)
  }, [])

  const [showFeedback, setShowFeedback] = useState(false)

  async function handleConfirm() {
    setSaving(true)
    await confirmMatchScore(tournament.id, match.id, currentPlayerId)
    setShowFeedback(true)
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
    setShowFeedback(true)
  }

  // After confirming / resolving, show feedback form in the same panel
  if (showFeedback) {
    const opponentId = match.player1Id === currentPlayerId ? match.player2Id! : match.player1Id!
    const opponentName = getPlayerName(tournament, opponentId)
    return (
      <PostMatchFeedbackInline
        matchId={match.id}
        tournamentId={tournament.id}
        playerId={currentPlayerId}
        opponentId={opponentId}
        opponentName={opponentName}
        onDismiss={() => { clearPendingFeedback(); onUpdated() }}
      />
    )
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
      <div className="score-confirmation-panel workflow-module" onClick={e => e.stopPropagation()}>
        <div className="workflow-header">
          <div className="workflow-status workflow-status--slate">Dispute score</div>
          <div className="schedule-panel-title">Correct the reported result</div>
          <div className="schedule-panel-copy">Update the set scores below. If the problem is broader than the scoreline, report an issue instead.</div>
        </div>
        <div className="score-confirm-summary-card">
          <div className="score-confirm-summary-row">
            <span className="score-confirm-summary-label">Reported score</span>
            <span className="score-confirm-summary-value">{reportedScore}</span>
          </div>
          <div className="score-confirm-summary-row">
            <span className="score-confirm-summary-label">Reported winner</span>
            <span className="score-confirm-summary-value">{reportedWinnerName}</span>
          </div>
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
          <div className="correction-secondary-actions">
            <button className="btn" onClick={() => setMode('options')}>Back</button>
            <button className="btn" onClick={() => setMode('issue')}>Report Issue Instead</button>
          </div>
          <button className="btn btn-primary correction-submit-btn" onClick={handleSubmitCorrection} disabled={!canSubmitCorrection || saving}>
            Submit Correction
          </button>
        </div>
      </div>
    )
  }

  // Issue report mode
  if (mode === 'issue') {
    return (
      <div className="score-confirmation-panel workflow-module" onClick={e => e.stopPropagation()}>
        <div className="workflow-header">
          <div className="workflow-status workflow-status--slate">Report issue</div>
          <div className="schedule-panel-title">Report an issue</div>
          <div className="schedule-panel-copy">Use this when the reported score cannot be fixed with a simple correction.</div>
        </div>
        <div className="score-confirm-summary-card">
          <div className="score-confirm-summary-row">
            <span className="score-confirm-summary-label">Reported score</span>
            <span className="score-confirm-summary-value">{reportedScore}</span>
          </div>
          <div className="score-confirm-summary-row">
            <span className="score-confirm-summary-label">Reported winner</span>
            <span className="score-confirm-summary-value">{reportedWinnerName}</span>
          </div>
        </div>
        <textarea
          className="issue-text"
          placeholder="What went wrong?"
          value={issueText}
          onChange={e => setIssueText(e.target.value)}
          rows={3}
        />
        <div className="issue-actions">
          <button className="btn" onClick={() => setMode('options')}>Back</button>
          <button className="btn btn-primary" onClick={handleSubmitIssue} disabled={!issueText.trim() || saving}>
            Submit Report
          </button>
        </div>
      </div>
    )
  }

  // Default: confirm or dispute
  return (
      <div className="score-confirmation-panel workflow-module" onClick={e => e.stopPropagation()}>
        <div className="workflow-header">
          <div className="workflow-status workflow-status--slate">Score review</div>
          <div className="schedule-panel-title">Review the reported result</div>
          <div className="schedule-panel-copy">{reporterName} reported this score. Confirm it if it is correct, or dispute it within 48 hours.</div>
        </div>
        <div className="score-confirm-meta">
          <div className="score-confirm-stat-row">
            <span className="score-confirm-summary-label">Reported score</span>
            <span className="score-confirm-summary-value">{reportedScore}</span>
          </div>
          <div className="score-confirm-stat-row">
            <span className="score-confirm-summary-label">Reported winner</span>
            <span className="score-confirm-summary-value">{reportedWinnerName}</span>
          </div>
          <div className="score-confirm-stat-row score-confirm-stat-row--deadline">
            <span className="score-confirm-summary-label">Auto-confirms in</span>
            <span className="score-confirm-deadline-value">{formatCountdown(remainingMs)}</span>
          </div>
          {countdownDeadline && <div className="score-confirm-deadline-meta">Deadline {countdownDeadline}</div>}
        </div>
        <div className="workflow-actions score-confirm-primary-actions">
          <button className="btn confirm-option-btn" onClick={() => setMode('correction')}>
            Dispute Score
          </button>
          <button className="btn btn-primary confirm-option-btn" onClick={handleConfirm} disabled={saving}>
            Confirm Score
          </button>
        </div>
    </div>
  )
}
