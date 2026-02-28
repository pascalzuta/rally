import React, { useMemo } from "react";
import type { Player, ActionItem, Tournament, TournamentMatch } from "../types";
import { formatDate, matchCountdown, shortTournamentName } from "../helpers";

interface Props {
  player: Player;
  actionItems: ActionItem[];
  tournaments: Tournament[];
  allMatches: Map<string, TournamentMatch[]>;
  playerNames: Record<string, string>;
  onAction: (action: ActionItem) => void;
  onJoinTournament: (id: string) => void;
  onViewTournament: (id: string) => void;
}

const ACTION_LABELS: Record<string, string> = {
  "confirm-score": "Confirm Score",
  "flex-schedule": "Flex Schedule",
  "propose-times": "Propose Times",
  "pick-time": "Pick a Time",
  "enter-score": "Enter Score",
};

const ACTION_ICONS: Record<string, string> = {
  "confirm-score": "\u2705",
  "flex-schedule": "\u{1F504}",
  "propose-times": "\u{1F4C5}",
  "pick-time": "\u23F0",
  "enter-score": "\u{1F4DD}",
};

const ACTION_COLORS: Record<string, string> = {
  "confirm-score": "red",
  "flex-schedule": "amber",
  "propose-times": "amber",
  "pick-time": "blue",
  "enter-score": "blue",
};

