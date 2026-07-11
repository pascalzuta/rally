import { useState } from 'react'
import { OverviewSection, SchedulingSection, ScoringSection, DeadlinesSection, FAQSection } from './HelpSections'

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
  /** Pre-expand the "How does Rally work?" section. Used by /dev/screens preview. */
  initialHiwExpanded?: boolean
}

type HiwSection = 'overview' | 'scheduling' | 'scoring' | 'deadlines' | 'faq'

const HIW_TABS: { id: HiwSection; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'scheduling', label: 'Scheduling' },
  { id: 'scoring', label: 'Scoring' },
  { id: 'deadlines', label: 'Deadlines' },
  { id: 'faq', label: 'FAQ' },
]

export default function WelcomeCard({ activationSteps, county, onJoinLobby, onSetAvailability, onFindMatch, hideAction, initialHiwExpanded }: Props) {
  const [hiwExpanded, setHiwExpanded] = useState(!!initialHiwExpanded)
  const [hiwTab, setHiwTab] = useState<HiwSection>('overview')

  const completed = activationSteps.filter(s => s.completed).length

  // CTA matches the first incomplete step
  const nextAction = !activationSteps[1].completed
    ? { label: 'Join the lobby', action: onJoinLobby }
    : !activationSteps[2].completed
    ? { label: 'Set your availability', action: onSetAvailability }
    : !activationSteps[3].completed
    ? { label: 'Find a match', action: onFindMatch }
    : null

  const total = activationSteps.length
  const progressPct = (completed / total) * 100

  return (
    <div className="b-card" style={{ margin: '0 14px 10px' }}>
      {/* Top row: eyebrow + progress (matches screenshot 04) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 700, fontStyle: 'italic', color: 'var(--blue)', letterSpacing: '-0.005em' }}>
          Getting started
        </span>
        <div className="b-progress-row">
          <span className="b-progress-track">
            <span className="b-progress-fill" style={{ width: `${progressPct}%` }} />
          </span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{completed} / {total}</span>
        </div>
      </div>

      <h3 style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.025em', margin: '0 0 8px', color: 'var(--ink)' }}>
        Welcome to <em className="bg-em">Rally.</em>
      </h3>
      <p style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.5, color: 'var(--ink-2)', margin: '0 0 18px' }}>
        Your matches, auto-scheduled. Your skills, accurately rated.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {activationSteps.map((step, i) => (
          <div key={i} className={`b-step ${step.completed ? 'b-step--done' : 'b-step--pending'}`}>
            <span className="b-step-icon">
              {step.completed ? (
                <svg viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M2.5 6L5 8.5L9.5 4" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : null}
            </span>
            <span>{step.label}</span>
          </div>
        ))}
      </div>

      {nextAction && !hideAction && (
        <button className="b-btn-block" style={{ marginTop: 18 }} onClick={nextAction.action}>
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
