/**
 * Tournament + Leaderboard preview screens — Baseline reskin.
 *
 * These are static Baseline compositions matching the screenshot targets
 * (19, 24, 25). They live in /dev/screens for design-fidelity iteration
 * without requiring a live tournament/leaderboard data fixture.
 *
 * The parent agent merges TOURNAMENT_SCREENS into the main MockScreens
 * registry; this file owns the compositions only.
 */

import React from 'react'
import './css/baseline-tournament.css'

export interface ScreenDef {
  id: string
  label: string
  number: string
  render: () => JSX.Element
}

/** A phone-shaped frame so previews mimic the target screenshots (~375px wide). */
function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      width: 375, minHeight: 600, margin: '0 auto',
      background: 'var(--bg-2)', border: '1px solid var(--line)',
      borderRadius: 24, overflow: 'hidden',
      boxShadow: '0 8px 32px rgba(11,13,16,0.10)',
    }}>{children}</div>
  )
}

/* ---------- Small reusable bits (local; do not export) ---------- */

function StatusRow({
  tone, label, meta,
}: { tone: 'blue' | 'amber' | 'ink'; label: string; meta?: string }) {
  return (
    <div className="bt-card-status-row">
      <span className={`b-status-dot b-status-dot--${tone}`} />
      <span className={`b-pill b-pill--${tone}`}>
        {label}
        {meta ? <span className="b-ink-2"> · {meta}</span> : null}
      </span>
    </div>
  )
}

function ChatBubbleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  )
}

function SmileyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 2L11 13" />
      <path d="M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  )
}

/* ---------- 19 — Tournament: My Match (with messages) ---------- */

function Screen19MyMatch() {
  return (
    <PhoneFrame>
      <div className="bt-shell">
        <div className="bt-content">
          {/* Segmented: My Matches | All Matches */}
          <div className="bt-segmented" role="tablist" aria-label="Match filter">
            <button className="bt-segmented-btn active" role="tab" aria-selected="true">My Matches</button>
            <button className="bt-segmented-btn" role="tab" aria-selected="false">All Matches</button>
          </div>

          {/* Group eyebrow */}
          <div className="bt-eyebrow">This week</div>

          {/* Match card */}
          <div className="bt-card">
            <StatusRow tone="blue" label="Confirmed" meta="Thu, Apr 30 5pm" />
            <h3 className="bt-card-title">vs <em>Taylor Kim</em></h3>
            <p className="bt-card-body">Confirmed and ready to play.</p>
            <div className="bt-card-actions">
              <button className="bt-btn-soft">View Match</button>
              <button className="bt-icon-btn" aria-label="Message Taylor">
                <ChatBubbleIcon />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="bt-messages-header">
            <div className="bt-messages-stack">
              <span className="bt-messages-eyebrow">Message</span>
              <span className="bt-messages-name">Taylor Kim</span>
            </div>
            <button className="bt-messages-close" aria-label="Close messages">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="bt-message-thread">
            <div className="bt-bubble-row">
              <div className="bt-bubble bt-bubble--out">Hi Taylor</div>
              <span className="bt-bubble-time">6:26 AM</span>
            </div>
          </div>

          <div className="bt-message-input">
            <button type="button" className="bt-message-emoji" aria-label="Add emoji">
              <SmileyIcon />
            </button>
            <input type="text" placeholder="Message…" aria-label="Message" />
            <button className="bt-message-send" aria-label="Send">
              <SendIcon />
            </button>
          </div>
        </div>
      </div>
    </PhoneFrame>
  )
}

/* ---------- 24 — Tournament: All Matches ---------- */

