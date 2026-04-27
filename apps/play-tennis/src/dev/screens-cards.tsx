/**
 * /dev/screens — match-card batch (06–11).
 *
 * Self-contained preview compositions for the score-report,
 * rate-match, feedback-saved, needs-response, time-confirmed,
 * and suggest-different-time card states.
 *
 * Compositions render Baseline primitives directly with hardcoded
 * mock data — they are intentionally lightweight previews so design
 * fidelity work doesn't require booting the full match-state machine.
 *
 * The parent agent merges this into MockScreens via `CARDS_SCREENS`.
 */

import { ReactNode, useState } from 'react'
import './css/baseline-cards.css'

export interface ScreenDef {
  id: string
  label: string
  number: string
  render: () => JSX.Element
}

/* ---------- Phone frame + top bar (mirrors MockScreens) ---------- */

function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div style={{
      width: 375, minHeight: 600, margin: '0 auto',
      background: 'var(--bg-2)', border: '1px solid var(--line)',
      borderRadius: 24, overflow: 'hidden',
      boxShadow: '0 8px 32px rgba(11,13,16,0.10)',
    }}>
      {children}
    </div>
  )
}

function TopBar() {
  return (
    <nav className="top-nav">
      <div className="top-nav-logo">
        <img src="/rally-logo.svg" alt="Rally" />
      </div>
      <div className="top-nav-actions">
        <button className="top-nav-icon" aria-label="Messages">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M22 7l-10 7L2 7" />
          </svg>
        </button>
        <button className="top-nav-icon" aria-label="Notifications">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span className="notif-badge">5</span>
        </button>
        <button className="top-nav-icon user-avatar-btn" aria-label="Account">PR</button>
      </div>
    </nav>
  )
}

/* ---------- Reused card head ----------
   Status row (dot + pill), opponent title, supporting copy, primary action. */

function CardHead({
  statusTone = 'blue',
  statusLabel,
  statusMeta,
  vsName,
  supporting,
  primary,
}: {
  statusTone?: 'blue' | 'amber'
  statusLabel: string
  statusMeta?: string
  vsName: string
  supporting: string
  primary: { label: string; tone?: 'soft' }
}) {
  return (
    <>
      <div className="action-card-status-row" style={{ marginBottom: 6 }}>
        <div className={`card-status-label card-status-label--${statusTone === 'amber' ? 'amber' : 'blue'}`}>
          {statusLabel}{statusMeta ? ` · ${statusMeta}` : ''}
        </div>
      </div>
      <div className="action-card-main">
        <div className="action-card-opponent">vs <em className="bg-em">{vsName}</em></div>
        <div className="action-card-supporting">{supporting}</div>
      </div>
      <div className="action-card-buttons" style={{ marginTop: 12 }}>
        <button className="action-card-btn">{primary.label}</button>
        <button className="match-card-msg-btn" aria-label="Message opponent">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 3h12v8H4l-2 2V3z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </>
  )
}

function ActionCard({ children }: { children: ReactNode }) {
  return <div className="action-card">{children}</div>
}

function Expansion({ children }: { children: ReactNode }) {
  // Mirrors MatchActionCard's <div className="action-card-expansion"> so
  // baseline-cards.css picks up the same flat divider treatment.
  return <div className="action-card-expansion">{children}</div>
}

function PageBg({ children }: { children: ReactNode }) {
  return (
    <div style={{ background: 'var(--bg-2)', padding: '14px 0', minHeight: 540 }}>
      {children}
    </div>
  )
}

/* ---------- 06. Score — Report ---------- */

