import { useState } from 'react'
import { saveMatchFeedback, getPlayerFeedbackForMatch, clearPendingFeedback } from '../store'
import { FeedbackSentiment, IssueCategory } from '../types'

interface Props {
  matchId: string
  tournamentId: string
  playerId: string
  opponentId: string
  opponentName: string
  onDone?: () => void
}

const ISSUE_OPTIONS: { value: IssueCategory; label: string; detail: string }[] = [
  { value: 'showed_up_late', label: 'Showed up late', detail: 'Arrived more than 10 minutes after the scheduled time.' },
  { value: 'left_early', label: 'Left early / didn\'t finish', detail: 'The match ended early or could not be completed.' },
  { value: 'disputed_unfairly', label: 'Disputed the score unfairly', detail: 'The score report was challenged in a way that felt unreasonable.' },
  { value: 'unsportsmanlike', label: 'Unsportsmanlike behavior', detail: 'Behavior during the match was disrespectful or inappropriate.' },
  { value: 'other', label: 'Other', detail: 'Something else happened that does not fit the options above.' },
]

export default function PostMatchFeedbackInline({ matchId, tournamentId, playerId, opponentId, opponentName, onDone }: Props) {
  const existing = getPlayerFeedbackForMatch(matchId, playerId)
  const [sentiment, setSentiment] = useState<FeedbackSentiment | null>(existing?.sentiment ?? null)
  const [issueCategories, setIssueCategories] = useState<IssueCategory[]>(existing?.issueCategories ?? [])
  const [issueText, setIssueText] = useState(existing?.issueText ?? '')
  const [saved, setSaved] = useState(!!existing)
  const [showIssueForm, setShowIssueForm] = useState(false)

  function toggleCategory(cat: IssueCategory) {
    setIssueCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])
  }

  async function handleSubmit(chosenSentiment: FeedbackSentiment) {
    if (chosenSentiment === 'negative' && !showIssueForm) {
      setSentiment('negative')
      setShowIssueForm(true)
      return
    }

    await saveMatchFeedback({
      matchId,
      tournamentId,
      fromPlayerId: playerId,
      toPlayerId: opponentId,
      sentiment: chosenSentiment,
      issueCategories: chosenSentiment === 'negative' ? issueCategories : undefined,
      issueText: chosenSentiment === 'negative' && issueText.trim() ? issueText.trim() : undefined,
    })
    clearPendingFeedback()
    setSaved(true)
    if (onDone) setTimeout(onDone, 1500)
  }

  if (saved) {
    return (
      <div className="post-match-feedback workflow-module" onClick={e => e.stopPropagation()}>
        <div className="b-feedback-saved">
          <span className="b-feedback-saved-check" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M3 8.5l3 3 6.5-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div className="b-feedback-saved-body">
            <div className="b-feedback-saved-title">Thanks for your <em className="bg-em">feedback.</em></div>
            <div className="b-feedback-saved-copy">This information is only for us at Rally.</div>
          </div>
        </div>
      </div>
    )
  }

  if (showIssueForm) {
    return (
      <div className="post-match-feedback workflow-module" onClick={e => e.stopPropagation()}>
        <div className="workflow-header">
          <div className="workflow-status workflow-status--red">Report Issue</div>
          <div className="schedule-panel-title">What happened?</div>
          <div className="schedule-panel-copy">Choose the issue that best describes the match. Your report stays private while Rally reviews the match feedback.</div>
        </div>
        <div className="feedback-issue-summary-card">
          <div className="feedback-issue-summary-label">Choose all that apply</div>
          <div className="feedback-issue-summary-copy">Use this only when the match had a meaningful problem. For normal matches, go back and leave regular feedback instead.</div>
        </div>
        <div className="feedback-issue-list">
          {ISSUE_OPTIONS.map(opt => (
            <label key={opt.value} className={`feedback-issue-option ${issueCategories.includes(opt.value) ? 'selected' : ''}`}>
              <input
                type="checkbox"
                checked={issueCategories.includes(opt.value)}
                onChange={() => toggleCategory(opt.value)}
              />
              <span className="feedback-issue-checkmark" aria-hidden="true">{issueCategories.includes(opt.value) ? '✓' : ''}</span>
              <span className="feedback-issue-copy">
                <span className="feedback-issue-title">{opt.label}</span>
                <span className="feedback-issue-detail">{opt.detail}</span>
              </span>
            </label>
          ))}
        </div>
        {issueCategories.includes('other') && (
          <div className="feedback-issue-note-card">
            <div className="feedback-issue-note-label">More detail</div>
            <textarea
              className="feedback-issue-text"
              placeholder="Tell us more (optional)"
              value={issueText}
              onChange={e => setIssueText(e.target.value)}
              rows={3}
            />
          </div>
        )}
        <div className="feedback-issue-actions">
          <button className="btn" onClick={() => { setShowIssueForm(false); setSentiment(null) }}>Back</button>
          <button
            className="btn btn-primary"
            onClick={() => handleSubmit('negative')}
            disabled={issueCategories.length === 0}
          >
            Submit
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="post-match-feedback workflow-module" onClick={e => e.stopPropagation()}>
      <div className="workflow-header">
        <div className="workflow-status workflow-status--slate">Rate Match</div>
        <div className="schedule-panel-title">How was the match with {opponentName}?</div>
        <div className="schedule-panel-copy">Your feedback is only visible to Play Rally.</div>
      </div>
      <div className="feedback-sentiment-row">
        <button
          className={`feedback-sentiment-btn feedback-sentiment--positive ${sentiment === 'positive' ? 'selected' : ''}`}
          onClick={() => handleSubmit('positive')}
        >
          <span className="feedback-sentiment-icon">+</span>
          <span>Great match</span>
        </button>
        <button
          className={`feedback-sentiment-btn feedback-sentiment--neutral ${sentiment === 'neutral' ? 'selected' : ''}`}
          onClick={() => handleSubmit('neutral')}
        >
          <span className="feedback-sentiment-icon">=</span>
          <span>Fine</span>
        </button>
        <button
          className={`feedback-sentiment-btn feedback-sentiment--negative ${sentiment === 'negative' ? 'selected' : ''}`}
          onClick={() => handleSubmit('negative')}
        >
          <span className="feedback-sentiment-icon">!</span>
          <span>Issue</span>
        </button>
      </div>
    </div>
  )
}
