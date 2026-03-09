import { useState, useEffect, useCallback } from "react";
import type { Player, CitySearchResult } from "../types";
import { LEVEL_OPTIONS } from "../constants";
import { apiSearchCities } from "../api";

interface Props {
  player: Player;
  onComplete: (data: { name: string; city: string; county: string; level: string; ntrp: number }) => void;
}

function SetupScreen({ player, onComplete }: Props) {
  const [name, setName] = useState(player.name || player.email.split("@")[0] || "");
  const [cityQuery, setCityQuery] = useState("");
  const [cityResults, setCityResults] = useState<CitySearchResult[]>([]);
  const [selectedCity, setSelectedCity] = useState<CitySearchResult | null>(null);
  const [level, setLevel] = useState("");
  const [ntrp, setNtrp] = useState(3.0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced city search
  useEffect(() => {
    if (cityQuery.length < 2) {
      setCityResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      const results = await apiSearchCities(cityQuery);
      setCityResults(results);
    }, 250);
    return () => clearTimeout(timeout);
  }, [cityQuery]);

  const handleCitySelect = useCallback((result: CitySearchResult) => {
    setSelectedCity(result);
    setCityQuery(result.city);
    setCityResults([]);
  }, []);

  const handleLevelSelect = useCallback((value: string, ntrpValue: number) => {
    setLevel(value);
    setNtrp(ntrpValue);
  }, []);

  const handleFinish = useCallback(async () => {
    if (!name.trim() || !selectedCity || !level) return;
    setSaving(true);
    setError(null);
    try {
      await onComplete({
        name: name.trim(),
        city: selectedCity.city,
        county: selectedCity.county,
        level,
        ntrp,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed. Please try again.");
      setSaving(false);
    }
  }, [name, selectedCity, level, ntrp, onComplete]);

  return (
    <div className="setup-screen">
      <div className="setup-header">
        <h2>Complete Your Profile</h2>
      </div>

      <form
        className="setup-form"
        onSubmit={(e) => {
          e.preventDefault();
          handleFinish();
        }}
      >
        <label className="setup-label">Name</label>
        <input
          type="text"
          className="setup-input"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />

        <label className="setup-label">City</label>
        <input
          type="text"
          className="setup-input"
          placeholder="Search city..."
          value={cityQuery}
          onChange={(e) => {
            setCityQuery(e.target.value);
            setSelectedCity(null);
          }}
        />
        {cityResults.length > 0 && (
          <div className="city-dropdown">
            {cityResults.map((r) => (
              <div
                key={`${r.city}-${r.county}`}
                className="city-option"
                onClick={() => handleCitySelect(r)}
              >
                {r.city} — {r.county}, {r.stateCode}
              </div>
            ))}
          </div>
        )}

        <label className="setup-label">County</label>
        <input
          type="text"
          className="setup-input"
          placeholder="County (auto-filled)"
          value={selectedCity?.county ?? ""}
          readOnly
        />

        <label className="setup-label">Skill Level</label>
        <select
          className="setup-select"
          value={level}
          onChange={(e) => {
            const opt = LEVEL_OPTIONS.find((o) => o.value === e.target.value);
            if (opt) handleLevelSelect(opt.value, opt.ntrp);
          }}
        >
          <option value="" disabled>
            Select your level
          </option>
          {LEVEL_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {error && <p className="login-error">{error}</p>}

        <button
          type="submit"
          className="login-btn"
          disabled={!name.trim() || !selectedCity || !level || saving}
        >
          {saving ? "Saving..." : "Let's Go!"}
        </button>
      </form>
    </div>
  );
}

export default SetupScreen;
