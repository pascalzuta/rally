/**
 * NeedsYouBlock — Compact action inbox on Home.
 *
 * Surfaces pending actions that live on other tabs (Bracket, Messages)
 * as label + count + chevron rows. Taps route to the right destination
 * with an optional focus target.
 *
 * Hidden when all counts are zero.
 *
 * Row order (most urgent first):
 *   1. Score confirmations (48h expiring → time-sensitive)
 *   2. Matches needing a time
 *   3. Proposed times to accept
 *   4. Unread messages
 *
 * Left accent flips orange when any score-confirm is <6h to expiry.
 * Otherwise blue.
 */
import type { PendingActions, ScoreConfirmEntry } from '../hooks/usePendingActions'

interface Props {
  actions: PendingActions
  onGoToBracket: (focusMatchId?: string) => void
  onOpenMessages: () => void
}

function formatHoursLeft(msRemaining: number): string {
  const hours = Math.floor(msRemaining / (60 * 60 * 1000))
  if (hours < 1) {
    const minutes = Math.max(1, Math.floor(msRemaining / (60 * 1000)))
    return `${minutes}m left`
  }
  return `${hours}h left`
}

export default function NeedsYouBlock({ actions, onGoToBracket, onOpenMessages }: Props) {
  const {
    needsScheduling,
    needsAccept,
    scoreConfirmPending,
    unreadMessages,
    hasUrgentScoreConfirm,
  } = actions

  const totalRows =
    scoreConfirmPending.length +
    (needsScheduling > 0 ? 1 : 0) +
    (needsAccept > 0 ? 1 : 0) +
    (unreadMessages > 0 ? 1 : 0)

  if (totalRows === 0) return null

  const accentClass = hasUrgentScoreConfirm
    ? 'needs-you--urgent'
    : 'needs-you--info'

  return (
    <div className={`needs-you ${accentClass}`} role="region" aria-label="Pending actions">
      <div className="needs-you-heading">NEEDS YOU</div>
      <ul className="needs-you-rows">
        {scoreConfirmPending.map((entry: ScoreConfirmEntry) => (
          <li key={`score-${entry.matchId}`}>
            <button
              type="button"
              className={`needs-you-row ${entry.urgent ? 'needs-you-row--urgent' : ''}`}
              onClick={() => onGoToBracket(entry.matchId)}
              aria-label={`Score to confirm versus ${entry.opponentName}, ${formatHoursLeft(entry.msRemaining)}. Opens Tournament tab.`}
            >
              <span className="needs-you-count">1</span>
              <span className="needs-you-label">
                score to confirm · vs {entry.opponentName}
                <span className="needs-you-meta"> · {formatHoursLeft(entry.msRemaining)}</span>
              </span>
              <span className="needs-you-dest">Tournament →</span>
            </button>
          </li>
        ))}

        {needsScheduling > 0 && (
          <li>
            <button
              type="button"
              className="needs-you-row"
              onClick={() => onGoToBracket()}
              aria-label={`${needsScheduling} matches need a time. Opens Tournament tab.`}
            >
              <span className="needs-you-count">{needsScheduling}</span>
              <span className="needs-you-label">
                {needsScheduling === 1 ? 'match needs a time' : 'matches need a time'}
              </span>
              <span className="needs-you-dest">Tournament →</span>
            </button>
          </li>
        )}

        {needsAccept > 0 && (
          <li>
            <button
              type="button"
              className="needs-you-row"
              onClick={() => onGoToBracket()}
              aria-label={`${needsAccept} proposed times to accept. Opens Tournament tab.`}
            >
              <span className="needs-you-count">{needsAccept}</span>
              <span className="needs-you-label">
                {needsAccept === 1 ? 'proposed time to accept' : 'proposed times to accept'}
              </span>
              <span className="needs-you-dest">Tournament →</span>
            </button>
          </li>
        )}

        {unreadMessages > 0 && (
          <li>
            <button
              type="button"
              className="needs-you-row"
              onClick={onOpenMessages}
              aria-label={`${unreadMessages} unread messages. Opens messages.`}
            >
              <span className="needs-you-count">{unreadMessages}</span>
              <span className="needs-you-label">
                {unreadMessages === 1 ? 'unread message' : 'unread messages'}
              </span>
              <span className="needs-you-dest">Messages →</span>
            </button>
          </li>
        )}
      </ul>
    </div>
  )
}
