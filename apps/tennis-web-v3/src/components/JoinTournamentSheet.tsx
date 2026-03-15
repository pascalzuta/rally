import type { Tournament } from "../types";
import {
  shortTournamentName,
  formatCompactDate,
  getTournamentDates,
} from "../helpers";

interface Props {
  tournament: Tournament;
  onConfirmJoin: () => void;
  onClose: () => void;
}

export default function JoinTournamentSheet({
  tournament,
  onConfirmJoin,
  onClose,
}: Props) {
  const dates = getTournamentDates(tournament);
  const playerCount = tournament.playerIds.length;
  const spotsLeft = tournament.maxPlayers - playerCount;
  const totalMatches = Math.min(tournament.maxPlayers, 8) - 1;

  return (
    <div className="join-sheet">
      <h2 className="sheet-title">
        Join {shortTournamentName(tournament.name)}
      </h2>
      <p className="join-sheet-subtitle">
        {tournament.band} · {tournament.county}
      </p>

      {/* Visual Timeline */}
      <div className="join-timeline">
        <div className="join-timeline-track" />

        <div className="join-timeline-phase join-timeline-phase--registration">
          <div className="join-timeline-dot join-timeline-dot--active" />
          <div className="join-timeline-info">
            <span className="join-timeline-label">Registration</span>
            <span className="join-timeline-date">
              Now · {playerCount}/{tournament.maxPlayers} players
            </span>
          </div>
        </div>

        <div className="join-timeline-phase">
          <div className="join-timeline-dot" />
          <div className="join-timeline-info">
            <span className="join-timeline-label">Round-Robin</span>
            <span className="join-timeline-date">
              {dates.isEstimated ? "~" : ""}
              {dates.activationDate
                ? formatCompactDate(dates.activationDate)
                : "TBD"}{" "}
              –{" "}
              {dates.roundRobinEnd
                ? formatCompactDate(dates.roundRobinEnd)
                : "TBD"}
            </span>
            <span className="join-timeline-detail">18 days · everyone plays everyone</span>
          </div>
        </div>

        <div className="join-timeline-phase">
          <div className="join-timeline-dot" />
          <div className="join-timeline-info">
            <span className="join-timeline-label">Finals</span>
            <span className="join-timeline-date">
              {dates.isEstimated ? "~" : ""}
              {dates.roundRobinEnd
                ? formatCompactDate(dates.roundRobinEnd)
                : "TBD"}{" "}
              –{" "}
              {dates.finalsEnd
                ? formatCompactDate(dates.finalsEnd)
                : "TBD"}
            </span>
            <span className="join-timeline-detail">Top 4 compete for championship</span>
          </div>
        </div>

        <div className="join-timeline-phase">
          <div className="join-timeline-dot join-timeline-dot--end" />
          <div className="join-timeline-info">
            <span className="join-timeline-label">Season Ends</span>
            <span className="join-timeline-date">
              {dates.isEstimated ? "~" : ""}
              {dates.hardDeadline
                ? formatCompactDate(dates.hardDeadline)
                : "TBD"}
            </span>
          </div>
        </div>
      </div>

      {dates.isEstimated && (
        <p className="join-timeline-note">
          Dates are estimated. Tournament activates when {tournament.maxPlayers} players join or after 7 days.
        </p>
      )}

      {/* What to expect */}
      <div className="join-commitment">
        <h3>What to expect</h3>
        <ul>
          <li>Up to {totalMatches} matches over ~3 weeks</li>
          <li>Matches auto-scheduled from your availability</li>
          <li>Report scores after each match — both players confirm</li>
          <li>Reminders keep things moving, forfeits if unresponsive</li>
        </ul>
      </div>

      {/* Actions */}
      <div className="join-sheet-actions">
        <button className="join-sheet-confirm" onClick={onConfirmJoin}>
          Join Tournament{spotsLeft <= 3 ? ` · ${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left` : ""}
        </button>
        <button className="join-sheet-cancel" onClick={onClose}>
          Not now
        </button>
      </div>
    </div>
  );
}
