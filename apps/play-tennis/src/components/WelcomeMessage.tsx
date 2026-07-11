import { useState } from 'react'
import { markConversationRead, RALLY_SYSTEM_ID } from '../store'
import { OverviewSection, SchedulingSection, ScoringSection, DeadlinesSection, CreateTournamentSection, FAQSection } from './HelpSections'

type Section = 'overview' | 'scheduling' | 'scoring' | 'deadlines' | 'create' | 'faq'

const TABS: { id: Section; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'scheduling', label: 'Scheduling' },
  { id: 'scoring', label: 'Scoring' },
  { id: 'deadlines', label: 'Deadlines' },
  { id: 'create', label: 'Create' },
  { id: 'faq', label: 'FAQ' },
]

interface Props {
  currentPlayerId: string
  county: string
  onBack: () => void
  onClose: () => void
}

export default function WelcomeMessage({ currentPlayerId, county, onBack, onClose }: Props) {
  const [active, setActive] = useState<Section>('overview')

  // Mark as read when opened
  markConversationRead(currentPlayerId, RALLY_SYSTEM_ID)

  return (
    <div className="chat-fullscreen">
      <div className="chat-conv-header">
        <button className="chat-back-btn" onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M13 4L7 10l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="chat-conv-avatar chat-conv-avatar--system">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M2.5 12c0-1.5 4-5.5 9.5-5.5s9.5 4 9.5 5.5-4 5.5-9.5 5.5S2.5 13.5 2.5 12z" />
          </svg>
        </div>
        <div className="chat-conv-header-info">
          <span className="chat-conv-header-name">Rally</span>
          <span className="chat-conv-header-sub">How does Rally work?</span>
        </div>
        <button className="chat-close-btn" onClick={onClose} aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="welcome-msg-body">
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
          {active === 'overview' && <OverviewSection county={county} />}
          {active === 'scheduling' && <SchedulingSection />}
          {active === 'scoring' && <ScoringSection />}
          {active === 'deadlines' && <DeadlinesSection />}
          {active === 'create' && <CreateTournamentSection />}
          {active === 'faq' && <FAQSection />}
        </div>
      </div>
    </div>
  )
}
