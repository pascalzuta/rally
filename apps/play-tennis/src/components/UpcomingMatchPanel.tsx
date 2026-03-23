import InlineScoreEntry from './InlineScoreEntry'
import MatchSchedulePanel from './MatchSchedulePanel'
import { Tournament, Match } from '../types'
import { canEnterScore } from '../matchCapabilities'

interface Props {
  tournament: Tournament
  match: Match
  currentPlayerId: string
  onUpdated: () => void
  onScoreSaved?: () => void
  mode?: 'auto' | 'schedule' | 'score'
}

export default function UpcomingMatchPanel({
  tournament,
  match,
  currentPlayerId,
  onUpdated,
  onScoreSaved,
  mode = 'auto',
}: Props) {
  const showScoreEntry = canEnterScore(match, currentPlayerId)
  const showScorePanel = showScoreEntry && mode !== 'schedule'
  const showSchedulePanel = Boolean(match.schedule) && !showScorePanel

  return (
    <div className="upcoming-match-panel">
      {showSchedulePanel && match.schedule ? (
        <MatchSchedulePanel
          tournament={tournament}
          match={match}
          currentPlayerId={currentPlayerId}
          onUpdated={onUpdated}
          onScoreSaved={onScoreSaved ?? onUpdated}
        />
      ) : null}

      {showScorePanel && (
        <InlineScoreEntry
          tournament={tournament}
          matchId={match.id}
          currentPlayerId={currentPlayerId}
          onSaved={onScoreSaved ?? onUpdated}
        />
      )}
    </div>
  )
}
