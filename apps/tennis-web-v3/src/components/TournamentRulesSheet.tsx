import { useState } from "react";
import type { Tournament } from "../types";
import { formatCompactDate, getTournamentDates } from "../helpers";

interface Props {
  tournament?: Tournament | null;
  onClose: () => void;
}

type RulesSection = "overview" | "scheduling" | "scoring" | "deadlines";

const SECTIONS: { id: RulesSection; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "scheduling", label: "Scheduling" },
  { id: "scoring", label: "Scoring" },
  { id: "deadlines", label: "Deadlines" },
];

export default function TournamentRulesSheet({ tournament, onClose }: Props) {
  const [activeSection, setActiveSection] = useState<RulesSection>("overview");
  const dates = tournament ? getTournamentDates(tournament) : null;

  return (
    <div className="rules-sheet">
      <div className="rules-header">
        <h2 className="sheet-title">How Rally Works</h2>
        <button className="rules-close" onClick={onClose} aria-label="Close">
          &times;
        </button>
      </div>

      {/* Section tabs */}
      <div className="rules-tabs">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            className={`rules-tab${activeSection === s.id ? " rules-tab--active" : ""}`}
            onClick={() => setActiveSection(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="rules-body">
        {activeSection === "overview" && (
          <OverviewSection dates={dates} tournament={tournament} />
        )}
        {activeSection === "scheduling" && <SchedulingSection />}
        {activeSection === "scoring" && <ScoringSection />}
        {activeSection === "deadlines" && <DeadlinesSection />}
      </div>
    </div>
  );
}

function OverviewSection({
  dates,
  tournament,
}: {
  dates: ReturnType<typeof getTournamentDates> | null;
  tournament?: Tournament | null;
}) {
  return (
    <div className="rules-section">
      <p className="rules-intro">
        Rally runs monthly round-robin tennis tournaments.
        Everyone plays everyone, top 4 go to finals.
      </p>

      {/* Visual phase diagram */}
      <div className="rules-phases">
        <div className="rules-phase rules-phase--reg">
          <div className="rules-phase-bar" />
          <div className="rules-phase-content">
            <strong>Registration</strong>
            <span className="rules-phase-duration">Up to 7 days</span>
            {dates && (
              <span className="rules-phase-dates">
                {formatCompactDate(dates.registrationStart)}
                {dates.activationDate && ` – ${formatCompactDate(dates.activationDate)}`}
                {dates.isEstimated && " (est.)"}
              </span>
            )}
            <p>Tournament starts when {tournament?.maxPlayers || 8} players join, or after 7 days with 4+ players.</p>
          </div>
        </div>

        <div className="rules-phase rules-phase--rr">
          <div className="rules-phase-bar" />
          <div className="rules-phase-content">
            <strong>Round-Robin</strong>
            <span className="rules-phase-duration">18 days</span>
            {dates && dates.activationDate && dates.roundRobinEnd && (
              <span className="rules-phase-dates">
                {formatCompactDate(dates.activationDate)} – {formatCompactDate(dates.roundRobinEnd)}
                {dates.isEstimated && " (est.)"}
              </span>
            )}
            <p>Every player faces every other player once. Matches are auto-scheduled based on your availability.</p>
          </div>
        </div>

        <div className="rules-phase rules-phase--finals">
          <div className="rules-phase-bar" />
          <div className="rules-phase-content">
            <strong>Finals</strong>
            <span className="rules-phase-duration">5 days</span>
            {dates && dates.roundRobinEnd && dates.finalsEnd && (
              <span className="rules-phase-dates">
                {formatCompactDate(dates.roundRobinEnd)} – {formatCompactDate(dates.finalsEnd)}
                {dates.isEstimated && " (est.)"}
              </span>
            )}
            <p>#1 vs #2 for the championship. #3 vs #4 for third place.</p>
          </div>
        </div>

        <div className="rules-phase rules-phase--end">
          <div className="rules-phase-bar" />
          <div className="rules-phase-content">
            <strong>Season Complete</strong>
            {dates && dates.hardDeadline && (
              <span className="rules-phase-dates">
                by {formatCompactDate(dates.hardDeadline)}
                {dates.isEstimated && " (est.)"}
              </span>
            )}
            <p>Ratings updated. Next month's tournament begins.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SchedulingSection() {
  return (
    <div className="rules-section">
      <p className="rules-intro">
        Rally auto-schedules matches using your weekly availability.
        The more availability you add, the smoother it works.
      </p>

      <div className="rules-tiers">
        <div className="rules-tier">
          <div className="rules-tier-badge rules-tier-badge--auto">Auto</div>
          <div className="rules-tier-content">
            <strong>Auto-Scheduled</strong>
            <p>75+ minutes of overlap with your opponent — match is booked automatically. No action needed.</p>
          </div>
        </div>

        <div className="rules-tier">
          <div className="rules-tier-badge rules-tier-badge--flex">Flex</div>
          <div className="rules-tier-content">
            <strong>Flex Match</strong>
            <p>30–74 minutes overlap or schedules almost align. One tap to confirm a slightly adjusted time.</p>
          </div>
        </div>

        <div className="rules-tier">
          <div className="rules-tier-badge rules-tier-badge--propose">Manual</div>
          <div className="rules-tier-content">
            <strong>Propose &amp; Pick</strong>
            <p>No overlap found. You propose 2–3 times, your opponent picks one.</p>
          </div>
        </div>
      </div>

      <div className="rules-tip">
        Tip: Add 3+ availability slots across different days to maximize auto-scheduled matches.
      </div>
    </div>
  );
}

function ScoringSection() {
  return (
    <div className="rules-section">
      <p className="rules-intro">
        After playing, both players confirm the score.
      </p>

      <div className="rules-list">
        <div className="rules-list-item">
          <span className="rules-list-num">1</span>
          <div>
            <strong>Report</strong>
            <p>Either player enters the set scores after the match.</p>
          </div>
        </div>
        <div className="rules-list-item">
          <span className="rules-list-num">2</span>
          <div>
            <strong>Confirm</strong>
            <p>The opponent confirms the score. If it matches, the result is recorded.</p>
          </div>
        </div>
        <div className="rules-list-item">
          <span className="rules-list-num">3</span>
          <div>
            <strong>Auto-confirm</strong>
            <p>If your opponent doesn't respond within 48 hours, the score is automatically confirmed.</p>
          </div>
        </div>
      </div>

      <h3 className="rules-subheading">Standings Tiebreakers</h3>
      <p className="rules-intro">When players have the same number of wins:</p>
      <ol className="rules-tiebreak-list">
        <li><strong>Head-to-Head</strong> — who won the direct match</li>
        <li><strong>Set Difference</strong> — sets won minus sets lost</li>
        <li><strong>Game Difference</strong> — games won minus games lost</li>
      </ol>

      <h3 className="rules-subheading">Rating</h3>
      <p className="rules-intro">
        Your ELO rating updates after each match. Decisive wins earn a bigger boost.
        Forfeits affect standings but not your rating.
      </p>
    </div>
  );
}

function DeadlinesSection() {
  return (
    <div className="rules-section">
      <p className="rules-intro">
        Rally keeps things moving with automatic reminders and deadlines.
        You'll always get multiple reminders before any auto-action.
      </p>

      <div className="rules-deadlines">
        <div className="rules-deadline-item">
          <div className="rules-deadline-days">7 days</div>
          <div>
            <strong>Schedule your match</strong>
            <p>After a match is created, you have 7 days to schedule it. Reminders at day 3, 5, and 6.</p>
          </div>
        </div>

        <div className="rules-deadline-item">
          <div className="rules-deadline-days">5 days</div>
          <div>
            <strong>Accept a proposal</strong>
            <p>When times are proposed, the opponent has 5 days to pick one. Auto-accepted after that.</p>
          </div>
        </div>

        <div className="rules-deadline-item">
          <div className="rules-deadline-days">3 days</div>
          <div>
            <strong>Submit scores</strong>
            <p>After a match date, both players have 3 days to report the score.</p>
          </div>
        </div>

        <div className="rules-deadline-item">
          <div className="rules-deadline-days">48 hrs</div>
          <div>
            <strong>Confirm scores</strong>
            <p>Once one player reports, the other has 48 hours to confirm or it auto-confirms.</p>
          </div>
        </div>
      </div>

      <h3 className="rules-subheading">Forfeits</h3>
      <div className="rules-forfeit-info">
        <div className="rules-forfeit-type">
          <strong>No-show (one player)</strong>
          <p>If one player is unresponsive and the other has acted, the responsive player wins 6-0, 6-0.</p>
        </div>
        <div className="rules-forfeit-type">
          <strong>Mutual no-show</strong>
          <p>If neither player responds, no winner is recorded — the match doesn't affect standings.</p>
        </div>
      </div>
    </div>
  );
}
