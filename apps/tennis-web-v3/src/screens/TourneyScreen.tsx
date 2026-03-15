import { useState, useMemo } from "react";
import type { Player, Tournament, StandingEntry } from "../types";
import type { TournamentMatch } from "../types";
import {
  shortTournamentName,
  formatScore,
  friendlyMatchStatus,
  tierLabel,
  tierColor,
  ordinal,
  displayName,
  formatCompactDate,
  getTournamentDates,
} from "../helpers";

// ─── Types ───────────────────────────────────────────────────────────────────

type TabId = "matches" | "standings" | "info";

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
  onShowRules: () => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TABS: { id: TabId; label: string }[] = [
  { id: "matches", label: "Matches" },
  { id: "standings", label: "Standings" },
  { id: "info", label: "Info" },
];

// ─── Utilities ───────────────────────────────────────────────────────────────

function isActionable(match: TournamentMatch): boolean {
  return match.status !== "completed" && match.status !== "cancelled";
}

function pName(id: string, names: Record<string, string>): string {
  return names[id] ?? "Unknown";
}

function handleKeyAction(
  e: React.KeyboardEvent,
  action: () => void,
): void {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    action();
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "active":
      return "In Progress";
    case "completed":
      return "Completed";
    case "registration":
      return "Registration Open";
    case "pending":
      return "Pending";
    default:
      return status;
  }
}

// ─── MatchCard ───────────────────────────────────────────────────────────────

function MatchCard({
  match,
  names,
  onAction,
}: {
  match: TournamentMatch;
  names: Record<string, string>;
  onAction: (m: TournamentMatch) => void;
}) {
  const actionable = isActionable(match);
  const status = friendlyMatchStatus(match);
  const completed = match.status === "completed" && match.result?.sets;

  return (
    <div
      className={`match-card${actionable ? " match-card--actionable" : ""}`}
      onClick={actionable ? () => onAction(match) : undefined}
      role={actionable ? "button" : undefined}
      tabIndex={actionable ? 0 : undefined}
      onKeyDown={
        actionable
          ? (e) => handleKeyAction(e, () => onAction(match))
          : undefined
      }
    >
      <div className="match-players">
        <span>{pName(match.homePlayerId, names)}</span>
        <span className="match-vs">vs</span>
        <span>{pName(match.awayPlayerId, names)}</span>
      </div>

      <div className="match-meta">
        <span className={`match-status match-status--${match.status}`}>
          {status}
        </span>

        {completed && match.result?.sets && (
          <span className="match-score">{formatScore(match.result.sets)}</span>
        )}

        <span
          className="match-tier"
          style={{ color: tierColor(match.schedulingTier) }}
        >
          {tierLabel(match.schedulingTier)}
        </span>
      </div>
    </div>
  );
}

// ─── FinalsCard ──────────────────────────────────────────────────────────────

function FinalsCard({
  match,
  names,
  finalsType,
  onAction,
}: {
  match: TournamentMatch;
  names: Record<string, string>;
  finalsType: "championship" | "third-place";
  onAction: (m: TournamentMatch) => void;
}) {
  const actionable = isActionable(match);
  const status = friendlyMatchStatus(match);
  const completed = match.status === "completed" && match.result?.sets;
  const label = finalsType === "championship" ? "Championship" : "3rd Place";
  const modifier =
    finalsType === "championship"
      ? "finals-match--championship"
      : "finals-match--third";

  return (
    <div
      className={`finals-match ${modifier}${actionable ? " match-card--actionable" : ""}`}
      onClick={actionable ? () => onAction(match) : undefined}
      role={actionable ? "button" : undefined}
      tabIndex={actionable ? 0 : undefined}
      onKeyDown={
        actionable
          ? (e) => handleKeyAction(e, () => onAction(match))
          : undefined
      }
    >
      <div className="finals-label">{label}</div>
      <div className="match-players">
        <span>{pName(match.homePlayerId, names)}</span>
        <span className="match-vs">vs</span>
        <span>{pName(match.awayPlayerId, names)}</span>
      </div>
      <div className="match-meta">
        <span className={`match-status match-status--${match.status}`}>
          {status}
        </span>
        {completed && match.result?.sets && (
          <span className="match-score">{formatScore(match.result.sets)}</span>
        )}
        <span
          className="match-tier"
          style={{ color: tierColor(match.schedulingTier) }}
        >
          {tierLabel(match.schedulingTier)}
        </span>
      </div>
    </div>
  );
}

// ─── Matches Tab ─────────────────────────────────────────────────────────────

