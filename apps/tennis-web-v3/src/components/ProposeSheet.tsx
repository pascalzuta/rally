import { useState, useCallback, useMemo } from "react";
import type { TournamentMatch, AvailabilitySlot } from "../types";
import { ordinal } from "../helpers";
import { SHORT_DAYS } from "../constants";

interface Props {
  match: TournamentMatch;
  mySlots: AvailabilitySlot[];
  playerNames: Record<string, string>;
  playerId: string;
  onPropose: (times: Array<{ datetime: string; label: string }>) => void;
  onClose: () => void;
}

interface SlotOption {
  datetime: string;
  label: string;
  key: string;
}

function generateOccurrences(slot: AvailabilitySlot): SlotOption[] {
  const occurrences: SlotOption[] = [];
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (let d = 0; d < 14; d++) {
    const date = new Date(today.getTime() + d * 86400000);
    if (date.getDay() !== slot.dayOfWeek) continue;

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const dateStr = `${year}-${month}-${day}`;

    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];

    const dayName = SHORT_DAYS[date.getDay()];
    const label = `${dayName} ${date.getDate()} ${months[date.getMonth()]} \u00B7 ${slot.startTime}`;
    const datetime = `${dateStr}T${slot.startTime}`;
    const key = `${dateStr}-${slot.startTime}`;

    occurrences.push({ datetime, label, key });
  }

  return occurrences;
}

export default function ProposeSheet({
  match,
  mySlots,
  playerNames,
  playerId,
  onPropose,
  onClose,
}: Props) {
  const opponentId =
    match.homePlayerId === playerId ? match.awayPlayerId : match.homePlayerId;
  const opponentName = playerNames[opponentId] || "Unknown";

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allOptions = useMemo(() => {
    const opts: SlotOption[] = [];
    for (const slot of mySlots) {
      opts.push(...generateOccurrences(slot));
    }
    opts.sort((a, b) => a.datetime.localeCompare(b.datetime));
    return opts;
  }, [mySlots]);

  const handleToggle = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else if (next.size < 3) {
        next.add(key);
      }
      return next;
    });
  }, []);

  const handlePropose = useCallback(() => {
    const times = allOptions
      .filter((opt) => selected.has(opt.key))
      .map((opt) => ({ datetime: opt.datetime, label: opt.label }));
    onPropose(times);
  }, [allOptions, selected, onPropose]);

  return (
    <div className="propose-sheet">
      <div className="propose-sheet-header">
        <h3>Propose Times</h3>
        <p>
          vs {opponentName} &middot; {ordinal(match.round)} round
        </p>
        <p className="propose-sheet-hint">
          Select up to 3 times ({selected.size}/3 selected)
        </p>
      </div>

      <div className="propose-sheet-options">
        {allOptions.length === 0 && (
          <p className="propose-empty">
            No availability slots set. Add your availability in the Profile tab.
          </p>
        )}
        {allOptions.map((opt) => {
          const isSelected = selected.has(opt.key);
          return (
            <button
              key={opt.key}
              className={`propose-option-btn ${isSelected ? "propose-option-btn--selected" : ""}`}
              onClick={() => handleToggle(opt.key)}
              disabled={!isSelected && selected.size >= 3}
            >
              <span className="propose-option-check">
                {isSelected ? "\u2611" : "\u2610"}
              </span>
              <span className="propose-option-label">{opt.label}</span>
            </button>
          );
        })}
      </div>

      <div className="propose-sheet-actions">
        <button className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn-primary"
          disabled={selected.size === 0}
          onClick={handlePropose}
        >
          Send Proposal
        </button>
      </div>
    </div>
  );
}
