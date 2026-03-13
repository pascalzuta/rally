import { MatchResult } from '../store'
import { Tournament } from '../types'
import ScoreEntryFullScreen from './ScoreEntryFullScreen'

interface Props {
  tournament: Tournament
  matchId: string
  onClose: () => void
  onSaved: (result?: MatchResult) => void
}

export default function MatchScoreModal({ tournament, matchId, onClose, onSaved }: Props) {
  return (
    <ScoreEntryFullScreen
      tournament={tournament}
      matchId={matchId}
      onClose={onClose}
      onSaved={onSaved}
    />
  )
}
