import React, { useState, useMemo } from "react";
import type { Player, Tournament, TournamentMatch, StandingEntry } from "../types";
import { formatDate, tierLabel, tierColor, formatScore, ordinal, friendlyMatchStatus } from "../helpers";

type Segment = "matches" | "standings" | "info";

interface Props {
  player: Player;
  tournaments: Tournament[];
  allMatches: Map<string, TournamentMatch[]>;
  playerNames: Record<string, string>;
  selectedTournamentId: string | null;
  onSelectTournament: (id: string) => void;
  onMatchAction: (match: TournamentMatch) => void;
}

function TourneyScreen({
  player,
  tournaments,
  allMatches,
  playerNames,
  selectedTournamentId,
  onSelectTournament,
  onMatchAction,
}: Props) {
  const [segment, setSegment] = useState<Segment>("matches");

  // Tournaments the player is enrolled in (active or finals)
  const myTournaments = useMemo(() => {
    return tournaments.filter(
      (t) =>
        (t.status === "active" || t.status === "finals") &&
        t.playerIds.includes(player.id)
    );
  }, [tournaments, player.id]);

  const selectedTournament = useMemo(() => {
    if (selectedTournamentId) {
      return myTournaments.find((t) => t.id === selectedTournamentId) || myTournaments[0] || null;
    }
    return myTournaments[0] || null;
  }, [myTournaments, selectedTournamentId]);

  const matches = useMemo(() => {
    if (!selectedTournament) return [];
    return allMatches.get(selectedTournament.id) || [];
  }, [selectedTournament, allMatches]);

  // Group matches by round
  const matchesByRound = useMemo(() => {
    const grouped = new Map<number, TournamentMatch[]>();
    for (const m of matches) {
      const existing = grouped.get(m.round) || [];
      existing.push(m);
      grouped.set(m.round, existing);
    }
    return new Map([...grouped.entries()].sort(([a], [b]) => a - b));
  }, [matches]);

  const segments: Segment[] = ["matches", "standings", "info"];

  // Empty state
  if (myTournaments.length === 0) {
    return (
      <div className="tourney-screen">
        <div className="tourney-empty">
          <h2>No Active Tournaments</h2>
          <p>Join a tournament from the Home screen to get started.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tourney-screen">
      {/* Tournament selector */}
      {myTournaments.length > 1 ? (
        <div className="tournament-selector">
          <select
            className="tournament-select"
            value={selectedTournament?.id || ""}
            onChange={(e) => onSelectTournament(e.target.value)}
          >
            {myTournaments.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="tournament-selector">
          <h2 className="tournament-single-name">
            {selectedTournament?.name || "Tournament"}
          </h2>
        </div>
      )}

      {/* Segmented control */}
      <div className="segment-control">
        {segments.map((s) => (
          <button
            key={s}
            className={`segment-btn${segment === s ? " segment-btn--active" : ""}`}
            onClick={() => setSegment(s)}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Matches segment */}
      {segment === "matches" && (
        <div className="matches-section">
          {matchesByRound.size === 0 && (
            <p className="empty-text">No matches yet.</p>
          )}
          {[...matchesByRound.entries()].map(([round, roundMatches]) => (
            <div key={round} className="round-group">
              <h3 className="round-header">Round {round}</h3>
              {roundMatches.map((m) => {
                const isMyMatch =
                  m.homePlayerId === player.id || m.awayPlayerId === player.id;
                const homeName = playerNames[m.homePlayerId] || "Player";
                const awayName = playerNames[m.awayPlayerId] || "Player";

                return (
                  <button
                    key={m.id}
                    className={`match-card${isMyMatch ? " match-card--mine" : ""}`}
                    onClick={() => onMatchAction(m)}
                  >
                    <div className="match-players">
                      <span className={m.homePlayerId === player.id ? "match-player--me" : ""}>
                        {homeName}
                      </span>
                      <span className="match-vs">vs</span>
                      <span className={m.awayPlayerId === player.id ? "match-player--me" : ""}>
                        {awayName}
                      </span>
                    </div>

                    <div className="match-meta">
                      {m.schedulingTier && (
                        <span
                          className="match-tier"
                          style={{ color: tierColor(m.schedulingTier) }}
                        >
                          {tierLabel(m.schedulingTier)}
                        </span>
                      )}
                      <span className="match-status">{friendlyMatchStatus(m)}</span>
                    </div>

                    {m.scheduledAt && (
                      <div className="match-time">{formatDate(m.scheduledAt)}</div>
                    )}

                    {m.result && m.result.sets && (
                      <div className="match-score">{formatScore(m.result.sets)}</div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Standings segment */}
      {segment === "standings" && selectedTournament && (
        <div className="standings-section">
          {selectedTournament.schedulingResult && (
            <div
              className={`scheduling-banner${
                selectedTournament.schedulingResult.failedCount === 0
                  ? " scheduling-banner--green"
                  : " scheduling-banner--amber"
              }`}
            >
              {selectedTournament.schedulingResult.failedCount === 0
                ? `All ${selectedTournament.schedulingResult.scheduledCount} matches scheduled!`
                : `${selectedTournament.schedulingResult.scheduledCount} of ${
                    selectedTournament.schedulingResult.scheduledCount +
                    selectedTournament.schedulingResult.failedCount
                  } matches scheduled \u2014 ${selectedTournament.schedulingResult.failedCount} need attention`}
            </div>
          )}

          {selectedTournament.standings.length === 0 ? (
            <p className="empty-text">Standings not yet available.</p>
          ) : (
            <table className="standings-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Player</th>
                  <th>P</th>
                  <th>W</th>
                  <th>L</th>
                  <th>Sets</th>
                  <th>Games</th>
                </tr>
              </thead>
              <tbody>
                {selectedTournament.standings.map((entry: StandingEntry, idx: number) => {
                  const isMe = entry.playerId === player.id;
                  return (
                    <tr
                      key={entry.playerId}
                      className={isMe ? "standings-row--me" : ""}
                    >
                      <td>{ordinal(idx + 1)}</td>
                      <td>{playerNames[entry.playerId] || "Player"}</td>
                      <td>{entry.played}</td>
                      <td>{entry.wins}</td>
                      <td>{entry.losses}</td>
                      <td>
                        {entry.setsWon}-{entry.setsLost}{" "}
                        <small>({entry.setDiff > 0 ? "+" : ""}{entry.setDiff})</small>
                      </td>
                      <td>
                        {entry.gamesWon}-{entry.gamesLost}{" "}
                        <small>({entry.gameDiff > 0 ? "+" : ""}{entry.gameDiff})</small>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Info segment */}
      {segment === "info" && selectedTournament && (
        <div className="info-section">
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Name</span>
              <span className="info-value">{selectedTournament.name}</span>
            </div>
            <div className="info-item">
              <span className="info-label">County</span>
              <span className="info-value">{selectedTournament.county}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Band</span>
              <span className="info-value">{selectedTournament.band}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Status</span>
              <span className="info-value info-status">{selectedTournament.status}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Registration Opened</span>
              <span className="info-value">
                {new Date(selectedTournament.registrationOpenedAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          <div className="info-players">
            <h3>Players ({selectedTournament.playerIds.length})</h3>
            <ul className="player-list">
              {selectedTournament.playerIds.map((pid) => (
                <li
                  key={pid}
                  className={`player-list-item${pid === player.id ? " player-list-item--me" : ""}`}
                >
                  {playerNames[pid] || pid}
                </li>
              ))}
            </ul>
          </div>

          <div className="info-rules">
            <h3>Rules</h3>
            <ul className="rules-list">
              <li>Round-robin format: play every opponent once</li>
              <li>Best of 3 sets, tiebreak at 6-6</li>
              <li>Schedule matches within designated windows</li>
              <li>Report scores promptly after each match</li>
              <li>Top 2 players advance to finals</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default TourneyScreen;
