import { useState, useCallback, useMemo } from "react";
import type { TournamentMatch, Tournament, SetScore } from "../types";
import { ordinal, buildScorePreview } from "../helpers";

interface Props {
  match: TournamentMatch;
  tournament: Tournament;
  playerNames: Record<string, string>;
  playerId: string;
  onSubmit: (
    matchId: string,
    tournamentId: string,
    winnerId: string,
    sets: Array<{ aGames: number; bGames: number; tiebreak?: { aPoints: number; bPoints: number } }>,
  ) => void;
  onClose: () => void;
}

interface SetInput {
  a: string;
  b: string;
  tbA: string;
  tbB: string;
}

function emptySet(): SetInput {
  return { a: "", b: "", tbA: "", tbB: "" };
}

export default function ScoreEntrySheet({
  match,
  tournament,
  playerNames,
  playerId,
  onSubmit,
  onClose,
}: Props) {
  const opponentId =
    match.homePlayerId === playerId ? match.awayPlayerId : match.homePlayerId;
  const opponentName = playerNames[opponentId] || "Unknown";

  const [winner, setWinner] = useState<"me" | "opponent" | null>(null);
  const [sets, setSets] = useState<[SetInput, SetInput, SetInput]>([
    emptySet(),
    emptySet(),
    emptySet(),
  ]);

  const handleSetChange = useCallback(
    (setIndex: number, field: keyof SetInput, value: string) => {
      const num = value.replace(/\D/g, "");
      setSets((prev) => {
        const next = [...prev] as [SetInput, SetInput, SetInput];
        next[setIndex] = { ...next[setIndex], [field]: num };
        return next;
      });
    },
    [],
  );

  const set1Split = useMemo(() => {
    const a = parseInt(sets[0].a, 10);
    const b = parseInt(sets[0].b, 10);
    if (isNaN(a) || isNaN(b)) return false;
    return (a > b) !== (parseInt(sets[1].a, 10) > parseInt(sets[1].b, 10));
  }, [sets]);

  const needsTiebreak = useCallback((s: SetInput): boolean => {
    const a = parseInt(s.a, 10);
    const b = parseInt(s.b, 10);
    return a === 6 && b === 6;
  }, []);

  const showThirdSet = useMemo(() => {
    const s1a = parseInt(sets[0].a, 10);
    const s1b = parseInt(sets[0].b, 10);
    const s2a = parseInt(sets[1].a, 10);
    const s2b = parseInt(sets[1].b, 10);
    if (isNaN(s1a) || isNaN(s1b) || isNaN(s2a) || isNaN(s2b)) return false;
    const set1Winner = s1a > s1b ? "a" : "b";
    const set2Winner = s2a > s2b ? "a" : "b";
    return set1Winner !== set2Winner;
  }, [sets]);

  const preview = useMemo(() => {
    const activeSets = showThirdSet ? sets.slice(0, 3) : sets.slice(0, 2);
    return buildScorePreview(activeSets);
  }, [sets, showThirdSet]);

  const isValid = useMemo(() => {
    if (!winner) return false;
    const numSets = showThirdSet ? 3 : 2;
    for (let i = 0; i < numSets; i++) {
      const a = parseInt(sets[i].a, 10);
      const b = parseInt(sets[i].b, 10);
      if (isNaN(a) || isNaN(b)) return false;
      if (a < 0 || a > 7 || b < 0 || b > 7) return false;
      if (a === b) return false;
      if (a === 7 && b !== 5 && b !== 6) return false;
      if (b === 7 && a !== 5 && a !== 6) return false;
      if (needsTiebreak(sets[i])) {
        const tbA = parseInt(sets[i].tbA, 10);
        const tbB = parseInt(sets[i].tbB, 10);
        if (isNaN(tbA) || isNaN(tbB)) return false;
      }
    }
    return true;
  }, [winner, sets, showThirdSet, needsTiebreak]);

  const handleSubmit = useCallback(() => {
    if (!isValid || !winner) return;
    const winnerId = winner === "me" ? playerId : opponentId;
    const numSets = showThirdSet ? 3 : 2;
    const scoreSets: SetScore[] = [];
    for (let i = 0; i < numSets; i++) {
      const aGames = parseInt(sets[i].a, 10);
      const bGames = parseInt(sets[i].b, 10);
      const set: SetScore = { aGames, bGames };
      if (needsTiebreak(sets[i])) {
        set.tiebreak = {
          aPoints: parseInt(sets[i].tbA, 10),
          bPoints: parseInt(sets[i].tbB, 10),
        };
      }
      scoreSets.push(set);
    }
    onSubmit(match.id, tournament.id, winnerId, scoreSets);
  }, [isValid, winner, playerId, opponentId, sets, showThirdSet, needsTiebreak, match.id, tournament.id, onSubmit]);

  const renderSetInputs = (setIndex: number) => {
    const s = sets[setIndex];
    const showTb = needsTiebreak(s);
    return (
      <div className="score-set-row" key={setIndex}>
        <span className="score-set-label">Set {setIndex + 1}</span>
        <input
          type="number"
          className="score-input"
          min={0}
          max={7}
          value={s.a}
          placeholder="0"
          onChange={(e) => handleSetChange(setIndex, "a", e.target.value)}
        />
        <span className="score-dash">&ndash;</span>
        <input
          type="number"
          className="score-input"
          min={0}
          max={7}
          value={s.b}
          placeholder="0"
          onChange={(e) => handleSetChange(setIndex, "b", e.target.value)}
        />
        {showTb && (
          <>
            <span className="score-tb-label">TB</span>
            <input
              type="number"
              className="score-input score-input--tb"
              min={0}
              value={s.tbA}
              placeholder="0"
              onChange={(e) => handleSetChange(setIndex, "tbA", e.target.value)}
            />
            <span className="score-dash">&ndash;</span>
            <input
              type="number"
              className="score-input score-input--tb"
              min={0}
              value={s.tbB}
              placeholder="0"
              onChange={(e) => handleSetChange(setIndex, "tbB", e.target.value)}
            />
          </>
        )}
      </div>
    );
  };

  return (
    <div className="score-entry-sheet">
      <div className="score-entry-header">
        <h3>Enter Score</h3>
        <p>
          vs {opponentName} &middot; {ordinal(match.round)} round
        </p>
      </div>

      <div className="score-winner-toggle">
        <button
          className={`winner-btn ${winner === "me" ? "winner-btn--active" : ""}`}
          onClick={() => setWinner("me")}
        >
          I won
        </button>
        <button
          className={`winner-btn ${winner === "opponent" ? "winner-btn--active" : ""}`}
          onClick={() => setWinner("opponent")}
        >
          {opponentName} won
        </button>
      </div>

      <div className="score-sets">
        {renderSetInputs(0)}
        {renderSetInputs(1)}
        {showThirdSet && renderSetInputs(2)}
      </div>

      {preview && (
        <div className="score-preview">
          Score: {preview}
        </div>
      )}

      <div className="score-entry-actions">
        <button className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button className="btn-primary" disabled={!isValid} onClick={handleSubmit}>
          Submit Score
        </button>
      </div>
    </div>
  );
}
