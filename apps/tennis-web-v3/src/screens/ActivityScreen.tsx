import type { Tournament, TournamentMatch } from "../types";
import type { Player } from "../types";
import { formatDate, formatScore, friendlyMatchStatus, shortTournamentName } from "../helpers";

interface Props {
  player: Player;
  allMatches: Map<string, TournamentMatch[]>;
  tournaments: Tournament[];
  playerNames: Record<string, string>;
  onMatchAction: (match: TournamentMatch) => void;
}

const UPCOMING_STATUSES = new Set(["scheduled", "pending", "scheduling"]);
const ACTIONABLE_STATUSES = new Set(["pending", "scheduling", "scheduled"]);

export default function ActivityScreen({
  player,
  allMatches,
  tournaments,
  playerNames,
  onMatchAction,
}: Props) {
  // Build a tournament lookup by id
  const tournamentById = new Map<string, Tournament>();
  for (const t of tournaments) {
    tournamentById.set(t.id, t);
  }

  // Collect all matches from every tournament into a flat list
  const allMatchList: TournamentMatch[] = [];
  for (const [, matches] of allMatches) {
    for (const m of matches) {
      allMatchList.push(m);
    }
  }

  // Split into upcoming vs recent results
  const upcoming: TournamentMatch[] = [];
  const recentResults: TournamentMatch[] = [];

  for (const match of allMatchList) {
    if (UPCOMING_STATUSES.has(match.status)) {
      upcoming.push(match);
    } else if (match.status === "completed") {
      recentResults.push(match);
    }
  }

  // Sort upcoming: scheduled first (by date), then pending/scheduling
  upcoming.sort((a, b) => {
    if (a.scheduledAt && b.scheduledAt) {
      return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
    }
    if (a.scheduledAt) return -1;
    if (b.scheduledAt) return 1;
    return 0;
  });

  // Sort recent results: most recent first
  recentResults.sort((a, b) => {
    const aTime = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
    const bTime = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
    return bTime - aTime;
  });

  const getOpponentName = (match: TournamentMatch): string => {
    const opponentId =
      match.homePlayerId === player.id ? match.awayPlayerId : match.homePlayerId;
    return playerNames[opponentId] ?? "Unknown";
  };

  const getTournamentName = (match: TournamentMatch): string => {
    const tournament = tournamentById.get(match.tournamentId);
    return tournament ? shortTournamentName(tournament.name) : "Tournament";
  };

  const isActionable = (match: TournamentMatch): boolean => {
    return ACTIONABLE_STATUSES.has(match.status) || (!!match.pendingResult && !match.result);
  };

  const renderMatchCard = (match: TournamentMatch) => {
    const actionable = isActionable(match);
    const className = `activity-card${actionable ? " activity-card--actionable" : ""}`;

    const handleClick = () => {
      if (actionable) {
        onMatchAction(match);
      }
    };

    return (
      <div
        key={match.id}
        className={className}
        onClick={handleClick}
        role={actionable ? "button" : undefined}
        tabIndex={actionable ? 0 : undefined}
        onKeyDown={
          actionable
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onMatchAction(match);
                }
              }
            : undefined
        }
      >
        <div className="activity-opponent">{getOpponentName(match)}</div>
        <div className="activity-tournament">{getTournamentName(match)}</div>
        <div className="activity-status">{friendlyMatchStatus(match)}</div>
        {match.scheduledAt && (
          <div className="activity-time">{formatDate(match.scheduledAt)}</div>
        )}
        {match.status === "completed" && match.result?.sets && (
          <div className="activity-score">{formatScore(match.result.sets)}</div>
        )}
      </div>
    );
  };

  const isEmpty = upcoming.length === 0 && recentResults.length === 0;

  return (
    <div className="activity-screen">
      <div className="activity-header">
        <h1>Activity</h1>
      </div>

      {isEmpty ? (
        <div className="empty-state">
          No matches yet. Join a tournament to get started!
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <section>
              <h2 className="section-title">Upcoming</h2>
              <div className="match-list">
                {upcoming.map(renderMatchCard)}
              </div>
            </section>
          )}

          {recentResults.length > 0 && (
            <section>
              <h2 className="section-title">Recent Results</h2>
              <div className="match-list">
                {recentResults.map(renderMatchCard)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
