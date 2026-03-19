import { useState } from 'react'
import { saveMatchFeedback, getPlayerFeedbackForMatch, hasBothFeedback } from '../store'
import { FeedbackSentiment, IssueCategory } from '../types'

interface Props {
  matchId: string
  tournamentId: string
  playerId: string
  opponentId: string
  opponentName: string
}

const ISSUE_OPTIONS: { value: IssueCategory; label: string }[] = [
  { value: 'showed_up_late', label: 'Showed up late (>10 min)' },
  { value: 'left_early', label: 'Left early / didn\'t finish' },
  { value: 'disputed_unfairly', label: 'Disputed the score unfairly' },
  { value: 'unsportsmanlike', label: 'Unsportsmanlike behavior' },
  { value: 'other', label: 'Other' },
]

export default function PostMatchFeedbackInline({ matchId, tournamentId, playerId, opponentId, opponentName }: Props) {
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
    setSaved(true)
  }

  if (saved) {
    const bothSubmitted = hasBothFeedback(matchId)
    return (
      <div className="post-match-feedback" onClick={e => e.stopPropagation()}>
        <div className="feedback-thankyou">
          Thanks for your feedback!
          {!bothSubmitted && (
            <div className="feedback-blind-note">Feedback is anonymous until both players respond.</div>
          )}
        </div>
      </div>
    )
  }

  if (showIssueForm) {
    return (
      <div className="post-match-feedback" onClick={e => e.stopPropagation()}>
        <div className="feedback-title">What happened?</div>
        <div className="feedback-issue-list">
          {ISSUE_OPTIONS.map(opt => (
            <label key={opt.value} className="feedback-issue-option">
              <input
                type="checkbox"
                checked={issueCategories.includes(opt.value)}
                onChange={() => toggleCategory(opt.value)}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
        {issueCategories.includes('other') && (
          <textarea
            className="feedback-issue-text"
            placeholder="Tell us more (optional)"
            value={issueText}
            onChange={e => setIssueText(e.target.value)}
            rows={2}
          />
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
    <div className="post-match-feedback" onClick={e => e.stopPropagation()}>
      <div className="feedback-title">How was the match with {opponentName}?</div>
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
