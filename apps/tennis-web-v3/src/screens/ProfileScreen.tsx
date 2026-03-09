import { useState, useEffect } from "react";
import type { Player, AvailabilitySlot, AvailabilityImpactSuggestion } from "../types";
import { formatDayTime } from "../helpers";
import { DAY_NAMES } from "../constants";

interface Props {
  player: Player;
  availability: AvailabilitySlot[];
  impactSuggestions: AvailabilityImpactSuggestion[];
  onSaveAvailability: (slots: Array<{ dayOfWeek: number; startTime: string; endTime: string }>) => void | Promise<void>;
  onSignOut: () => void;
}

export default function ProfileScreen({
  player,
  availability,
  impactSuggestions,
  onSaveAvailability,
  onSignOut,
}: Props) {
  const [slots, setSlots] = useState<Array<{ dayOfWeek: number; startTime: string; endTime: string }>>(
    availability.map((s) => ({ dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime }))
  );
  const [newDay, setNewDay] = useState(0);
  const [newStart, setNewStart] = useState("09:00");
  const [newEnd, setNewEnd] = useState("12:00");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // Sync local slots when availability prop changes (after save or external refresh)
  useEffect(() => {
    setSlots(availability.map((s) => ({ dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime })));
  }, [availability]);

  const handleDeleteSlot = (index: number) => {
    setSlots((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddSlot = () => {
    setSlots((prev) => [...prev, { dayOfWeek: newDay, startTime: newStart, endTime: newEnd }]);
  };

  const handleSave = async () => {
    if (slots.length === 0) {
      const confirmed = window.confirm(
        "Clear all availability? Matches won't be auto-scheduled."
      );
      if (!confirmed) return;
    }
    setSaveStatus("saving");
    try {
      await onSaveAvailability(slots);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  };

  const subscriptionLabel =
    player.subscription === "active"
      ? "Active"
      : player.subscription === "free"
        ? "Free"
        : "Cancelled";

  return (
    <div className="profile-screen">
      <div className="profile-header">
        <h1>Profile</h1>
      </div>

      {/* Player Card */}
      <div className="player-card">
        <div className="player-card-name">{player.name || player.email.split("@")[0]}</div>
        <div className="player-card-email">{player.email}</div>
        <div className="player-card-info">
          <span>{player.county}</span>
        </div>
        <div className="player-card-info">
          <span className="badge-ntrp">NTRP {player.ntrp}</span>
          <span className="badge-rating">Rating {player.rating}</span>
          <span>
            {player.wins}W-{player.losses}L
          </span>
          <span className="badge-subscription">{subscriptionLabel}</span>
        </div>
      </div>

      {/* Availability Section */}
      <div className="availability-section">
        <h2 className="section-title">Availability</h2>

        {slots.length > 0 && (
          <div>
            {slots.map((slot, i) => (
              <span key={i} className="slot-chip">
                {formatDayTime(slot.dayOfWeek, slot.startTime, slot.endTime)}
                <button
                  className="slot-delete"
                  onClick={() => handleDeleteSlot(i)}
                  aria-label={`Remove ${formatDayTime(slot.dayOfWeek, slot.startTime, slot.endTime)}`}
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="avail-form">
          <div className="avail-form-row">
            <select
              className="avail-input"
              value={newDay}
              onChange={(e) => setNewDay(Number(e.target.value))}
            >
              {DAY_NAMES.map((name, i) => (
                <option key={i} value={i}>
                  {name}
                </option>
              ))}
            </select>
            <input
              type="time"
              className="avail-input"
              value={newStart}
              onChange={(e) => setNewStart(e.target.value)}
            />
            <input
              type="time"
              className="avail-input"
              value={newEnd}
              onChange={(e) => setNewEnd(e.target.value)}
            />
            <button className="avail-add-btn" onClick={handleAddSlot}>
              Add
            </button>
          </div>
        </div>

        <button className="avail-save-btn" onClick={handleSave} disabled={saveStatus === "saving"}>
          {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved!" : saveStatus === "error" ? "Failed — Try Again" : "Save Availability"}
        </button>
      </div>

      {/* Impact Suggestions */}
      <div className="impact-section">
        <h2 className="section-title">Scheduling Suggestions</h2>
        {availability.length < 3 ? (
          <p>Add more availability to unlock smarter scheduling suggestions</p>
        ) : impactSuggestions.length > 0 ? (
          impactSuggestions.map((suggestion, i) => (
            <div key={i} className="impact-card">
              <span className="impact-slot">{suggestion.slot.label}</span>
              {" would auto-schedule "}
              <span className="impact-count">{suggestion.matchesUnlocked}</span>
              {" more match"}
              {suggestion.matchesUnlocked !== 1 ? "es" : ""}
            </div>
          ))
        ) : (
          <p>No suggestions available right now.</p>
        )}
      </div>

      {/* Sign Out */}
      <button className="signout-btn" onClick={onSignOut}>
        Sign Out
      </button>
    </div>
  );
}
