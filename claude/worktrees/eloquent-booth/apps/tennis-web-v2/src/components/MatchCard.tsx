import { useState, useCallback } from "react";
import type { TournamentMatch } from "../types";
import { formatDate, formatScore, tierLabel, tierColor, ordinal, matchCountdown } from "../helpers";
import { DAY_NAMES } from "../constants";

interface Props {
  match: TournamentMatch;
  playerNames: Record<string, string>;
  playerId: string;
  onAction?: (match: TournamentMatch) => void;
}

function getTierIcon(tier?: 1 | 2 | 3): string {
  switch (tier) {
    case 1:
      return "\u2705";
    case 2:
      return "\uD83D\uDD04";
    case 3:
      return "\uD83D\uDCE4";
    default:
      return "\u23F1";
  }
}

function needsAction(match: TournamentMatch, playerId: string): boolean {
  if (match.status === "completed") return false;
  if (match.pendingResult && match.pendingResult.reportedBy !== playerId) return true;
  if (match.status === "scheduled" && !match.result && !match.pendingResult) return true;
  if (match.schedulingTier === 2 && match.nearMiss) return true;
  if (match.schedulingTier === 3) return true;
  return false;
}

function getActionLabel(match: TournamentMatch, playerId: string): string {
  if (match.pendingResult && match.pendingResult.reportedBy !== playerId) return "Confirm Score";
  if (match.status === "scheduled" && !match.result && !match.pendingResult) return "Enter Score";
  if (match.schedulingTier === 2 && match.nearMiss) return "Flex?";
  if (match.schedulingTier === 3) return "Schedule";
  return "Action";
}

export default function MatchCard({ match, playerNames, playerId, onAction }: Props) {
  const [expanded, setExpanded] = useState(false);

  const opponentId = match.homePlayerId === playerId ? match.awayPlayerId : match.homePlayerId;
  const opponentName = playerNames[opponentId] || "Unknown";

  const handleToggle = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const handleAction = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onAction?.(match);
    },
    [match, onAction],
  );

  const showAction = onAction && needsAction(match, playerId);

  return (
    <div
      className={`match-card ${expanded ? "match-card--expanded" : ""}`}
      onClick={handleToggle}
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
    >
      <div className="match-card-summary">
        <span className="match-card-opponent">{opponentName}</span>
        <span className="match-status-icon" style={{ color: tierColor(match.schedulingTier) }}>
          {getTierIcon(match.schedulingTier)}
        </span>
        <span className="match-card-schedule">
          {match.scheduledAt
            ? formatDate(match.scheduledAt)
            : tierLabel(match.schedulingTier)}
        </span>
        {match.result?.sets && (
          <span className="match-card-score">
            {formatScore(match.result.sets)}
            {match.result.winnerId === playerId ? " W" : " L"}
          </span>
        )}
        {showAction && (
          <button className="match-card-action" onClick={handleAction}>
            {getActionLabel(match, playerId)}
          </button>
        )}
      </div>

      {expanded && (
        <div className="match-card-details">
          <div className="match-card-detail-row">
            <span className="match-card-detail-label">Round:</span>
            <span>{ordinal(match.round)}</span>
          </div>
          <div className="match-card-detail-row">
            <span className="match-card-detail-label">Status:</span>
            <span>{match.status}</span>
          </div>
          {match.scheduledAt && (
            <div className="match-card-detail-row">
              <span className="match-card-detail-label">Countdown:</span>
              <span>{matchCountdown(match.scheduledAt)}</span>
            </div>
          )}
          {match.schedulingTier && (
            <div className="match-card-detail-row">
              <span className="match-card-detail-label">Scheduling:</span>
              <span style={{ color: tierColor(match.schedulingTier) }}>
                {tierLabel(match.schedulingTier)}
              </span>
            </div>
          )}
          {match.nearMiss && (
            <div className="match-card-detail-row">
              <span className="match-card-detail-label">Near miss:</span>
              <span>
                {DAY_NAMES[match.nearMiss.dayOfWeek]} &mdash; {match.nearMiss.suggestion}
              </span>
            </div>
          )}
          {match.proposals && match.proposals.length > 0 && (
            <div className="match-card-detail-row">
              <span className="match-card-detail-label">Proposals:</span>
              <span>
                {match.proposals.map((p) => p.label).join(", ")}
              </span>
            </div>
          )}
          {match.result && (
            <div className="match-card-detail-row">
              <span className="match-card-detail-label">Result:</span>
              <span>
                {match.result.sets ? formatScore(match.result.sets) : match.result.score || "N/A"}
                {" "}
                ({match.result.winnerId === playerId ? "Won" : "Lost"})
              </span>
            </div>
          )}
          {match.pendingResult && (
            <div className="match-card-detail-row">
              <span className="match-card-detail-label">Pending:</span>
              <span>
                {formatScore(match.pendingResult.sets)} &mdash; reported by{" "}
                {playerNames[match.pendingResult.reportedBy] || "opponent"}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
