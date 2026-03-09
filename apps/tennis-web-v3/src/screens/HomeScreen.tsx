import { useMemo } from "react";
import type {
  Player,
  ActionItem,
  Tournament,
  TournamentMatch,
  Tab,
} from "../types";
import {
  shortTournamentName,
  matchCountdown,
  friendlyStatus,
  formatDate,
} from "../helpers";
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
}: Props) {
  const firstName = (player.name || player.email.split("@")[0] || "Player").split(" ")[0];

  // Find the next upcoming scheduled match across all tournaments
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

  // Tournaments the player is participating in (active, finals, or completed)
  const myTournaments = useMemo(() => {
    return tournaments.filter(
      (t) =>
        (t.status === "active" || t.status === "finals" || t.status === "completed") &&
        t.playerIds.includes(player.id)
    );
  }, [tournaments, player.id]);

  // Nearby tournaments open for registration in the player's county
  const nearbyTournaments = useMemo(() => {
    return tournaments.filter(
      (t) =>
        t.status === "registration" &&
        t.county === player.county &&
        !t.playerIds.includes(player.id)
    );
  }, [tournaments, player.county, player.id]);

  const statusBadgeClass = (status: string): string => {
    switch (status) {
      case "active":
        return "tournament-card-badge tournament-card-badge--active";
      case "finals":
        return "tournament-card-badge tournament-card-badge--finals";
      case "completed":
        return "tournament-card-badge tournament-card-badge--completed";
      default:
        return "tournament-card-badge";
    }
  };

  return (
    <div className="home-screen">
      {/* Header */}
      <div className="home-header">
        <div className="home-title">
          <img src="/logo.svg" alt="Rally" />
        </div>
        <p className="home-greeting">Hi, {firstName}</p>
      </div>

      {/* Action Cards */}
      {actionItems.length > 0 ? (
        <section className="action-cards-section">
          <h2 className="section-title">Action Needed</h2>
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
      ) : (
        myTournaments.length === 0 && (
          <div className="empty-state">
            Join a tournament below to get started
          </div>
        )
      )}

      {/* Next Match */}
      {nextMatch && (
        <section className="next-match-section">
          <h2 className="section-title">Next Match</h2>
          <div className="next-match-card">
            <div className="next-match-opponent">
              vs{" "}
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
            <div className="next-match-tourney">
              {shortTournamentName(nextMatch.tournamentName)}
            </div>
          </div>
        </section>
      )}

      {/* My Tournaments */}
      {myTournaments.length > 0 && (
        <section className="my-tournaments">
          <h2 className="section-title">My Tournaments</h2>
          {myTournaments.map((t) => (
            <button
              key={t.id}
              className="tournament-card"
              onClick={() => onViewTournament(t.id)}
            >
              <div className="tournament-card-header">
                <span className="tournament-card-name">
                  {shortTournamentName(t.name)}
                </span>
                <span className={statusBadgeClass(t.status)}>
                  {friendlyStatus(t.status)}
                </span>
              </div>
              <div className="tournament-card-details">
                <span className="tournament-card-status">
                  {t.playerIds.length} player{t.playerIds.length !== 1 ? "s" : ""}
                </span>
              </div>
            </button>
          ))}
        </section>
      )}

      {/* Nearby Tournaments */}
      {nearbyTournaments.length > 0 ? (
        <section className="nearby-section">
          <h2 className="section-title">Nearby Tournaments</h2>
          {nearbyTournaments.map((t) => (
            <div key={t.id} className="tournament-card">
              <div className="tournament-card-header">
                <span className="tournament-card-name">
                  {shortTournamentName(t.name)}
                </span>
                <span className="tournament-card-badge">
                  {t.band}
                </span>
              </div>
              <div className="tournament-card-details">
                <span>
                  {t.playerIds.length}/{t.maxPlayers} players
                </span>
                <button
                  className="nearby-join-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onJoinTournament(t.id);
                  }}
                >
                  Join
                </button>
              </div>
            </div>
          ))}
        </section>
      ) : (
        player.county && (
          <section className="nearby-section">
            <h2 className="section-title">Nearby Tournaments</h2>
            <div className="empty-state">
              No tournaments in {player.county}
            </div>
          </section>
        )
      )}
    </div>
  );
}

export default HomeScreen;