function ScoreReportScreen() {
  return (
    <PhoneFrame>
      <TopBar />
      <PageBg>
        <ActionCard>
          <CardHead
            statusLabel="Score reported"
            statusMeta="1d 7h left"
            vsName="Alex Rivera"
            supporting="Reported 4–6, 4–6. Waiting for opponent confirmation."
            primary={{ label: 'Correct Score' }}
          />
          <Expansion>
            <div className="b-score-grid score-grid" style={{
              display: 'grid', gridTemplateColumns: '1fr 60px 60px',
            }}>
              <div className="score-header"></div>
              <div className="score-header">Set 1</div>
              <div className="score-header">Set 2</div>

              <div className="score-row-label score-row-label--you">
                <span className="b-em">You</span> <span className="b-ink-2">(pili rilph)</span>
              </div>
              <input className="score-input" inputMode="numeric" defaultValue="" />
              <input className="score-input" inputMode="numeric" defaultValue="" />

              <div className="score-row-label score-row-label--opponent">Alex Rivera</div>
              <input className="score-input" inputMode="numeric" defaultValue="" />
              <input className="score-input" inputMode="numeric" defaultValue="" />
            </div>
            <div className="workflow-actions" style={{ marginTop: 16 }}>
              <button className="btn btn-primary" style={{ width: '100%' }}>Report Score</button>
            </div>
          </Expansion>
        </ActionCard>
      </PageBg>
    </PhoneFrame>
  )
}

/* ---------- 07. Score — Rate match ---------- */

function RateMatchScreen() {
  return (
    <PhoneFrame>
      <TopBar />
      <PageBg>
        <ActionCard>
          <CardHead
            statusLabel="Score reported"
            statusMeta="2d 0h left"
            vsName="Alex Rivera"
            supporting="Reported 6–4, 6–4. Waiting for opponent confirmation."
            primary={{ label: 'Correct Score' }}
          />
          <Expansion>
            <div className="workflow-header">
              <div className="schedule-panel-title">How was the match with Alex Rivera?</div>
              <div className="schedule-panel-copy">Your feedback is only visible to Rally.</div>
            </div>
            <div className="feedback-sentiment-row" style={{ marginTop: 16 }}>
              <button className="feedback-sentiment-btn feedback-sentiment--positive">
                <span className="feedback-sentiment-icon">+</span>
                <span>Great match</span>
              </button>
              <button className="feedback-sentiment-btn feedback-sentiment--neutral">
                <span className="feedback-sentiment-icon">=</span>
                <span>Fine</span>
              </button>
              <button className="feedback-sentiment-btn feedback-sentiment--negative">
                <span className="feedback-sentiment-icon">!</span>
                <span>Issue</span>
              </button>
            </div>
          </Expansion>
        </ActionCard>
      </PageBg>
    </PhoneFrame>
  )
}

/* ---------- 08. Feedback saved (+ stacked needs-you card) ---------- */

function FeedbackSavedScreen() {
  return (
    <PhoneFrame>
      <TopBar />
      <PageBg>
        <ActionCard>
          <CardHead
            statusLabel="Score reported"
            statusMeta="2d 0h left"
            vsName="Alex Rivera"
            supporting="Reported 6–4, 6–4. Waiting for opponent confirmation."
            primary={{ label: 'Correct Score' }}
          />
          <Expansion>
            <div className="b-feedback-saved">
              <span className="b-feedback-saved-check" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8.5l3 3 6.5-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <div className="b-feedback-saved-body">
                <div className="b-feedback-saved-title">Thanks for your <em className="bg-em">feedback.</em></div>
                <div className="b-feedback-saved-copy">This information is only for us at Rally.</div>
              </div>
            </div>
          </Expansion>
        </ActionCard>

        <ActionCard>
          <div className="action-card-status-row" style={{ marginBottom: 8 }}>
            <div className="card-status-label card-status-label--amber">Needs you</div>
          </div>
          <div className="action-card-main">
            <div className="action-card-opponent" style={{ margin: 0 }}>
              <em className="bg-em">1</em> proposed time to accept
            </div>
          </div>
        </ActionCard>
      </PageBg>
    </PhoneFrame>
  )
}

/* ---------- 09. Needs response (expanded with time options) ---------- */

