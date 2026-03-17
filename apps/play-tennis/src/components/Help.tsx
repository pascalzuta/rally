import { useState } from 'react'

type Section = 'overview' | 'scheduling' | 'scoring' | 'deadlines' | 'faq'

const TABS: { id: Section; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'scheduling', label: 'Scheduling' },
  { id: 'scoring', label: 'Scoring' },
  { id: 'deadlines', label: 'Deadlines' },
  { id: 'faq', label: 'FAQ' },
]

export default function Help({ onBack }: { onBack: () => void }) {
  const [active, setActive] = useState<Section>('overview')

  return (
    <div className="help-content">
      <div className="help-header">
        <button className="score-fs-close" onClick={onBack}>&#10005;</button>
        <h2>How Rally Works</h2>
      </div>

      <div className="help-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`help-tab ${active === t.id ? 'help-tab--active' : ''}`}
            onClick={() => setActive(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="help-body">
        {active === 'overview' && <OverviewSection />}
        {active === 'scheduling' && <SchedulingSection />}
        {active === 'scoring' && <ScoringSection />}
        {active === 'deadlines' && <DeadlinesSection />}
        {active === 'faq' && <FAQSection />}
      </div>
    </div>
  )
}

function OverviewSection() {
  return (
    <div className="help-section">
      <p className="help-intro">
        Rally runs monthly tennis tournaments in your county.
        Everyone plays everyone, then the top players compete in finals.
      </p>

      <div className="help-phases">
        <div className="help-phase help-phase--lobby">
          <div className="help-phase-bar" />
          <div className="help-phase-content">
            <div className="help-phase-step">1</div>
            <div>
              <strong>Join the Lobby</strong>
              <p>Sign up and join the waiting pool for your county. Invite friends to fill it faster.</p>
            </div>
          </div>
        </div>

        <div className="help-phase help-phase--form">
          <div className="help-phase-bar" />
          <div className="help-phase-content">
            <div className="help-phase-step">2</div>
            <div>
              <strong>Tournament Forms</strong>
              <span className="help-phase-detail">When 6+ players join</span>
              <p>A tournament is automatically created where everyone plays everyone.</p>
            </div>
          </div>
        </div>

        <div className="help-phase help-phase--play">
          <div className="help-phase-bar" />
          <div className="help-phase-content">
            <div className="help-phase-step">3</div>
            <div>
              <strong>Play Matches</strong>
              <span className="help-phase-detail">~3 weeks</span>
              <p>Matches are auto-scheduled from your availability. Play each opponent once and report scores.</p>
            </div>
          </div>
        </div>

        <div className="help-phase help-phase--finals">
          <div className="help-phase-bar" />
          <div className="help-phase-content">
            <div className="help-phase-step">4</div>
            <div>
              <strong>Finals</strong>
              <span className="help-phase-detail">Top 4 compete</span>
              <p>Top 4 advance to playoff semifinals and final. Win the championship trophy.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SchedulingSection() {
  return (
    <div className="help-section">
      <p className="help-intro">
        Rally auto-schedules matches using your weekly availability.
        The more slots you add, the smoother it works.
      </p>

      <div className="help-tiers">
        <div className="help-tier">
          <div className="help-tier-badge help-tier-badge--auto">Auto</div>
          <div>
            <strong>Auto-Scheduled</strong>
            <p>75+ minutes of overlap with your opponent &mdash; match is booked automatically.</p>
          </div>
        </div>

        <div className="help-tier">
          <div className="help-tier-badge help-tier-badge--flex">Flex</div>
          <div>
            <strong>Flex Match</strong>
            <p>30&ndash;74 minutes overlap. One tap to confirm a slightly adjusted time.</p>
          </div>
        </div>

        <div className="help-tier">
          <div className="help-tier-badge help-tier-badge--manual">Manual</div>
          <div>
            <strong>Propose &amp; Pick</strong>
            <p>No overlap found. You propose 2&ndash;3 times, your opponent picks one.</p>
          </div>
        </div>
      </div>

      <div className="help-tip">
        Add 3+ availability slots across different days to maximize auto-scheduled matches.
      </div>
    </div>
  )
}

function ScoringSection() {
  return (
    <div className="help-section">
      <p className="help-intro">
        After playing, both players confirm the score.
      </p>

      <div className="help-steps-list">
        <div className="help-step-item">
          <span className="help-step-num">1</span>
          <div>
            <strong>Report</strong>
            <p>Either player enters the set scores after the match.</p>
          </div>
        </div>
        <div className="help-step-item">
          <span className="help-step-num">2</span>
          <div>
            <strong>Confirm</strong>
            <p>The opponent confirms. If it matches, the result is recorded.</p>
          </div>
        </div>
        <div className="help-step-item">
          <span className="help-step-num">3</span>
          <div>
            <strong>Auto-confirm</strong>
            <p>If no response within 48 hours, the score auto-confirms.</p>
          </div>
        </div>
      </div>

      <h3 className="help-subheading">Tiebreakers</h3>
      <p className="help-intro">When players have the same number of wins:</p>
      <ol className="help-tiebreak-list">
        <li><strong>Head-to-Head</strong> &mdash; who won the direct match</li>
        <li><strong>Set Difference</strong> &mdash; sets won minus sets lost</li>
        <li><strong>Game Difference</strong> &mdash; games won minus games lost</li>
      </ol>

      <h3 className="help-subheading">Rating</h3>
      <p className="help-intro">
        Your Elo rating updates after each match. Decisive wins earn a bigger boost.
        New players start at 1500. Forfeits affect standings but not your rating.
      </p>
    </div>
  )
}

function DeadlinesSection() {
  return (
    <div className="help-section">
      <p className="help-intro">
        Rally keeps things moving with automatic reminders and deadlines.
        You always get multiple reminders before any auto-action.
      </p>

      <div className="help-deadlines">
        <div className="help-deadline-item">
          <div className="help-deadline-days">7 days</div>
          <div>
            <strong>Schedule your match</strong>
            <p>After a match is created, you have 7 days to schedule it. Reminders at day 3, 5, and 6.</p>
          </div>
        </div>

        <div className="help-deadline-item">
          <div className="help-deadline-days">5 days</div>
          <div>
            <strong>Accept a proposal</strong>
            <p>When times are proposed, the opponent has 5 days to pick one.</p>
          </div>
        </div>

        <div className="help-deadline-item">
          <div className="help-deadline-days">3 days</div>
          <div>
            <strong>Submit scores</strong>
            <p>After a match date, both players have 3 days to report the score.</p>
          </div>
        </div>

        <div className="help-deadline-item">
          <div className="help-deadline-days">48 hrs</div>
          <div>
            <strong>Confirm scores</strong>
            <p>Once one player reports, the other has 48 hours to confirm.</p>
          </div>
        </div>
      </div>

      <h3 className="help-subheading">Forfeits</h3>
      <div className="help-forfeits">
        <div className="help-forfeit">
          <strong>No-show (one player)</strong>
          <p>If one player is unresponsive, the responsive player wins 6-0, 6-0.</p>
        </div>
        <div className="help-forfeit">
          <strong>Mutual no-show</strong>
          <p>If neither player responds, no winner is recorded.</p>
        </div>
      </div>
    </div>
  )
}

function FAQSection() {
  const [openItems, setOpenItems] = useState<Set<number>>(new Set())

  function toggle(i: number) {
    const next = new Set(openItems)
    if (next.has(i)) next.delete(i)
    else next.add(i)
    setOpenItems(next)
  }

  const items = [
    { q: 'How do I join a tournament?', a: 'From the Home tab, tap "Join Lobby" to enter the waiting pool. Once enough players join (minimum 4), a tournament is automatically created.' },
    { q: 'What tournament formats are available?', a: 'Rally supports Everyone Plays Everyone (round robin), Elimination (single elimination), and Group Stage + Playoffs. The format is chosen based on player count.' },
    { q: 'How are matches scheduled?', a: 'Rally uses your availability preferences to find overlapping times. The system proposes slots automatically. You can also use "Play Now" to broadcast availability for an immediate match.' },
    { q: 'Can I play someone from a different county?', a: 'Tournaments are organized by county to keep matches local. You can only join the lobby for your registered county.' },
    { q: 'How do I change my availability?', a: 'Go to the Profile tab, find the availability section, and tap "Edit". You can choose quick presets or set specific time slots.' },
    { q: 'Can I leave a tournament?', a: 'Yes. From the Tournament tab, tap the overflow menu and select "Leave". Your remaining matches will be forfeited.' },
    { q: 'What happens if I can\'t make a match?', a: 'The scheduling system escalates with reminders, then a final deadline. If neither player responds, the match may be resolved as a walkover or cancellation.' },
  ]

  return (
    <div className="help-section">
      {items.map((item, i) => (
        <div key={i} className="faq-item">
          <button className="faq-question" onClick={() => toggle(i)}>
            <span>{item.q}</span>
            <span className={`faq-chevron ${openItems.has(i) ? 'open' : ''}`}>&rsaquo;</span>
          </button>
          {openItems.has(i) && <div className="faq-answer">{item.a}</div>}
        </div>
      ))}
    </div>
  )
}
