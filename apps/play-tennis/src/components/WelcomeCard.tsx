import { useState } from 'react'

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
}

export default function WelcomeCard({ activationSteps, county, onJoinLobby, onSetAvailability, onFindMatch }: Props) {
  const [hiwExpanded, setHiwExpanded] = useState(false)

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
        <div className="card-status-label card-status-label--blue">Getting Started</div>
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

      {nextAction && (
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
        <div className="how-rally-steps">
          <div className="how-rally-step">
            <div className="how-rally-step-icon how-rally-step-icon--join">1</div>
            <div className="how-rally-step-text">
              <strong>Join</strong>
              <span>Sign up and join your {county} lobby. Once 6+ players join, the tournament kicks off automatically.</span>
            </div>
          </div>
          <div className="how-rally-step">
            <div className="how-rally-step-icon how-rally-step-icon--play">2</div>
            <div className="how-rally-step-text">
              <strong>Play</strong>
              <span>Rally auto-schedules matches around everyone's availability — no group chats, no back-and-forth.</span>
            </div>
          </div>
          <div className="how-rally-step">
            <div className="how-rally-step-icon how-rally-step-icon--compete">3</div>
            <div className="how-rally-step-text">
              <strong>Compete</strong>
              <span>Every match updates your skill rating. Top players advance to finals.</span>
            </div>
          </div>
        </div>
        <div className="welcome-hiw-season">Seasons run ~30 days</div>
      </div>
    </div>
  )
}
