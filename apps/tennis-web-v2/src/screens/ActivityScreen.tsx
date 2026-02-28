import React, { useMemo } from "react";
import type { Player, Tournament, TournamentMatch } from "../types";
import { formatDate, matchCountdown, formatScore, friendlyMatchStatus } from "../helpers";

interface Props {
  player: Player;
  allMatches: Map<string, TournamentMatch[]>;
  tournaments: Tournament[];
  playerNames: Record<string, string>;
  onMatchAction: (match: TournamentMatch) => void;
}

function ActivityScreen({
  player,
  allMatches,
  tournaments,
  playerNames,
  onMatchAction,
}: Props) {
  // Collect all of the player's matches with tournament context
  const myMatches = useMemo(() => {
    const result: Array<{ match: TournamentMatch; tournamentName: string }> = [];
    for (const [tournamentId, matches] of allMatches) {
      const tournament = tournaments.find((t) => t.id === tournamentId);
      const tournamentName = tournament?.name || "Tournament";
      for (const m of matches) {
        if (m.homePlayerId === player.id || m.awayPlayerId === player.id) {
          result.push({ match: m, tournamentName });
        }
      }
    }
    return result;
  }, [allMatches, tournaments, player.id]);

  const now = Date.now();
  const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;

  // Upcoming: scheduled matches in the next 14 days
  const upcoming = useMemo(() => {
    return myMatches
      .filter((item) => {
        const m = item.match;
        if (!m.scheduledAt) return false;
        if (m.status === "completed" || m.status === "cancelled") return false;
        const dt = new Date(m.scheduledAt).getTime();
        return dt > now && dt <= now + fourteenDaysMs;
      })
      .sort(
        (a, b) =>
          new Date(a.match.scheduledAt!).getTime() -
          new Date(b.match.scheduledAt!).getTime()
      );
  }, [myMatches, now]);

  // Recent results: completed matches in the last 14 days
  const recentResults = useMemo(() => {
    return myMatches
      .filter((item) => {
        const m = item.match;
        if (m.status !== "completed" || !m.result) return false;
        const completedAt = m.result.reportedAt || m.scheduledAt;
        if (!completedAt) return false;
        const dt = new Date(completedAt).getTime();
        return dt >= now - fourteenDaysMs && dt <= now;
      })
      .sort((a, b) => {
        const aTime = new Date(a.match.result!.reportedAt || a.match.scheduledAt || "").getTime();
        const bTime = new Date(b.match.result!.reportedAt || b.match.scheduledAt || "").getTime();
        return bTime - aTime;
      });
  }, [myMatches, now]);

  // All matches: complete history, newest first
  const allMatchesSorted = useMemo(() => {
    return [...myMatches].sort((a, b) => {
      const aTime = new Date(
        a.match.scheduledAt || a.match.result?.reportedAt || "1970-01-01"
      ).getTime();
      const bTime = new Date(
        b.match.scheduledAt || b.match.result?.reportedAt || "1970-01-01"
      ).getTime();
      return bTime - aTime;
    });
  }, [myMatches]);

  function opponentName(m: TournamentMatch): string {
    const opponentId =
      m.homePlayerId === player.id ? m.awayPlayerId : m.homePlayerId;
    return playerNames[opponentId] || "Opponent";
  }

  function isWin(m: TournamentMatch): boolean {
    return m.result?.winnerId === player.id;
  }

  return (
    <div className="activity-screen">
      {/* Upcoming */}
      <section className="activity-section">
        <h2 className="section-title">Upcoming</h2>
        {upcoming.length === 0 ? (
          <>
            <p className="empty-text">No upcoming matches</p>
            <p className="empty-hint">Schedule your pending matches from the Tourney tab</p>
          </>
        ) : (
          upcoming.map(({ match: m, tournamentName }) => (
            <button
              key={m.id}
              className="upcoming-card"
              onClick={() => onMatchAction(m)}
            >
              <div className="upcoming-top">
                <span className="upcoming-opponent">{opponentName(m)}</span>
                <span className="upcoming-countdown">
                  {matchCountdown(m.scheduledAt)}
                </span>
              </div>
              <div className="upcoming-bottom">
                <span className="upcoming-time">{formatDate(m.scheduledAt!)}</span>
                <span className="upcoming-tourney">{tournamentName}</span>
              </div>
            </button>
          ))
        )}
      </section>

      {/* Recent Results */}
      <section className="activity-section">
        <h2 className="section-title">Recent Results</h2>
        {recentResults.length === 0 ? (
          <p className="empty-text">No recent results</p>
        ) : (
          recentResults.map(({ match: m, tournamentName }) => {
            const won = isWin(m);
            return (
              <button
                key={m.id}
                className={`result-card ${won ? "result-win" : "result-loss"}`}
                onClick={() => onMatchAction(m)}
              >
                <div className="result-top">
                  <span className={`result-indicator ${won ? "result-indicator--w" : "result-indicator--l"}`}>
                    {won ? "W" : "L"}
                  </span>
                  <span className="result-opponent">{opponentName(m)}</span>
                </div>
                <div className="result-bottom">
                  <span className="result-score">
                    {m.result?.sets ? formatScore(m.result.sets) : m.result?.score || ""}
                  </span>
                  <span className="result-tourney">{tournamentName}</span>
                </div>
              </button>
            );
          })
        )}
      </section>

      {/* All Matches */}
      <section className="activity-section">
        <h2 className="section-title">All Matches</h2>
        {allMatchesSorted.length === 0 ? (
          <>
            <p className="empty-text">No match history yet</p>
            <p className="empty-hint">Join a tournament from the Home tab to get started</p>
          </>
        ) : (
          allMatchesSorted.map(({ match: m, tournamentName }) => (
            <button
              key={m.id}
              className={`match-card${
                m.homePlayerId === player.id || m.awayPlayerId === player.id
                  ? " match-card--mine"
                  : ""
              }`}
              onClick={() => onMatchAction(m)}
            >
              <div className="match-players">
                <span>{opponentName(m)}</span>
              </div>
              <div className="match-meta">
                <span className="match-status">{friendlyMatchStatus(m)}</span>
                <span className="match-tourney-label">{tournamentName}</span>
              </div>
              {m.scheduledAt && (
                <div className="match-time">{formatDate(m.scheduledAt)}</div>
              )}
              {m.result && m.result.sets && (
                <div className="match-score">
                  <span className={isWin(m) ? "result-indicator--w" : "result-indicator--l"}>
                    {isWin(m) ? "W" : "L"}
                  </span>{" "}
                  {formatScore(m.result.sets)}
                </div>
              )}
            </button>
          ))
        )}
      </section>
    </div>
  );
}

export default ActivityScreen;
