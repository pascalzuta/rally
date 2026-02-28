import React, { useState, useEffect, useCallback } from "react";
import type { Player, CitySearchResult } from "../types";
import { LEVEL_OPTIONS } from "../constants";
import { apiSearchCities } from "../api";

interface Props {
  player: Player;
  onComplete: (data: { name: string; city: string; county: string; level: string; ntrp: number }) => Promise<void>;
}

function SetupScreen({ player, onComplete }: Props) {
  const [step, setStep] = useState(1);
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
    }, 300);
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

  const handleNext = useCallback(() => {
    if (step === 1 && !name.trim()) return;
    if (step === 2 && !selectedCity) return;
    setStep((s) => s + 1);
  }, [step, name, selectedCity]);

  const handleFinish = useCallback(async () => {
    if (!selectedCity || !level) return;
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

  const canProceed =
    (step === 1 && name.trim().length > 0) ||
    (step === 2 && selectedCity !== null) ||
    (step === 3 && level !== "");

  return (
    <div className="setup-screen">
      <div className="setup-progress">
        {[1, 2, 3].map((dot) => (
          <span
            key={dot}
            className={`progress-dot${dot === step ? " progress-dot--active" : ""}${dot < step ? " progress-dot--done" : ""}`}
          />
        ))}
      </div>

      {step === 1 && (
        <div className="setup-step">
          <h2>What's your name?</h2>
          <p className="setup-hint">This is how other players will see you.</p>
          <input
            type="text"
            className="setup-input"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <button
            className="setup-btn"
            onClick={handleNext}
            disabled={!canProceed}
          >
            Continue
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="setup-step">
          <h2>Where do you play?</h2>
          <p className="setup-hint">Search for your city to find local tournaments.</p>
          <input
            type="text"
            className="setup-input"
            placeholder="Search city..."
            value={cityQuery}
            onChange={(e) => {
              setCityQuery(e.target.value);
              setSelectedCity(null);
            }}
            autoFocus
          />
          {cityResults.length > 0 && (
            <ul className="city-results">
              {cityResults.map((r) => (
                <li
                  key={`${r.city}-${r.county}`}
                  className="city-result-item"
                  onClick={() => handleCitySelect(r)}
                >
                  {r.city} — {r.county}, {r.stateCode}
                </li>
              ))}
            </ul>
          )}
          {selectedCity && (
            <p className="setup-selected">
              {selectedCity.city}, {selectedCity.county}
            </p>
          )}
          <button
            className="setup-btn"
            onClick={handleNext}
            disabled={!canProceed}
          >
            Continue
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="setup-step">
          <h2>What's your skill level?</h2>
          <p className="setup-hint">We'll match you with similar players.</p>
          <div className="level-options">
            {LEVEL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`level-option${level === opt.value ? " level-option--selected" : ""}`}
                onClick={() => handleLevelSelect(opt.value, opt.ntrp)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {error && <p className="setup-error">{error}</p>}

          <button
            className="setup-btn setup-btn--finish"
            onClick={handleFinish}
            disabled={!canProceed || saving}
          >
            {saving ? "Saving..." : "Let's Go!"}
          </button>
        </div>
      )}
    </div>
  );
}

export default SetupScreen;
