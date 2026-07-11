import { forwardRef, useState, useCallback, useRef } from 'react'
import { Tournament, Match } from '../types'
import { hasUnreadFrom, getPlayerName, clearPendingFeedback } from '../store'
import { getMatchCardView } from '../matchCardModel'
import { useToast, ConfirmationTone } from './Toast'
import MessagePanel from './MessagePanel'
import UpcomingMatchPanel from './UpcomingMatchPanel'
import ScoreConfirmationPanel from './ScoreConfirmationPanel'
import InlineScoreEntry from './InlineScoreEntry'
import PostMatchFeedbackInline from './PostMatchFeedbackInline'

interface Props {
  tournament: Tournament
  match: Match
  currentPlayerId: string
  currentPlayerName: string
  isExpanded: boolean
  isMessaging: boolean
  className?: string
  style?: React.CSSProperties
  onToggleExpanded: () => void
  onToggleMessaging: () => void
  onUpdated: () => void
  onScoreSaved?: () => void
}

/** Italicise the opponent name(s) inside titles like "vs Alex Rivera" or "Alex vs Sam".
 *  For the current player's own match ("vs <Name>") we prefix "You" so it reads as
 *  *your* game, and colour the opponent name by the match's status tone.
 *  Pure presentational — keeps matchCardModel free of JSX. */
function renderTitleWithEmphasis(title: string, toneClass = 'blue') {
  const nameClass = `match-opp match-opp--${toneClass}`
  // "vs <Name>" — the current player's match: read it as "You vs <Name>"
  if (title.startsWith('vs ')) {
    return (
      <>
        You vs <em className={nameClass}>{title.slice(3)}</em>
      </>
    )
  }
  // "<A> vs <B>" — neutral all-matches view: emphasise both names
  const idx = title.indexOf(' vs ')
  if (idx > 0) {
    return (
      <>
        <em className="match-opp">{title.slice(0, idx)}</em>
        {' vs '}
        <em className="match-opp">{title.slice(idx + 4)}</em>
      </>
    )
  }
  return title
}

