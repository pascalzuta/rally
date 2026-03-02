import { useState, useMemo } from "react";
import type { Player, Tournament, TournamentMatch, StandingEntry } from "../types";
import { formatDate, tierLabel, tierColor, formatScore, ordinal, friendlyMatchStatus } from "../helpers";

type Segment = "matches" | "standings" | "info";

interface Props {
  player: Player;
  tournaments: Tournament[];
  allMatches: Map<string, TournamentMatch[]>;
  playerNames: Record<string, string>;
  playerRatings: Record<string, number>;
  selectedTournamentId: string | null;
  onSelectTournament: (id: string) => void;
  onMatchAction: (match: TournamentMatch) => void;
  onJoinTournament: (id: string) => void;
}

function MatchCard({
  m,
  player,
  playerNames,
  onMatchAction,
}: {
  m: TournamentMatch;
  player: Player;
  playerNames: Record<string, string>;
  onMatchAction: (match: TournamentMatch) => void;
}) {
  const isMyMatch = m.homePlayerId === player.id || m.awayPlayerId === player.id;
  const homeName = playerNames[m.homePlayerId] || "Player";
  const awayName = playerNames[m.awayPlayerId] || "Player";
  const isCompleted = m.status === "completed";
  const isWin = isMyMatch && isCompleted && m.result?.winnerId === player.id;
  const isLoss = isMyMatch && isCompleted && m.result?.winnerId && m.result.winnerId !== player.id;

  let cls = "match-card";
  if (isMyMatch) cls += " match-card--mine";
  if (m.finalsType) cls += ` match-card--${m.finalsType}`;
  if (isWin) cls += " match-card--win";
  if (isLoss) cls += " match-card--loss";

  return (
    <button
      key={m.id}
      className={cls}
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
          <span className="match-tier" style={{ color: tierColor(m.schedulingTier) }}>
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
}

function TourneyScreen({
  player,
  tournaments,
  allMatches,
  playerNames,
  playerRatings,
  selectedTournamentId,
  onSelectTournament,
  onMatchAction,
  onJoinTournament,
}: Props) {
  const [segment, setSegment] = useState<Segment>("matches");

  // Tournaments the player is enrolled in (active, finals, or completed)
  const myTournaments = useMemo(() => {
    return tournaments.filter(
      (t) =>
        (t.status === "active" || t.status === "finals" || t.status === "completed") &&
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

  // Separate round-robin matches from finals matches
  const { roundRobinByRound, finalsMatches } = useMemo(() => {
    const roundRobin: TournamentMatch[] = [];
    const finals: TournamentMatch[] = [];

    for (const m of matches) {
      if (m.finalsType) {
        finals.push(m);
      } else {
        roundRobin.push(m);
      }
    }

    const grouped = new Map<number, TournamentMatch[]>();
    for (const m of roundRobin) {
      const existing = grouped.get(m.round) || [];
      existing.push(m);
      grouped.set(m.round, existing);
    }

    return {
      roundRobinByRound: new Map([...grouped.entries()].sort(([a], [b]) => a - b)),
      finalsMatches: finals,
    };
  }, [matches]);

  // Discoverable tournaments (registration, same county, not enrolled)
  const discoverableTournaments = useMemo(() => {
    return tournaments.filter(
      (t) =>
        t.status === "registration" &&
        t.county === player.county &&
        !t.playerIds.includes(player.id)
    );
  }, [tournaments, player.county, player.id]);

  const segments: Segment[] = ["matches", "standings", "info"];

  // Status badge helper
  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      registration: "green",
      active: "blue",
      finals: "amber",
      completed: "gray",
    };
    return (
      <span className={`status-badge status-badge--${colors[status] || "gray"}`}>
        {status}
      </span>
    );
  };

  // Empty state — show discovery
  if (myTournaments.length === 0) {
    return (
      <div className="tourney-screen">
        <div className="tourney-empty">
          <h2>No Active Tournaments</h2>
          <p>Join a tournament to get started.</p>
        </div>

        {discoverableTournaments.length > 0 && (
          <section className="discovery-section">
            <h2 className="section-title">Find Tournaments</h2>
            <p className="discovery-subtitle">{player.county}</p>
            {discoverableTournaments.map((t) => (
              <div key={t.id} className="discovery-card">
                <div className="discovery-info">
                  <span className="discovery-name">{t.name}</span>
                  <span className="discovery-details">
                    {t.band} &middot; {t.playerIds.length}/{t.maxPlayers} players
                  </span>
                </div>
                <button
                  className="discovery-join-btn"
                  onClick={() => onJoinTournament(t.id)}
                >
                  Join
                </button>
              </div>
            ))}
          </section>
        )}
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

      {/* Status badge */}
      {selectedTournament && (
        <div className="tournament-status-row">
          {statusBadge(selectedTournament.status)}
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
          {/* Finals section */}
          {finalsMatches.length > 0 && (
            <div className="finals-group">
              <h3 className="round-header finals-header">
                <span className="finals-icon">{"\u{1F3C6}"}</span> Finals
              </h3>
              {finalsMatches.map((m) => {
                const label = m.finalsType === "championship" ? "Championship" : "3rd Place";
                return (
                  <div key={m.id} className="finals-match-wrapper">
                    <span className={`finals-label finals-label--${m.finalsType}`}>
                      {label}
                    </span>
                    <MatchCard
                      m={m}
                      player={player}
                      playerNames={playerNames}
                      onMatchAction={onMatchAction}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* Round-robin matches */}
          {roundRobinByRound.size === 0 && finalsMatches.length === 0 && (
            <p className="empty-text">No matches yet.</p>
          )}
          {[...roundRobinByRound.entries()].map(([round, roundMatches]) => (
            <div key={round} className="round-group">
              <h3 className="round-header">Round {round}</h3>
              {roundMatches.map((m) => (
                <MatchCard
                  key={m.id}
                  m={m}
                  player={player}
                  playerNames={playerNames}
                  onMatchAction={onMatchAction}
                />
              ))}
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
            <div className="standings-card">
            <table className="standings-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Player</th>
                  <th>W</th>
                  <th>L</th>
                  <th>Sets</th>
                  <th>Rating</th>
                </tr>
              </thead>
              <tbody>
                {selectedTournament.standings.map((entry: StandingEntry, idx: number) => {
                  const isMe = entry.playerId === player.id;
                  const currentRating = playerRatings[entry.playerId];
                  const snapshotRating = selectedTournament.ratingSnapshot?.[entry.playerId];
                  const delta = currentRating && snapshotRating ? Math.round(currentRating - snapshotRating) : null;

                  return (
                    <tr
                      key={entry.playerId}
                      className={isMe ? "standings-row--me" : ""}
                    >
                      <td>
                        {idx === 0 ? "\u{1F3C6}" : idx === 1 ? "\u{1F948}" : idx === 2 ? "\u{1F949}" : ordinal(idx + 1)}
                      </td>
                      <td>{playerNames[entry.playerId] || "Player"}</td>
                      <td>{entry.wins}</td>
                      <td>{entry.losses}</td>
                      <td>
                        {entry.setsWon}-{entry.setsLost}
                      </td>
                      <td className="rating-cell">
                        {currentRating ? Math.round(currentRating) : "\u2014"}
                        {delta !== null && delta !== 0 && (
                          <span className={`rating-delta rating-delta--${delta > 0 ? "up" : "down"}`}>
                            {delta > 0 ? "+" : ""}{delta}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
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
              <span className="info-value">{statusBadge(selectedTournament.status)}</span>
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
              <li>Top 4 advance to finals (Championship + 3rd Place)</li>
            </ul>
          </div>
        </div>
      )}

      {/* Tournament Discovery */}
      {discoverableTournaments.length > 0 && (
        <section className="discovery-section">
          <h2 className="section-title">Find Tournaments</h2>
          {discoverableTournaments.map((t) => (
            <div key={t.id} className="discovery-card">
              <div className="discovery-info">
                <span className="discovery-name">{t.name}</span>
                <span className="discovery-details">
                  {t.band} &middot; {t.playerIds.length}/{t.maxPlayers} players
                </span>
              </div>
              <button
                className="discovery-join-btn"
                onClick={() => onJoinTournament(t.id)}
              >
                Join
              </button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

export default TourneyScreen;
