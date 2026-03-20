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
}

export default function UpcomingMatchPanel({
  tournament,
  match,
  currentPlayerId,
  onUpdated,
  onScoreSaved,
}: Props) {
  const showScoreEntry = canEnterScore(match, currentPlayerId)

  return (
    <div className="upcoming-match-panel">
      {match.schedule ? (
        <MatchSchedulePanel
          tournament={tournament}
          match={match}
          currentPlayerId={currentPlayerId}
          onUpdated={onUpdated}
        />
      ) : null}

      {showScoreEntry && (
        <div className="match-panel-section">
          <div className="match-panel-section-title">Report Score</div>
          <InlineScoreEntry
            tournament={tournament}
            matchId={match.id}
            currentPlayerId={currentPlayerId}
            onSaved={onScoreSaved ?? onUpdated}
          />
        </div>
      )}
    </div>
  )
}
