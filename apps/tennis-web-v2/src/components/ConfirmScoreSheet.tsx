import { useCallback } from "react";
import type { TournamentMatch, SetScore } from "../types";
import { formatScore, ordinal } from "../helpers";

interface Props {
  match: TournamentMatch;
  playerNames: Record<string, string>;
  playerId: string;
  onConfirm: (
    matchId: string,
    tournamentId: string,
    winnerId: string,
    sets: SetScore[],
  ) => void;
  onClose: () => void;
}

export default function ConfirmScoreSheet({
  match,
  playerNames,
  playerId,
  onConfirm,
  onClose,
}: Props) {
  const pending = match.pendingResult;
  if (!pending) return null;

  const reporterName = playerNames[pending.reportedBy] || "Opponent";
  const winnerId = pending.winnerId;
  const winnerName = playerNames[winnerId] || "Unknown";
  const opponentId =
    match.homePlayerId === playerId ? match.awayPlayerId : match.homePlayerId;
  const opponentName = playerNames[opponentId] || "Unknown";

  const didIWin = winnerId === playerId;
  const scoreText = formatScore(pending.sets);

  const handleConfirm = useCallback(() => {
    onConfirm(match.id, match.tournamentId, pending.winnerId, pending.sets);
  }, [match.id, match.tournamentId, pending.winnerId, pending.sets, onConfirm]);

  return (
    <div className="confirm-score-sheet">
      <div className="confirm-score-header">
        <h3>Confirm Score</h3>
        <p>
          vs {opponentName} &middot; {ordinal(match.round)} round
        </p>
      </div>

      <div className="confirm-score-report">
        <p className="confirm-score-reporter">
          {reporterName} reported this score:
        </p>
        <div className="confirm-score-result">
          <span className="confirm-score-winner">
            {didIWin ? "You" : winnerName} won
          </span>
          <span className="confirm-score-value">{scoreText}</span>
        </div>
      </div>

      <div className="confirm-score-actions">
        <button className="btn-secondary" onClick={onClose}>
          Dispute
        </button>
        <button className="btn-primary" onClick={handleConfirm}>
          Confirm
        </button>
      </div>
    </div>
  );
}