function MatchesTab({
  matches,
  names,
  onAction,
}: {
  matches: TournamentMatch[];
  names: Record<string, string>;
  onAction: (m: TournamentMatch) => void;
}) {
  const { roundMatches, finalsMatches } = useMemo(() => {
    const rounds: TournamentMatch[] = [];
    const finals: TournamentMatch[] = [];
    for (const m of matches) {
      if (m.finalsType) {
        finals.push(m);
      } else {
        rounds.push(m);
      }
    }
    return { roundMatches: rounds, finalsMatches: finals };
  }, [matches]);

  const groupedByRound = useMemo(() => {
    const map = new Map<number, TournamentMatch[]>();
    for (const m of roundMatches) {
      const list = map.get(m.round) ?? [];
      list.push(m);
      map.set(m.round, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, [roundMatches]);

  if (matches.length === 0) {
    return (
      <div className="matches-list matches-list--empty">
        <p>No matches scheduled yet.</p>
      </div>
    );
  }

  return (
    <div className="matches-list">
      {groupedByRound.map(([round, roundMs]) => (
        <div key={round}>
          <div className="round-header">Round {round}</div>
          {roundMs.map((m) => (
            <MatchCard key={m.id} match={m} names={names} onAction={onAction} />
          ))}
        </div>
      ))}

      {finalsMatches.length > 0 && (
        <div className="finals-section">
          <div className="round-header">Finals</div>
          {finalsMatches
            .sort((a, b) => {
              if (a.finalsType === "championship") return -1;
              if (b.finalsType === "championship") return 1;
              return 0;
            })
            .map((m) => (
              <FinalsCard
                key={m.id}
                match={m}
                names={names}
                finalsType={m.finalsType!}
                onAction={onAction}
              />
            ))}
        </div>
      )}
    </div>
  );
}

// ─── Standings Tab ───────────────────────────────────────────────────────────

function StandingsTab({
  tournament,
  playerId,
  names,
  ratings,
}: {
  tournament: Tournament;
  playerId: string;
  names: Record<string, string>;
  ratings: Record<string, number>;
}) {
  const { standings, ratingSnapshot: snapshot } = tournament;

  const sorted = useMemo(
    () =>
      [...standings].sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.setDiff !== a.setDiff) return b.setDiff - a.setDiff;
        return b.gameDiff - a.gameDiff;
      }),
    [standings],
  );

  if (sorted.length === 0) {
    return (
      <div className="standings-container standings-container--empty">
        <p>Standings not available yet.</p>
      </div>
    );
  }

  return (
    <div className="standings-container">
      <table className="standings-table">
        <thead>
          <tr>
            <th className="standings-rank">Rank</th>
            <th className="standings-name">Player</th>
            <th className="standings-stat">W</th>
            <th className="standings-stat">L</th>
            <th className="standings-stat">Set+/-</th>
            <th className="standings-stat">Game+/-</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((entry: StandingEntry, idx: number) => {
            const isMe = entry.playerId === playerId;
            const rank = idx + 1;
            const name = pName(entry.playerId, names);

            let ratingDelta: number | null = null;
            if (snapshot && snapshot[entry.playerId] != null) {
              const current = ratings[entry.playerId];
              const pre = snapshot[entry.playerId];
              if (current != null && pre != null) {
                ratingDelta = Math.round(current - pre);
              }
            }

            return (
              <tr
                key={entry.playerId}
                className={`standings-row${isMe ? " standings-row--me" : ""}`}
              >
                <td className="standings-rank">{ordinal(rank)}</td>
                <td className="standings-name">
                  {name}
                  {ratingDelta !== null && (
                    <span
                      className={`rating-delta ${
                        ratingDelta >= 0
                          ? "rating-delta--up"
                          : "rating-delta--down"
                      }`}
                    >
                      {ratingDelta >= 0 ? "+" : ""}
                      {ratingDelta}
                    </span>
                  )}
                </td>
                <td className="standings-stat">{entry.wins}</td>
                <td className="standings-stat">{entry.losses}</td>
                <td className="standings-stat">
                  {entry.setDiff >= 0 ? "+" : ""}
                  {entry.setDiff}
                </td>
                <td className="standings-stat">
                  {entry.gameDiff >= 0 ? "+" : ""}
                  {entry.gameDiff}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Info Tab ────────────────────────────────────────────────────────────────

function InfoTab({
  tournament,
  names,
  onShowRules,
}: {
  tournament: Tournament;
  names: Record<string, string>;
  onShowRules: () => void;
}) {
  const dates = getTournamentDates(tournament);

  return (
    <div className="info-section">
      {/* Tournament Details */}
      <div className="info-card">
        <h3>{tournament.name}</h3>
        <dl>
          <dt>County</dt>
          <dd>{tournament.county}</dd>

          <dt>Band</dt>
          <dd>{tournament.band}</dd>

          <dt>Players</dt>
          <dd>
            {tournament.playerIds.length} / {tournament.maxPlayers}
          </dd>

          <dt>Status</dt>
          <dd>{statusLabel(tournament.status)}</dd>
        </dl>
      </div>

      {/* Timeline with concrete dates */}
      <div className="info-card">
        <h4>Tournament Timeline</h4>
        <div className="info-timeline">
          <TimelineRow
            label="Registration"
            date={formatCompactDate(dates.registrationStart)}
            status={tournament.status === "registration" ? "current" : "done"}
          />
          <TimelineRow
            label="Round-Robin"
            date={
              dates.activationDate && dates.roundRobinEnd
                ? `${formatCompactDate(dates.activationDate)} – ${formatCompactDate(dates.roundRobinEnd)}${dates.isEstimated ? " (est.)" : ""}`
                : "TBD"
            }
            detail="18 days · everyone plays everyone"
            status={tournament.status === "active" ? "current" : tournament.status === "registration" ? "upcoming" : "done"}
          />
          <TimelineRow
            label="Finals"
            date={
              dates.roundRobinEnd && dates.finalsEnd
                ? `${formatCompactDate(dates.roundRobinEnd)} – ${formatCompactDate(dates.finalsEnd)}${dates.isEstimated ? " (est.)" : ""}`
                : "TBD"
            }
            detail="Top 4 compete"
            status={tournament.status === "finals" ? "current" : (tournament.status === "completed" ? "done" : "upcoming")}
          />
          <TimelineRow
            label="Ends"
            date={
              dates.hardDeadline
                ? `by ${formatCompactDate(dates.hardDeadline)}${dates.isEstimated ? " (est.)" : ""}`
                : "TBD"
            }
            status={tournament.status === "completed" ? "done" : "upcoming"}
            isLast
          />
        </div>
      </div>

      {/* Players */}
      <div className="info-card">
        <h4>Players</h4>
        <div className="player-pills">
          {tournament.playerIds.map((pid) => (
            <span key={pid} className="player-pill">
              {pName(pid, names)}
            </span>
          ))}
        </div>
      </div>

      {/* Full rules link */}
      <button className="info-rules-link" onClick={onShowRules}>
        View full rules &amp; how Rally works
      </button>
    </div>
  );
}

function TimelineRow({
  label,
  date,
  detail,
  status,
  isLast,
}: {
  label: string;
  date: string;
  detail?: string;
  status: "done" | "current" | "upcoming";
  isLast?: boolean;
}) {
  return (
    <div className={`info-timeline-row info-timeline-row--${status}`}>
      <div className="info-timeline-left">
        <div className={`info-timeline-dot info-timeline-dot--${status}`} />
        {!isLast && <div className="info-timeline-line" />}
      </div>
      <div className="info-timeline-right">
        <strong>{label}</strong>
        <span className="info-timeline-date">{date}</span>
        {detail && <span className="info-timeline-detail">{detail}</span>}
      </div>
    </div>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function TourneyScreen({
  player,
  tournaments,
  allMatches,
  playerNames,
  playerRatings,
  selectedTournamentId,
  onSelectTournament,
  onMatchAction,
  onJoinTournament,
  onShowRules,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("matches");

  const selectedTournament = useMemo(
    () => tournaments.find((t) => t.id === selectedTournamentId) ?? null,
    [tournaments, selectedTournamentId],
  );

  const matches = useMemo(() => {
    if (!selectedTournamentId) return [];
    return allMatches.get(selectedTournamentId) ?? [];
  }, [allMatches, selectedTournamentId]);

  const myTournaments = useMemo(
    () => tournaments.filter((t) => t.playerIds.includes(player.id)),
    [tournaments, player.id],
  );

  // ── Empty state: player not in any tournaments ──

  if (myTournaments.length === 0) {
    return (
      <div className="tourney-screen tourney-screen--empty">
        <div className="tourney-header">
          <h2>Tournaments</h2>
        </div>
        <p>You are not in any tournaments yet.</p>
        {tournaments.length > 0 && (
          <div className="tourney-join-list">
            {tournaments
              .filter((t) => t.status === "registration")
              .map((t) => (
                <button
                  key={t.id}
                  className="tourney-join-btn"
                  onClick={() => onJoinTournament(t.id)}
                >
                  Join {shortTournamentName(t.name)}
                </button>
              ))}
          </div>
        )}
      </div>
    );
  }

  // ── Main layout ──

  return (
    <div className="tourney-screen">
      {/* Header + Tournament Selector */}
      <div className="tourney-header">
        <h2>Tournaments</h2>

        <div className="tourney-selector">
          <select
            value={selectedTournamentId ?? ""}
            onChange={(e) => onSelectTournament(e.target.value)}
          >
            {!selectedTournamentId && (
              <option value="" disabled>
                Select a tournament
              </option>
            )}
            {myTournaments.map((t) => (
              <option key={t.id} value={t.id}>
                {shortTournamentName(t.name)} ({t.month})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Segmented Control + Tab Content */}
      {selectedTournament && (
        <>
          <div className="segment-control">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                className={`segment-btn${
                  activeTab === tab.id ? " segment-btn--active" : ""
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "matches" && (
            <MatchesTab
              matches={matches}
              names={playerNames}
              onAction={onMatchAction}
            />
          )}

          {activeTab === "standings" && (
            <StandingsTab
              tournament={selectedTournament}
              playerId={player.id}
              names={playerNames}
              ratings={playerRatings}
            />
          )}

          {activeTab === "info" && (
            <InfoTab tournament={selectedTournament} names={playerNames} onShowRules={onShowRules} />
          )}
        </>
      )}

      {!selectedTournament && selectedTournamentId === null && (
        <p className="tourney-prompt">
          Select a tournament above to view details.
        </p>
      )}
    </div>
  );
}