function Screen24AllMatches() {
  return (
    <PhoneFrame>
      <div className="bt-shell">
        {/* Top nav: logo + msg/notif/avatar (matches screen 04/25) */}
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

        <div className="bt-content">
          {/* Needs-response card (top) — target uses blue tone for the dot/pill */}
          <div className="bt-card">
            <StatusRow tone="blue" label="Needs response" />
            <h3 className="bt-card-title">vs <em>Casey Brooks</em></h3>
            <div className="bt-card-actions">
              <button className="bt-btn-soft">Confirm Time</button>
            </div>
          </div>

          {/* Segmented control: All active */}
          <div className="bt-segmented" role="tablist" aria-label="Match filter">
            <button className="bt-segmented-btn" role="tab" aria-selected="false">My Matches</button>
            <button className="bt-segmented-btn active" role="tab" aria-selected="true">All Matches</button>
          </div>

          {/* Group eyebrow */}
          <div className="bt-eyebrow">Week of Apr 27</div>

          {/* Confirmed match (others) */}
          <div className="bt-card">
            <StatusRow tone="blue" label="Confirmed" meta="Tue, Apr 28 7pm" />
            <h3 className="bt-card-title">
              <em>Alex Rivera</em> vs <em>Casey Brooks</em>
            </h3>
            <p className="bt-card-body">Confirmed match time.</p>
            <div className="bt-card-actions">
              <button className="bt-btn-soft">View Time</button>
            </div>
          </div>
        </div>
      </div>
    </PhoneFrame>
  )
}

/* ---------- 25 — Leaderboard ---------- */

interface LeaderRow {
  rank: number
  name: string
  rating: number
  wins: number
  losses: number
  trophy?: boolean
}

const LEADERS: LeaderRow[] = [
  { rank: 1, name: 'Alex Rivera',   rating: 1650, wins: 1, losses: 0, trophy: true },
  { rank: 2, name: 'Alex Rivera',   rating: 1650, wins: 1, losses: 0 },
  { rank: 3, name: 'Jordan Chen',   rating: 1580, wins: 1, losses: 0 },
]

const LEADERS_BOTTOM: LeaderRow[] = [
  { rank: 10, name: 'Casey Brooks', rating: 1440, wins: 1, losses: 0 },
  { rank: 11, name: 'polo ralph',   rating: 1127, wins: 1, losses: 0 },
]

function TrophyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4z" />
      <path d="M17 4h3v3a3 3 0 0 1-3 3" />
      <path d="M7 4H4v3a3 3 0 0 0 3 3" />
    </svg>
  )
}

function LeaderboardRow({ row }: { row: LeaderRow }) {
  const initial = row.name[0].toUpperCase()
  const record = `${row.wins}W–${row.losses}L`
  return (
    <div className="bl-row">
      <span className="bl-row-icon">
        {row.trophy
          ? <span className="bl-row-trophy" aria-label="Top rank"><TrophyIcon /></span>
          : null}
      </span>
      <span className="bl-row-rank">#{row.rank}</span>
      <span className="bl-row-avatar">{initial}</span>
      <span className="bl-row-namecol">
        <span className="bl-row-name">{row.name}</span>
        <span className="bl-row-record">{record}</span>
      </span>
      <span className="bl-row-rating">{row.rating}</span>
    </div>
  )
}

function Screen25Leaderboard() {
  return (
    <PhoneFrame>
      <div className="bt-shell">
        {/* Top nav: logo + msg/notif/avatar (matches screen 04) */}
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

        <div className="bt-content">
          <button className="bl-back" type="button" aria-label="Back">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            <span>Back</span>
          </button>
          <h2 className="bl-title">
            Mineral County <em className="bg-em">Leaderboard.</em>
          </h2>

          <div className="bl-list">
            {LEADERS.map(r => <LeaderboardRow key={r.rank} row={r} />)}
            <div className="bl-gap" aria-hidden="true">
              <span className="bl-gap-dots">…</span>
            </div>
            {LEADERS_BOTTOM.map(r => <LeaderboardRow key={r.rank} row={r} />)}
          </div>
        </div>
      </div>
    </PhoneFrame>
  )
}

/* ---------- Registry export ---------- */

export const TOURNAMENT_SCREENS: ScreenDef[] = [
  {
    id: 'tournament-my-match',
    number: '19',
    label: 'Tournament — My Match',
    render: Screen19MyMatch,
  },
  {
    id: 'tournament-all',
    number: '24',
    label: 'Tournament — All Matches',
    render: Screen24AllMatches,
  },
  {
    id: 'leaderboard',
    number: '25',
    label: 'Leaderboard',
    render: Screen25Leaderboard,
  },
]
