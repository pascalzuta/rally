/**
 * ScoreConfirmBanner — Defense in depth for the 48h score-confirm window.
 *
 * Renders ONLY when there's a pending score-confirmation with <6h to expiry.
 * Intentionally redundant with the NeedsYouBlock row. High-stakes,
 * time-sensitive: if the user misses the window, they lose the ability
 * to dispute the score and it auto-confirms against them.
 *
 * One-line orange strip above Up Next (or above activation if no Up Next).
 */
import type { PendingActions } from '../hooks/usePendingActions'

interface Props {
  actions: PendingActions
  onGoToBracket: (focusMatchId?: string) => void
}

function formatHoursLeft(msRemaining: number): string {
  const hours = Math.floor(msRemaining / (60 * 60 * 1000))
  if (hours < 1) {
    const minutes = Math.max(1, Math.floor(msRemaining / (60 * 1000)))
    return `${minutes}m`
  }
  return `${hours}h`
}

export default function ScoreConfirmBanner({ actions, onGoToBracket }: Props) {
  // Only render for urgent entries. Non-urgent entries live in NeedsYouBlock.
  const urgent = actions.scoreConfirmPending.filter(e => e.urgent)
  if (urgent.length === 0) return null

  // Most-urgent (already sorted by the derivation)
  const entry = urgent[0]
  const extraCount = urgent.length - 1

  return (
    <button
      type="button"
      className="score-confirm-banner"
      onClick={() => onGoToBracket(entry.matchId)}
      aria-live="polite"
      aria-label={`Urgent: confirm score versus ${entry.opponentName}, ${formatHoursLeft(entry.msRemaining)} left. Opens Tournament tab.`}
    >
      <span className="score-confirm-banner-icon" aria-hidden="true">⚠</span>
      <span className="score-confirm-banner-text">
        Confirm score vs {entry.opponentName}
        {extraCount > 0 ? ` (+${extraCount} more)` : ''}
      </span>
      <span className="score-confirm-banner-time">{formatHoursLeft(entry.msRemaining)} left</span>
    </button>
  )
}
