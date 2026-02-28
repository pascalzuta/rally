import { useCallback } from "react";
import type { TournamentMatch, NearMiss } from "../types";
import { ordinal, formatDayTime } from "../helpers";
import { DAY_NAMES } from "../constants";

interface Props {
  match: TournamentMatch;
  nearMiss: NearMiss;
  playerNames: Record<string, string>;
  playerId: string;
  onAccept: (datetime: string, label: string) => void;
  onClose: () => void;
}

export default function FlexSheet({
  match,
  nearMiss,
  playerNames,
  playerId,
  onAccept,
  onClose,
}: Props) {
  const opponentId =
    match.homePlayerId === playerId ? match.awayPlayerId : match.homePlayerId;
  const opponentName = playerNames[opponentId] || "Unknown";
  const myId =
    match.homePlayerId === playerId ? match.homePlayerId : match.awayPlayerId;

  const isHome = match.homePlayerId === playerId;
  const mySlot = isHome ? nearMiss.slotA : nearMiss.slotB;
  const theirSlot = isHome ? nearMiss.slotB : nearMiss.slotA;

  const dayName = DAY_NAMES[nearMiss.dayOfWeek];
  const flexedLabel = formatDayTime(
    nearMiss.dayOfWeek,
    nearMiss.flexedWindow.startTime,
    nearMiss.flexedWindow.endTime,
  );

  const handleAccept = useCallback(() => {
    const datetime = `${nearMiss.date}T${nearMiss.flexedWindow.startTime}`;
    const label = `${dayName} ${nearMiss.date} at ${nearMiss.flexedWindow.startTime}`;
    onAccept(datetime, label);
  }, [nearMiss, dayName, onAccept]);

  return (
    <div className="flex-sheet">
      <div className="flex-sheet-header">
        <h3>Almost There!</h3>
        <p>
          vs {opponentName} &middot; {ordinal(match.round)} round
        </p>
      </div>

      <div className="flex-sheet-visual">
        <div className="flex-slot-row">
          <span className="flex-slot-label">You:</span>
          <span className="flex-slot-time">
            {mySlot.startTime} &ndash; {mySlot.endTime}
          </span>
        </div>
        <div className="flex-slot-row">
          <span className="flex-slot-label">{opponentName}:</span>
          <span className="flex-slot-time">
            {theirSlot.startTime} &ndash; {theirSlot.endTime}
          </span>
        </div>
        <div className="flex-gap-info">
          {nearMiss.gapMinutes > 0 ? (
            <span>{nearMiss.gapMinutes} min gap between slots</span>
          ) : (
            <span>{Math.abs(nearMiss.overlapMinutes)} min overlap</span>
          )}
        </div>
      </div>

      <div className="flex-suggestion">
        <p>{nearMiss.suggestion}</p>
      </div>

      <div className="flex-adjusted">
        <span className="flex-adjusted-label">Adjusted window:</span>
        <span className="flex-adjusted-time">{flexedLabel}</span>
      </div>

      <div className="flex-sheet-actions">
        <button className="btn-secondary" onClick={onClose}>
          Not Now
        </button>
        <button className="btn-primary" onClick={handleAccept}>
          Flex &amp; Schedule
        </button>
      </div>
    </div>
  );
}
