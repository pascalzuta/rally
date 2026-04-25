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

function MessageIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M22 7l-10 7L2 7" />
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
            <StatusRow tone="blue" label="Confirmed" meta="Thu, Apr 23 6pm" />
            <h3 className="bt-card-title">vs <em>Taylor Kim</em></h3>
            <p className="bt-card-body">Confirmed and ready to play.</p>
            <div className="bt-card-actions">
              <button className="bt-btn-soft">View Match</button>
              <button className="bt-icon-btn" aria-label="Message Taylor">
                <MessageIcon />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="bt-messages-header">
            <span className="bt-messages-eyebrow">Messages</span>
            <span className="bt-messages-name">Taylor Kim</span>
            <button className="bt-messages-close" aria-label="Close messages">×</button>
          </div>

          <div className="bt-message-thread">
            <div className="bt-bubble-row">
              <div className="bt-bubble bt-bubble--out">Hi Taylor</div>
              <span className="bt-bubble-time">6:35 AM</span>
            </div>
          </div>

          <div className="bt-message-input">
            <input type="text" placeholder="Message Taylor…" aria-label="Message" />
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
        <div className="bt-content">
          {/* Needs-response card (top) */}
          <div className="bt-card">
            <StatusRow tone="amber" label="Needs response" />
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
  warn?: boolean
}

const LEADERS: LeaderRow[] = [
  { rank: 1, name: 'Alex Rivera',   rating: 1650, wins: 12, losses: 3, warn: true },
  { rank: 2, name: 'Taylor Kim',    rating: 1612, wins: 10, losses: 4 },
  { rank: 3, name: 'Casey Brooks',  rating: 1584, wins: 9,  losses: 5 },
]

const LEADER_TENTH: LeaderRow = {
  rank: 10, name: 'Pascal R', rating: 1432, wins: 4, losses: 6,
}

function LeaderboardRow({ row }: { row: LeaderRow }) {
  const initial = row.name[0].toUpperCase()
  const record = `${row.wins}-${row.losses}`
  return (
    <div className="bl-row">
      {row.warn
        ? <span className="bl-row-warn" aria-label="Attention">!</span>
        : <span className="bl-row-warn bl-row-warn--placeholder" aria-hidden="true">!</span>
      }
      <span className="bl-row-rank">{row.rank}</span>
      <span className="bl-row-avatar">{initial}</span>
      <span className="bl-row-name">{row.name}</span>
      <span className="bl-row-stats">
        <span className="bl-row-rating">{row.rating}</span>
        <span className="bl-row-record">{record} W-L</span>
      </span>
    </div>
  )
}

function Screen25Leaderboard() {
  return (
    <PhoneFrame>
      <div className="bt-shell">
        <div className="bt-topbar">
          <div className="bt-topbar-left">
            <button className="bt-topbar-back" type="button">← Back</button>
          </div>
        </div>
        <div className="bt-content">
          <h3 className="bt-screen-title">
            Mineral County <em>Leaderboard.</em>
          </h3>

          <div className="bl-list">
            {LEADERS.map(r => <LeaderboardRow key={r.rank} row={r} />)}
            <div className="bl-gap" aria-hidden="true">
              <span className="bl-gap-dots">...</span>
            </div>
            <LeaderboardRow row={LEADER_TENTH} />
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
