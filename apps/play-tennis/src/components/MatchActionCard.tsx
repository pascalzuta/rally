import { forwardRef, useState, useCallback, useRef } from 'react'
import { Tournament, Match } from '../types'
import { hasUnreadFrom } from '../store'
import { getMatchCardView } from '../matchCardModel'
import { useToast, ConfirmationTone } from './Toast'
import MessagePanel from './MessagePanel'
import UpcomingMatchPanel from './UpcomingMatchPanel'
import ScoreConfirmationPanel from './ScoreConfirmationPanel'
import InlineScoreEntry from './InlineScoreEntry'

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
  const collapseTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const highlightTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

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
    setHighlightTone(tone)

    if (collapseTimer.current) clearTimeout(collapseTimer.current)
    collapseTimer.current = setTimeout(() => {
      setHighlightTone(null)
      const scoreCb = onScoreSaved ?? onUpdated
      scoreCb()
    }, 3000)
  }, [showConfirmation, onUpdated, onScoreSaved])

  const view = getMatchCardView(tournament, match, currentPlayerId)
  const canToggleExpanded = Boolean(view.primaryActionLabel && view.expansionKind)
  const hasUnread = view.opponentId ? hasUnreadFrom(currentPlayerId, view.opponentId) : false
  const highlightClass = highlightTone ? `action-card--highlight-${highlightTone}` : ''
  const classes = ['action-card', `action-${view.tone}`, highlightClass, className].filter(Boolean).join(' ')
  const toneClass = view.tone === 'completed'
    ? 'slate'
    : view.tone === 'confirm-score'
      ? 'blue'
      : view.tone === 'confirmed'
        ? 'green'
        : view.tone === 'escalated'
          ? 'red'
          : 'purple'

  return (
    <div
      ref={ref}
      className={classes}
      style={style}
      onClick={canToggleExpanded ? onToggleExpanded : undefined}
      >
      <div className="action-card-status-row">
        <div className={`card-status-label card-status-label--${toneClass}`}>
          {view.statusLabel}
        </div>
        {(view.metaLabel || view.infoTooltipText) && (
          <div className="action-card-status-meta">
            {view.metaLabel && <div className={`card-meta-chip card-meta-chip--${toneClass}`}>{view.metaLabel}</div>}
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
        <div className="action-card-opponent">{view.title}</div>
        {view.supporting && (
          <div className={`action-card-supporting ${view.supportingTone === 'danger' ? 'action-card-supporting--danger' : ''}`}>
            {view.supporting}
          </div>
        )}
      </div>

      {(view.primaryActionLabel || (view.isMyMatch && view.opponentId)) && (
        <div className="action-card-buttons">
          {view.primaryActionLabel && (
            <button
              className="action-card-btn"
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

      {isExpanded && view.expansionKind === 'score-confirmation' && (
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

      {isExpanded && view.expansionKind === 'score-correction' && (
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

      {isExpanded && view.expansionKind === 'schedule' && match.schedule && (
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