function HomeScreen({
  player,
  actionItems,
  tournaments,
  allMatches,
  playerNames,
  onAction,
  onJoinTournament,
  onViewTournament,
}: Props) {
  const firstName = (player.name || player.email.split("@")[0] || "Player").split(" ")[0];

  // Find next upcoming match across all tournaments
  const nextMatch = useMemo(() => {
    const now = Date.now();
    let best: { match: TournamentMatch; tournamentName: string } | null = null;

    for (const [tournamentId, matches] of allMatches) {
      const tournament = tournaments.find((t) => t.id === tournamentId);
      if (!tournament) continue;

      for (const m of matches) {
        if (!m.scheduledAt || m.status === "completed" || m.status === "cancelled") continue;
        const dt = new Date(m.scheduledAt).getTime();
        if (dt <= now) continue;
        if (!best || dt < new Date(best.match.scheduledAt!).getTime()) {
          best = { match: m, tournamentName: tournament.name };
        }
      }
    }
    return best;
  }, [allMatches, tournaments]);

  // Active tournaments the player is in
  const myTournaments = useMemo(() => {
    return tournaments.filter(
      (t) =>
        (t.status === "active" || t.status === "finals") &&
        t.playerIds.includes(player.id)
    );
  }, [tournaments, player.id]);

  // Nearby tournaments open for registration
  const nearbyTournaments = useMemo(() => {
    return tournaments.filter(
      (t) =>
        t.status === "registration" &&
        t.county === player.county &&
        !t.playerIds.includes(player.id)
    );
  }, [tournaments, player.county, player.id]);

  // Match stats per tournament
  const tournamentProgress = useMemo(() => {
    const progress: Record<string, { played: number; total: number }> = {};
    for (const t of myTournaments) {
      const matches = allMatches.get(t.id) || [];
      const myMatches = matches.filter(
        (m) => m.homePlayerId === player.id || m.awayPlayerId === player.id
      );
      const played = myMatches.filter((m) => m.status === "completed").length;
      progress[t.id] = { played, total: myMatches.length };
    }
    return progress;
  }, [myTournaments, allMatches, player.id]);

  // Win rate
  const totalMatches = player.wins + player.losses;
  const winRate = totalMatches > 0 ? Math.round((player.wins / totalMatches) * 100) : 0;

  return (
    <div className="home-screen">
      {/* Header */}
      <div className="home-header">
        <h1 className="home-title">Rally</h1>
        <p className="home-greeting">Hi, {firstName}</p>
      </div>

      {/* Action Needed */}
      {actionItems.length > 0 && (
        <section className="action-section">
          <div className="section-header">
            <h2>Action Needed</h2>
            <span className="action-badge">{actionItems.length}</span>
          </div>
          <div className="action-scroll">
            {actionItems.map((item) => {
              const color = ACTION_COLORS[item.type] || "blue";
              return (
                <button
                  key={item.matchId}
                  className={`action-card action-card--${color}`}
                  onClick={() => onAction(item)}
                >
                  <span className="action-icon">
                    {ACTION_ICONS[item.type] || "\u26A0\uFE0F"}
                  </span>
                  <span className="action-label">
                    {ACTION_LABELS[item.type] || item.type}
                  </span>
                  <span className="action-opponent">{item.opponentName}</span>
                  <span className="action-tourney">{item.tournamentName}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Next Match */}
      <section className="next-match-section">
        <h2 className="section-title">Next Match</h2>
        {nextMatch ? (
          <div className="next-match-card">
            <div className="next-match-opponent">
              {playerNames[
                nextMatch.match.homePlayerId === player.id
                  ? nextMatch.match.awayPlayerId
                  : nextMatch.match.homePlayerId
              ] || "Opponent"}
            </div>
            <div className="next-match-time">
              {formatDate(nextMatch.match.scheduledAt!)}
            </div>
            <div className="next-match-countdown">
              {matchCountdown(nextMatch.match.scheduledAt)}
            </div>
            <div className="next-match-tourney">{nextMatch.tournamentName}</div>
          </div>
        ) : (
          <div className="next-match-card next-match-card--empty">
            <p className="empty-text">No upcoming matches</p>
            <p className="empty-hint">
              {myTournaments.length === 0
                ? "Join a tournament below to get started"
                : "Schedule your pending matches to see them here"}
            </p>
          </div>
        )}
      </section>

      {/* My Tournaments */}
      {myTournaments.length > 0 && (
        <section className="my-tournaments">
          <h2 className="section-title">My Tournaments</h2>
          {myTournaments.map((t) => {
            const prog = tournamentProgress[t.id] || { played: 0, total: 7 };
            const pct = prog.total > 0 ? (prog.played / prog.total) * 100 : 0;
            return (
              <button
                key={t.id}
                className="tournament-row"
                onClick={() => onViewTournament(t.id)}
              >
                <div className="tournament-row-info">
                  <span className="tournament-row-name">{shortTournamentName(t.name)}</span>
                  <span className="tournament-row-progress">
                    {prog.played}/{prog.total} matches played
                  </span>
                </div>
                <div className="mini-progress-bar">
                  <div
                    className="mini-progress-fill"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </button>
            );
          })}
        </section>
      )}

      {/* Nearby Tournaments */}
      {nearbyTournaments.length > 0 && (
        <section className="nearby-section">
          <h2 className="section-title">Nearby Tournaments</h2>
          {nearbyTournaments.map((t) => (
            <div key={t.id} className="nearby-card">
              <div className="nearby-info">
                <span className="nearby-name">{t.name}</span>
                <span className="nearby-details">
                  {t.county} &middot; {t.band} &middot;{" "}
                  {t.playerIds.length}/{t.maxPlayers} players
                </span>
              </div>
              <button
                className="nearby-join-btn"
                onClick={() => onJoinTournament(t.id)}
              >
                Join
              </button>
            </div>
          ))}
        </section>
      )}

      {/* Quick Stats */}
      <section className="quick-stats">
        <div className="stat-item">
          <span className="stat-value">{player.rating.toFixed(1)}</span>
          <span className="stat-label">Rating</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <span className="stat-value">
            {player.wins}W&ndash;{player.losses}L
          </span>
          <span className="stat-label">Record</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <span className="stat-value">{winRate}%</span>
          <span className="stat-label">Win Rate</span>
        </div>
      </section>
    </div>
  );
}

export default HomeScreen;
