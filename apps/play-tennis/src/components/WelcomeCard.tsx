import { useState } from 'react'
import { titleCase } from '../dateUtils'

export interface ActivationStep {
  label: string
  completed: boolean
}

interface Props {
  activationSteps: ActivationStep[]
  county: string
  onJoinLobby: () => void
  onSetAvailability: () => void
  onFindMatch: () => void
  hideAction?: boolean
}

type HiwSection = 'overview' | 'scheduling' | 'scoring' | 'deadlines' | 'faq'

const HIW_TABS: { id: HiwSection; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'scheduling', label: 'Scheduling' },
  { id: 'scoring', label: 'Scoring' },
  { id: 'deadlines', label: 'Deadlines' },
  { id: 'faq', label: 'FAQ' },
]

export default function WelcomeCard({ activationSteps, county, onJoinLobby, onSetAvailability, onFindMatch, hideAction }: Props) {
  const [hiwExpanded, setHiwExpanded] = useState(false)
  const [hiwTab, setHiwTab] = useState<HiwSection>('overview')

  const completed = activationSteps.filter(s => s.completed).length

  // CTA matches the first incomplete step
  const nextAction = !activationSteps[1].completed
    ? { label: 'Join the Lobby', action: onJoinLobby }
    : !activationSteps[2].completed
    ? { label: 'Set Your Availability', action: onSetAvailability }
    : !activationSteps[3].completed
    ? { label: 'Find a Match', action: onFindMatch }
    : null

  return (
    <div className="card onboarding-card">
      <div className="card-status-row">
        <div className="card-status-label card-status-label--green">Getting Started</div>
        <div className="card-meta-chip">{completed}/{activationSteps.length} complete</div>
      </div>
      <div className="card-summary-main">
        <div className="card-title">Welcome to Rally</div>
        <div className="card-supporting">
          Your matches, auto-scheduled.<br />
          Your skills, accurately rated.
        </div>
      </div>

      <div className="onboarding-steps">
        {activationSteps.map((step, i) => (
          <div key={i} className={`onboarding-step ${step.completed ? 'completed' : ''}`}>
            <span className="onboarding-step-icon">
              {step.completed ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="8" fill="var(--color-positive-primary)" />
                  <path d="M5 8l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7.5" stroke="var(--color-divider)" />
                </svg>
              )}
            </span>
            <span className="onboarding-step-label">{step.label}</span>
          </div>
        ))}
      </div>

      {nextAction && !hideAction && (
        <button className="btn btn-primary onboarding-cta" onClick={nextAction.action}>
          {nextAction.label}
        </button>
      )}

      {/* Expandable "How it works" section */}
      <button className="welcome-hiw-toggle" onClick={() => setHiwExpanded(v => !v)}>
        <span className={`welcome-hiw-chevron ${hiwExpanded ? 'expanded' : ''}`}>&#9656;</span>
        How does Rally work?
      </button>

      <div className={`welcome-hiw-content ${hiwExpanded ? 'expanded' : ''}`}>
        <div className="welcome-hiw-inner">
          <div className="help-tabs">
            {HIW_TABS.map(t => (
              <button
                key={t.id}
                className={`help-tab ${hiwTab === t.id ? 'help-tab--active' : ''}`}
                onClick={() => setHiwTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="help-body">
            {hiwTab === 'overview' && <OverviewSection county={county} />}
            {hiwTab === 'scheduling' && <SchedulingSection />}
            {hiwTab === 'scoring' && <ScoringSection />}
            {hiwTab === 'deadlines' && <DeadlinesSection />}
            {hiwTab === 'faq' && <FAQSection />}
          </div>
        </div>
      </div>
    </div>
  )
}

function OverviewSection({ county }: { county: string }) {
  return (
    <div className="help-section">
      <p className="help-intro">
        Rally runs monthly tennis tournaments in {titleCase(county)} — and schedules every match automatically.
      </p>

      <div className="help-phases">
        <div className="help-phase help-phase--lobby">
          <div className="help-phase-bar" />
          <div className="help-phase-content">
            <div className="help-phase-step">1</div>
            <div>
              <strong>Join the Lobby</strong>
              <p>Join the player pool for your county. Invite friends to start sooner.</p>
            </div>
          </div>
        </div>

        <div className="help-phase help-phase--form">
          <div className="help-phase-bar" />
          <div className="help-phase-content">
            <div className="help-phase-step">2</div>
            <div>
              <strong>Tournament Starts</strong>
              <span className="help-phase-detail">When 6+ players join</span>
              <p>A round-robin is created automatically. You play every other player once.</p>
            </div>
          </div>
        </div>

        <div className="help-phase help-phase--play">
          <div className="help-phase-bar" />
          <div className="help-phase-content">
            <div className="help-phase-step">3</div>
            <div>
              <strong>Play Your Matches</strong>
              <span className="help-phase-detail">~3 weeks</span>
              <p>Matches are auto-scheduled from your availability. Show up, play, report your score.</p>
            </div>
          </div>
        </div>

        <div className="help-phase help-phase--finals">
          <div className="help-phase-bar" />
          <div className="help-phase-content">
            <div className="help-phase-step">4</div>
            <div>
              <strong>Playoffs</strong>
              <span className="help-phase-detail">Top 4 compete</span>
              <p>Top 4 advance to single-elimination playoffs. Win the championship.</p>
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
        Rally auto-schedules matches using your weekly availability. More slots = smoother scheduling.
      </p>

      <div className="help-tiers">
        <div className="help-tier">
          <div className="help-tier-badge help-tier-badge--auto">Auto</div>
          <div>
            <strong>Auto-Scheduled</strong>
            <p>75+ minutes overlap — match is booked automatically.</p>
          </div>
        </div>

        <div className="help-tier">
          <div className="help-tier-badge help-tier-badge--flex">Flex</div>
          <div>
            <strong>Flex Match</strong>
            <p>30&ndash;74 minutes overlap. One tap to confirm an adjusted time.</p>
          </div>
        </div>

        <div className="help-tier">
          <div className="help-tier-badge help-tier-badge--manual">Manual</div>
          <div>
            <strong>Propose &amp; Pick</strong>
            <p>No overlap. You propose 2&ndash;3 times, your opponent picks one.</p>
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
            <p>No response within 48 hours? Score auto-confirms.</p>
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
        New players start at 1500.
      </p>
    </div>
  )
}

function DeadlinesSection() {
  return (
    <div className="help-section">
      <p className="help-intro">
        Rally keeps things moving with automatic reminders and deadlines.
      </p>

      <div className="help-deadlines">
        <div className="help-deadline-item">
          <div className="help-deadline-days">7 days</div>
          <div>
            <strong>Schedule your match</strong>
            <p>After a match is created, you have 7 days to schedule. Reminders at day 3, 5, and 6.</p>
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
          <p>Unresponsive player forfeits — responsive player wins 6-0, 6-0.</p>
        </div>
        <div className="help-forfeit">
          <strong>Mutual no-show</strong>
          <p>Neither player responds — no winner recorded.</p>
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
    { q: 'What tournament formats are available?', a: 'Rally supports Round Robin (everyone plays everyone), Elimination (single elimination), and Group Stage + Playoffs. The format is chosen based on player count.' },
    { q: 'How are matches scheduled?', a: 'Rally uses your availability preferences to find overlapping times. The system proposes slots automatically. You can also use "Quick Play" to broadcast availability for an immediate match.' },
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
