import React, { useState, useMemo, useCallback } from "react";
import type { Player, AvailabilitySlot, AvailabilityImpactSuggestion } from "../types";
import { DAY_NAMES, SHORT_DAYS } from "../constants";
import { formatDayTime } from "../helpers";

interface Props {
  player: Player;
  availability: AvailabilitySlot[];
  impactSuggestions: AvailabilityImpactSuggestion[];
  onSaveAvailability: (slots: Array<{ dayOfWeek: number; startTime: string; endTime: string }>) => void;
  onSignOut: () => void;
}

function ProfileScreen({
  player,
  availability,
  impactSuggestions,
  onSaveAvailability,
  onSignOut,
}: Props) {
  const [slots, setSlots] = useState<Array<{ dayOfWeek: number; startTime: string; endTime: string }>>(
    () => availability.map((s) => ({ dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime }))
  );
  const [newDay, setNewDay] = useState(1);
  const [newStart, setNewStart] = useState("08:00");
  const [newEnd, setNewEnd] = useState("10:00");

  const initial = useMemo(
    () =>
      availability.map((s) => `${s.dayOfWeek}-${s.startTime}-${s.endTime}`).sort().join(","),
    [availability]
  );

  const current = useMemo(
    () =>
      slots.map((s) => `${s.dayOfWeek}-${s.startTime}-${s.endTime}`).sort().join(","),
    [slots]
  );

  const hasChanges = initial !== current;

  const handleRemoveSlot = useCallback((index: number) => {
    setSlots((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleAddSlot = useCallback(() => {
    if (!newStart || !newEnd) return;
    if (newStart >= newEnd) return;
    setSlots((prev) => [...prev, { dayOfWeek: newDay, startTime: newStart, endTime: newEnd }]);
  }, [newDay, newStart, newEnd]);

  const handleSave = useCallback(() => {
    if (slots.length === 0) {
      const proceed = confirm(
        "You're about to remove all availability. This means your matches can't be auto-scheduled. Continue?",
      );
      if (!proceed) return;
    }
    onSaveAvailability(slots);
  }, [slots, onSaveAvailability]);

  const firstName = (player.name || "?").charAt(0).toUpperCase();
  const totalMatches = player.wins + player.losses;
  const topSuggestion = impactSuggestions.length > 0 ? impactSuggestions[0] : null;

  return (
    <div className="profile-screen">
      {/* Player Card */}
      <div className="player-card">
        <div className="avatar-circle">{firstName}</div>
        <div className="player-card-info">
          <h2 className="player-card-name">{player.name || player.email}</h2>
          <p className="player-card-location">
            {player.city}, {player.county}
          </p>
          <div className="player-card-badges">
            <span className="badge badge-rating">{player.rating.toFixed(1)}</span>
            <span className="badge badge-level">{player.level}</span>
          </div>
          <p className="player-card-record">
            {player.wins}W &ndash; {player.losses}L
            {totalMatches > 0 && (
              <span className="player-card-winrate">
                {" "}({Math.round((player.wins / totalMatches) * 100)}%)
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Availability */}
      <section className="availability-section">
        <h3 className="section-title">Your Availability</h3>

        {slots.length === 0 ? (
          <p className="empty-text">No availability slots set.</p>
        ) : (
          <div className="slot-chips">
            {slots.map((s, i) => (
              <span key={i} className="slot-chip">
                {formatDayTime(s.dayOfWeek, s.startTime, s.endTime)}
                <button
                  className="slot-chip-remove"
                  onClick={() => handleRemoveSlot(i)}
                  aria-label="Remove slot"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="add-slot-row">
          <select
            className="add-slot-day"
            value={newDay}
            onChange={(e) => setNewDay(Number(e.target.value))}
          >
            {DAY_NAMES.map((name, idx) => (
              <option key={idx} value={idx}>
                {SHORT_DAYS[idx]}
              </option>
            ))}
          </select>
          <input
            type="time"
            className="add-slot-time"
            value={newStart}
            onChange={(e) => setNewStart(e.target.value)}
          />
          <span className="add-slot-separator">&ndash;</span>
          <input
            type="time"
            className="add-slot-time"
            value={newEnd}
            onChange={(e) => setNewEnd(e.target.value)}
          />
          <button className="add-slot-btn" onClick={handleAddSlot}>
            Add
          </button>
        </div>

        {hasChanges && (
          <button className="save-availability-btn" onClick={handleSave}>
            Save Availability
          </button>
        )}

        {/* Impact hints */}
        {topSuggestion ? (
          <div className="impact-hint">
            <span className="impact-icon" role="img" aria-label="tip">
              💡
            </span>
            <span className="impact-text">
              Adding {topSuggestion.slot.label} would help schedule{" "}
              {topSuggestion.matchesUnlocked} more match
              {topSuggestion.matchesUnlocked !== 1 ? "es" : ""}
            </span>
          </div>
        ) : slots.length < 3 ? (
          <div className="impact-hint">
            <span className="impact-icon" role="img" aria-label="tip">
              💡
            </span>
            <span className="impact-text">
              Adding more availability windows increases your chances of auto-scheduled matches
            </span>
          </div>
        ) : null}
      </section>

      {/* Settings */}
      <section className="settings-section">
        <button className="settings-btn settings-btn--edit">Edit Profile</button>
        <button className="settings-btn settings-btn--signout" onClick={onSignOut}>
          Sign Out
        </button>
        <p className="app-version">Rally v2.0</p>
      </section>
    </div>
  );
}

export default ProfileScreen;