const MatchActionCard = forwardRef<HTMLDivElement, Props>(function MatchActionCard(
  {
    tournament,
    match,
    currentPlayerId,
    currentPlayerName,
    isExpanded,
    isMessaging,
    className,
    style,
    onToggleExpanded,
    onToggleMessaging,
    onUpdated,
    onScoreSaved,
  },
  ref
) {
  const { showConfirmation } = useToast()
  const [highlightTone, setHighlightTone] = useState<ConfirmationTone | null>(null)
  const [feedbackPhase, setFeedbackPhase] = useState(false)
  const collapseTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const handleActionComplete = useCallback((message: string, tone: ConfirmationTone) => {
    showConfirmation(message, tone)
    setHighlightTone(tone)

    // Delay data refresh until after pulse completes so card doesn't unmount mid-animation
    if (collapseTimer.current) clearTimeout(collapseTimer.current)
    collapseTimer.current = setTimeout(() => {
      setHighlightTone(null)
      onUpdated()
    }, 3000)
  }, [showConfirmation, onUpdated])

  const handleScoreActionComplete = useCallback((message: string, tone: ConfirmationTone) => {
    showConfirmation(message, tone)
    setFeedbackPhase(true)
  }, [showConfirmation])

  const view = getMatchCardView(tournament, match, currentPlayerId)
  const canToggleExpanded = Boolean(view.primaryActionLabel && view.expansionKind)
  const hasUnread = view.opponentId ? hasUnreadFrom(currentPlayerId, view.opponentId) : false
  const highlightClass = highlightTone ? `action-card--highlight-${highlightTone}` : ''
  const isUpNext = className?.includes('upnext-card') ?? false
  const classes = ['action-card', `action-${view.tone}`, highlightClass, className].filter(Boolean).join(' ')
  const toneClass = view.tone === 'completed'
    ? 'slate'
    : view.tone === 'confirm-score' || view.tone === 'respond'
      ? 'blue'
      : view.tone === 'confirmed'
        ? 'green'
        : view.tone === 'escalated'
          ? 'red'
          : view.tone === 'schedule'
            ? 'amber'
            : 'slate'

  // metaKind drives where the meta string renders:
  //   'time'      — promote into the body as the data hero (the answer)
  //   'countdown' — keep as a chip in the status row (urgency signal)
  //   null/undefined — back-compat, render as chip if string present
  const metaInBody = view.metaKind === 'time' && view.metaLabel
  const metaInChip = view.metaLabel && view.metaKind !== 'time'

  const primaryBtnClass = view.primaryActionIsHero
    ? 'action-card-btn action-card-btn--solid'
    : view.courtNeeded
      ? 'action-card-btn action-card-btn--court'
      : 'action-card-btn'

  // When the schedule panel is expanded it already carries its own "Change time"
  // action (and full Court section), so the collapsed-summary primary pill would
  // just duplicate it. Hide it while expanded — tapping the card header collapses.
  const showPrimaryButton =
    Boolean(view.primaryActionLabel) && !(isExpanded && view.expansionKind === 'schedule')

  return (
    <div
      ref={ref}
      className={classes}
      style={style}
      onClick={canToggleExpanded ? onToggleExpanded : undefined}
      >
      {isUpNext && (
        <div className="action-card-upnext-eyebrow">
          Up <em className="bg-em">next.</em>
        </div>
      )}
      <div className="action-card-status-row">
        <div className={`card-status-label card-status-label--${toneClass}`}>
          {view.tone === 'confirmed' && (
            <svg
              className="card-status-check"
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              aria-hidden="true"
            >
              <path d="M2 5.2 4 7.2 8 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {view.statusLabel}
        </div>
        {(metaInChip || view.infoTooltipText) && (
          <div className="action-card-status-meta">
            {metaInChip && <div className={`card-meta-chip card-meta-chip--${toneClass}`}>{view.metaLabel}</div>}
            {view.infoTooltipText && (
              <div className="card-info-tooltip">
                <button
                  type="button"
                  className="card-info-tooltip-trigger"
                  aria-label={view.infoTooltipLabel ?? 'More information'}
                  onClick={event => event.stopPropagation()}
                >
                  i
                </button>
                <div className="card-info-tooltip-bubble" role="tooltip">
                  {view.infoTooltipText}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="action-card-main">
        <div className="action-card-opponent">{renderTitleWithEmphasis(view.title, toneClass)}</div>
        {metaInBody && (
          <div className="action-card-time">{view.metaLabel}</div>
        )}
        {view.supporting && (
          <div className={`action-card-supporting ${view.supportingTone === 'danger' ? 'action-card-supporting--danger' : ''}`}>
            {view.supporting}
          </div>
        )}
        {view.courtSummary && !isExpanded && (
          <div className="action-card-court">{view.courtSummary}</div>
        )}
      </div>

      {(showPrimaryButton || (view.isMyMatch && view.opponentId)) && (
        <div className="action-card-buttons">
          {showPrimaryButton && (
            <button
              className={primaryBtnClass}
              onClick={event => {
                event.stopPropagation()
                onToggleExpanded()
              }}
            >
              {view.primaryActionLabel}
            </button>
          )}

          {view.isMyMatch && view.opponentId && (
            <button
              className={`match-card-msg-btn ${isMessaging ? 'active' : ''}`}
              onClick={event => {
                event.stopPropagation()
                onToggleMessaging()
              }}
              aria-label="Message opponent"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 3h12v8H4l-2 2V3z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
              </svg>
              {hasUnread && <span className="msg-unread-dot" />}
            </button>
          )}
        </div>
      )}

      {/* Court-needed cards swap the primary to "Pick a court"; the mandated
          Change-time affordance stays as a quiet text link (approved variant A). */}
      {view.courtNeeded && !isExpanded && (
        <div className="action-card-courtneeded-secondary">
          <button
            className="action-card-change-time-link"
            onClick={event => {
              event.stopPropagation()
              onToggleExpanded()
            }}
          >
            Change time
          </button>
        </div>
      )}

      {isMessaging && view.opponentId && view.opponentName && (
        <div className="action-card-expansion" onClick={event => event.stopPropagation()}>
          <MessagePanel
            currentPlayerId={currentPlayerId}
            currentPlayerName={currentPlayerName}
            otherPlayerId={view.opponentId}
            otherPlayerName={view.opponentName}
            onClose={onToggleMessaging}
          />
        </div>
      )}

      {isExpanded && feedbackPhase && match.player1Id && match.player2Id && (() => {
        const opponentId = match.player1Id === currentPlayerId ? match.player2Id : match.player1Id
        const opponentName = getPlayerName(tournament, opponentId)
        return (
          <div className="action-card-expansion" onClick={event => event.stopPropagation()}>
            <div className="schedule-panel-copy">Score reported. Your opponent has 48 hours to confirm.</div>
            <PostMatchFeedbackInline
              matchId={match.id}
              tournamentId={tournament.id}
              playerId={currentPlayerId}
              opponentId={opponentId}
              opponentName={opponentName}
              onDone={() => {
                clearPendingFeedback()
                setFeedbackPhase(false)
                const scoreCb = onScoreSaved ?? onUpdated
                scoreCb()
              }}
            />
          </div>
        )
      })()}

      {isExpanded && !feedbackPhase && view.expansionKind === 'score-confirmation' && (
        <div className="action-card-expansion" onClick={event => event.stopPropagation()}>
          <ScoreConfirmationPanel
            tournament={tournament}
            match={match}
            currentPlayerId={currentPlayerId}
            onUpdated={onUpdated}
            onActionComplete={handleActionComplete}
          />
        </div>
      )}

      {isExpanded && !feedbackPhase && view.expansionKind === 'score-correction' && (
        <div className="action-card-expansion" onClick={event => event.stopPropagation()}>
          <InlineScoreEntry
            tournament={tournament}
            matchId={match.id}
            currentPlayerId={currentPlayerId}
            onSaved={onUpdated}
            onActionComplete={handleActionComplete}
            embedded
          />
        </div>
      )}

      {isExpanded && !feedbackPhase && view.expansionKind === 'schedule' && match.schedule && (
        <div className="action-card-expansion" onClick={event => event.stopPropagation()}>
          <UpcomingMatchPanel
            tournament={tournament}
            match={match}
            currentPlayerId={currentPlayerId}
            mode="schedule"
            onUpdated={onUpdated}
            onScoreSaved={onScoreSaved}
            onActionComplete={handleActionComplete}
            onScoreActionComplete={handleScoreActionComplete}
          />
        </div>
      )}
    </div>
  )
})

export default MatchActionCard
