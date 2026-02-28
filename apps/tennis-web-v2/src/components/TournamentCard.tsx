import { useCallback } from "react";
import type { Tournament, TournamentStatus } from "../types";

interface Props {
  tournament: Tournament;
  playerId?: string;
  onJoin?: (id: string) => void;
  onTap?: (id: string) => void;
}

function statusLabel(status: TournamentStatus): string {
  switch (status) {
    case "registration":
      return "Registration Open";
    case "active":
      return "Active";
    case "finals":
      return "Finals";
    case "completed":
      return "Completed";
  }
}

function statusColor(status: TournamentStatus): string {
  switch (status) {
    case "registration":
      return "var(--blue)";
    case "active":
      return "var(--green)";
    case "finals":
      return "var(--amber)";
    case "completed":
      return "var(--text-muted)";
  }
}

export default function TournamentCard({ tournament, playerId, onJoin, onTap }: Props) {
  const isJoined = playerId ? tournament.playerIds.includes(playerId) : false;
  const isRegistration = tournament.status === "registration";
  const isActive = tournament.status === "active" || tournament.status === "finals";

  const totalMatches = tournament.rounds.reduce(
    (sum, r) => sum + r.pairings.filter((p) => p.matchId !== null).length,
    0,
  );
  const completedMatches = tournament.standings.reduce((sum, s) => sum + s.played, 0) / 2;
  const progressPct = totalMatches > 0 ? Math.round((completedMatches / totalMatches) * 100) : 0;

  const handleJoin = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onJoin?.(tournament.id);
    },
    [tournament.id, onJoin],
  );

  const handleTap = useCallback(() => {
    onTap?.(tournament.id);
  }, [tournament.id, onTap]);

  return (
    <div
      className="tournament-card"
      onClick={handleTap}
      role="button"
      tabIndex={0}
    >
      <div className="tournament-card-header">
        <h3 className="tournament-card-name">{tournament.name}</h3>
        <span
          className="status-badge"
          style={{ backgroundColor: statusColor(tournament.status) }}
        >
          {statusLabel(tournament.status)}
        </span>
      </div>

      <div className="tournament-card-meta">
        <span>{tournament.county}</span>
        <span>&middot;</span>
        <span>{tournament.band} NTRP</span>
        <span>&middot;</span>
        <span>
          {tournament.playerIds.length}/{tournament.maxPlayers}
        </span>
      </div>

      {isActive && totalMatches > 0 && (
        <div className="progress-bar">
          <div
            className="progress-bar-fill"
            style={{ width: `${progressPct}%` }}
          />
          <span className="progress-bar-label">
            {completedMatches}/{totalMatches} matches
          </span>
        </div>
      )}

      {isRegistration && !isJoined && onJoin && (
        <button className="tournament-card-join" onClick={handleJoin}>
          Join
        </button>
      )}

      {isRegistration && isJoined && (
        <span className="tournament-card-joined">Joined &#10003;</span>
      )}
    </div>
  );
}