function NeedsResponseScreen() {
  return (
    <PhoneFrame>
      <TopBar />
      <PageBg>
        <ActionCard>
          <CardHead
            statusLabel="Needs response"
            vsName="Casey Brooks"
            supporting="Review the proposed time and confirm if it works."
            primary={{ label: 'Confirm Time' }}
          />
          <TimeOptionsBody withSuggest={false} />
        </ActionCard>
      </PageBg>
    </PhoneFrame>
  )
}

/* ---------- Time options (shared body for screens 10/11) ---------- */

function TimeOptionsBody({ withSuggest }: { withSuggest: boolean }) {
  return (
    <Expansion>
      <div className="b-time-options-title">Review Rally's <em className="bg-em">time options.</em></div>
      {!withSuggest && (
        <div className="b-time-options-copy">Choose the best available slot or send a different one.</div>
      )}
      <div className="b-proposal-row">
        <div>
          <div className="b-proposal-time">Sat, Apr 25 9am–11am</div>
          <span className="b-proposal-time-meta">Best match for both of you</span>
        </div>
        <button className="b-proposal-confirm">Confirm</button>
      </div>
      {!withSuggest ? (
        <button className="b-suggest-link">Suggest a different time instead</button>
      ) : (
        <>
          <div className="b-propose-form">
            <select defaultValue="">
              <option value="">Day...</option>
              <option value="sat">Sat</option>
              <option value="sun">Sun</option>
            </select>
            <select defaultValue="18">
              <option value="18">6pm</option>
            </select>
            <select defaultValue="20">
              <option value="20">8pm</option>
            </select>
          </div>
          <div className="b-propose-actions">
            <button className="b-propose-send">Send Proposal</button>
            <button className="b-propose-cancel">Cancel</button>
          </div>
        </>
      )}
    </Expansion>
  )
}

/* ---------- 10. Time confirmed (proposal accepted view) ---------- */

function TimeConfirmedScreen() {
  return (
    <PhoneFrame>
      <TopBar />
      <PageBg>
        <ActionCard>
          <CardHead
            statusLabel="Needs response"
            vsName="Casey Brooks"
            supporting="Review the proposed time and confirm if it works."
            primary={{ label: 'Confirm Time' }}
          />
          <Expansion>
            <div className="b-time-options-title">Review Rally's <em className="bg-em">time options.</em></div>
            <div className="b-proposal-row">
              <div>
                <div className="b-proposal-time">Sat, Apr 25 9am–11am</div>
                <span className="b-proposal-time-meta">Best match for both of you</span>
              </div>
              <button className="b-proposal-confirm">Confirm</button>
            </div>
          </Expansion>
        </ActionCard>
      </PageBg>
    </PhoneFrame>
  )
}

/* ---------- 11. Suggest different time ---------- */

function SuggestTimeScreen() {
  // Toggle showSuggest so the screen renders the inline propose form by default.
  const [_, setExpanded] = useState(true)
  void setExpanded
  return (
    <PhoneFrame>
      <TopBar />
      <PageBg>
        <ActionCard>
          <CardHead
            statusLabel="Needs response"
            vsName="Casey Brooks"
            supporting="Review the proposed time and confirm if it works."
            primary={{ label: 'Confirm Time' }}
          />
          <TimeOptionsBody withSuggest={true} />
        </ActionCard>
      </PageBg>
    </PhoneFrame>
  )
}

/* ---------- Registry ---------- */

export const CARDS_SCREENS: ScreenDef[] = [
  { id: 'score-report',      number: '06', label: 'Score — Report',           render: () => <ScoreReportScreen /> },
  { id: 'rate-match',        number: '07', label: 'Score — Rate match',       render: () => <RateMatchScreen /> },
  { id: 'feedback-saved',    number: '08', label: 'Feedback saved',           render: () => <FeedbackSavedScreen /> },
  { id: 'needs-response',    number: '09', label: 'Needs response',           render: () => <NeedsResponseScreen /> },
  { id: 'time-confirmed',    number: '10', label: 'Time confirmed',           render: () => <TimeConfirmedScreen /> },
  { id: 'suggest-time',      number: '11', label: 'Suggest different time',   render: () => <SuggestTimeScreen /> },
]

export default CARDS_SCREENS
