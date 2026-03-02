import { useMemo } from "react";
import type { Player, ActionItem, Tournament, TournamentMatch, Tab } from "../types";
import { formatDate, matchCountdown, shortTournamentName, ordinal } from "../helpers";
import ActionCard from "../components/ActionCard";

interface Props {
  player: Player;
  actionItems: ActionItem[];
  tournaments: Tournament[];
  allMatches: Map<string, TournamentMatch[]>;
  playerNames: Record<string, string>;
  onAction: (action: ActionItem) => void;
  onJoinTournament: (id: string) => void;
  onViewTournament: (id: string) => void;
  onTabChange: (tab: Tab) => void;
}

function HomeScreen({
  player,
  actionItems,
  tournaments,
  allMatches,
  playerNames,
  onAction,
  onJoinTournament,
  onViewTournament,
  onTabChange,
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

  // Recently completed tournaments
  const completedTournaments = useMemo(() => {
    return tournaments.filter(
      (t) => t.status === "completed" && t.playerIds.includes(player.id)
    );
  }, [tournaments, player.id]);

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
            {actionItems.map((item) => (
              <ActionCard
                key={item.matchId}
                action={item}
                onAction={onAction}
              />
            ))}
          </div>
        </section>
      )}

      {/* Completed Tournament Summary */}
      {completedTournaments.length > 0 && (
        <section className="completed-summary-section">
          {completedTournaments.slice(0, 1).map((t) => {
            const myRank = t.standings.findIndex((s) => s.playerId === player.id);
            const myEntry = t.standings[myRank];
            const placement = myRank >= 0 ? myRank + 1 : null;
            const medal = placement === 1 ? "\u{1F3C6}" : placement === 2 ? "\u{1F948}" : placement === 3 ? "\u{1F949}" : null;
            return (
              <button key={t.id} className="completed-summary-card" onClick={() => onViewTournament(t.id)}>
                <div className="completed-summary-header">
                  <span className="completed-summary-title">{shortTournamentName(t.name)}</span>
                  <span className="status-badge status-badge--gray">Completed</span>
                </div>
                {placement && (
                  <div className="completed-summary-rank">
                    {medal && <span className="completed-medal">{medal}</span>}
                    <span className="completed-placement">{ordinal(placement)} Place</span>
                  </div>
                )}
                {myEntry && (
                  <div className="completed-summary-stats">
                    <span>{myEntry.wins}W &ndash; {myEntry.losses}L</span>
                    <span className="completed-summary-sets">{myEntry.setsWon}-{myEntry.setsLost} sets</span>
                  </div>
                )}
                <span className="completed-summary-cta">View Standings &rarr;</span>
              </button>
            );
          })}
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
              {myTournaments.length === 0 && completedTournaments.length > 0
                ? "Your tournament is complete!"
                : myTournaments.length === 0
                ? "Join a tournament to get started"
                : "Schedule your pending matches to see them here"}
            </p>
            {myTournaments.length === 0 && (
              <button className="empty-cta" onClick={() => onTabChange("tourney")}>
                Find Tournaments &rarr;
              </button>
            )}
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
