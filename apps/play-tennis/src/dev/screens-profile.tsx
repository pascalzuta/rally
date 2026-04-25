/**
 * /dev/screens — Profile / Availability / Quick Play previews.
 *
 * Static compositions (hardcoded data) used for design fidelity work.
 * Exposes PROFILE_SCREENS so the parent /dev/screens index can import
 * and append them. ScreenDef and PhoneFrame are defined locally so this
 * module is self-contained.
 *
 * Targets:
 *   12 — Quick Play
 *   16 — Profile
 *   17 — Availability (presets)
 *   18 — Availability (custom)
 */

import { ReactNode } from 'react'
import './css/baseline-profile.css'

export interface ScreenDef {
  id: string
  label: string
  number: string
  render: () => JSX.Element
}

function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div style={{
      width: 375, minHeight: 600, margin: '0 auto',
      background: 'var(--bg-2)', border: '1px solid var(--line)',
      borderRadius: 24, overflow: 'hidden',
      boxShadow: '0 8px 32px rgba(11,13,16,0.10)',
    }}>{children}</div>
  )
}

/* ----------------------- shared bits ----------------------- */

function TopNav() {
  return (
    <nav className="bp-topnav">
      <span className="bp-topnav-logo">Rally</span>
      <div className="bp-topnav-actions">
        <button className="bp-topnav-icon" aria-label="Messages">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M22 7l-10 7L2 7" />
          </svg>
        </button>
        <button className="bp-topnav-icon" aria-label="Notifications">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span className="bp-topnav-badge">5</span>
        </button>
        <button className="bp-topnav-avatar" aria-label="Account">PR</button>
      </div>
    </nav>
  )
}

/* ----------------------- 12 — Quick Play ----------------------- */

function QuickPlayScreen() {
  return (
    <PhoneFrame>
      <TopNav />
      <div className="bp-page">
        {/* Info card */}
        <div className="bp-card bp-info-card">
          <span className="bp-info-icon" aria-hidden="true">i</span>
          <p className="bp-info-body">
            See who&apos;s available and start a match — Rally handles the scheduling.
          </p>
        </div>

        {/* Hero status card */}
        <div className="bp-card">
          <div className="bp-status-row">
            <span className="bp-status-dot" />
            <span className="bp-status-pill">Quick Play</span>
          </div>
          <h3 className="bp-title">
            I&apos;m <em className="bp-em">free to play.</em>
          </h3>
          <p className="bp-body">
            Broadcast your availability so nearby tournament players can send a request.
          </p>
        </div>

        {/* Section eyebrow */}
        <div className="bp-section-eyebrow">
          <span className="bp-status-dot" />
          <span className="bp-eyebrow-pill">Who&apos;s free</span>
          <span style={{ color: 'var(--ink)', fontWeight: 700, marginLeft: 4 }}>TODAY</span>
        </div>

        {/* Player row card */}
        <div className="bp-card bp-player-card">
          <div className="bp-player-head">
            <span className="bp-player-eyebrow">Available</span>
            <span className="bp-player-meta">Today 5pm – 8pm</span>
          </div>
          <div className="bp-player-row">
            <span className="bp-player-avatar">T</span>
            <span className="bp-player-name">Taylor Kim</span>
          </div>
          <p className="bp-player-sub">
            Tournament player available for a casual match
          </p>
          <button className="bp-player-cta">Send a match request</button>
        </div>
      </div>
    </PhoneFrame>
  )
}

/* ----------------------- 16 — Profile ----------------------- */

function ProfileScreen() {
  return (
    <PhoneFrame>
      <TopNav />
      <div className="bp-page">
        {/* Hero */}
        <div className="bp-profile-hero">
          <div className="bp-profile-band" />
          <div className="bp-profile-avatar-wrap">
            <span className="bp-profile-avatar">P</span>
          </div>
          <h2 className="bp-profile-name">
            pili <em className="bp-em">rilph</em>
          </h2>
          <p className="bp-profile-loc">Mineral County, CO</p>
          <div className="bp-profile-meta">
            <span className="bp-profile-meta-pill">Intermediate</span>
            <span className="bp-profile-meta-cap">Joined Apr 2026</span>
          </div>
          <div className="bp-stats">
            <div className="bp-stat">
              <div className="bp-stat-value bp-stat-value--em" style={{ fontStyle: 'italic' }}>1000</div>
              <div className="bp-stat-label">Rating</div>
            </div>
            <div className="bp-stat">
              <div className="bp-stat-value" style={{ fontStyle: 'italic' }}>0–0</div>
              <div className="bp-stat-label">W – L</div>
            </div>
            <div className="bp-stat">
              <div className="bp-stat-value" style={{ fontStyle: 'italic' }}>1</div>
              <div className="bp-stat-label">Tournaments</div>
            </div>
          </div>
        </div>

        {/* Availability summary card */}
        <div className="bp-card bp-avail-card">
          <div className="bp-avail-head">
            <div>
              <h3 className="bp-avail-title">Availability</h3>
              <p className="bp-avail-subtitle">More times = more auto-scheduled matches</p>
            </div>
            <button className="bp-avail-edit">Edit</button>
          </div>
          <div className="bp-slot-list" style={{ marginTop: 16 }}>
            <div className="bp-slot-row">
              <span className="bp-slot-day">Sat</span>
              <span className="bp-slot-time">8am–12pm</span>
            </div>
            <div className="bp-slot-row">
              <span className="bp-slot-day">Sun</span>
              <span className="bp-slot-time">8am–12pm</span>
            </div>
          </div>
        </div>
      </div>
    </PhoneFrame>
  )
}

/* ----------------------- 17 — Availability presets ----------------------- */

function AvailabilityHeader({ active }: { active: 'custom' | 'presets' }) {
  return (
    <>
      <h3 className="bp-avail-title">Availability</h3>
      <p className="bp-avail-subtitle">More times = more auto-scheduled matches</p>
      <div className="bp-segmented">
        <button className={`bp-segmented-btn ${active === 'custom' ? 'bp-segmented-btn--active' : ''}`}>
          Custom times
        </button>
        <button className={`bp-segmented-btn ${active === 'presets' ? 'bp-segmented-btn--active' : ''}`}>
          Quick presets
        </button>
      </div>
    </>
  )
}

function AvailabilityPresetsScreen() {
  const presets = [
    { label: 'Weekday evenings', active: false },
    { label: 'Weekend mornings', active: true },
    { label: 'Weekend afternoons', active: false },
    { label: 'Weekday mornings', active: false },
    { label: 'Weekday afternoons', active: false },
  ]
  return (
    <PhoneFrame>
      <TopNav />
      <div className="bp-page">
        <div className="bp-card bp-avail-card">
          <AvailabilityHeader active="presets" />
          <p className="bp-avail-helper">Tap to add common time blocks</p>
          <div className="bp-preset-list">
            {presets.map(p => (
              <div
                key={p.label}
                className={`bp-preset-row ${p.active ? 'bp-preset-row--active' : ''}`}
              >
                {p.active ? (
                  <span className="bp-preset-check" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
                         strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                ) : null}
                <span>{p.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PhoneFrame>
  )
}

/* ----------------------- 18 — Availability custom ----------------------- */

function AvailabilityCustomScreen() {
  return (
    <PhoneFrame>
      <TopNav />
      <div className="bp-page">
        <div className="bp-card bp-avail-card">
          <AvailabilityHeader active="custom" />

          {/* Day + time + Add row */}
          <div className="bp-custom-row">
            <button className="bp-custom-pill">Mon</button>
            <button className="bp-custom-pill">9am</button>
            <button className="bp-custom-pill">12pm</button>
            <button className="bp-custom-pill bp-custom-pill--add">Add</button>
          </div>

          {/* Saved slots */}
          <div className="bp-slot-list">
            <div className="bp-slot-row">
              <span className="bp-slot-day">Saturday</span>
              <span className="bp-slot-time">8am–12pm</span>
              <button className="bp-slot-x" aria-label="Remove">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none"
                     stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="bp-slot-row">
              <span className="bp-slot-day">Sunday</span>
              <span className="bp-slot-time">8am–12pm</span>
              <button className="bp-slot-x" aria-label="Remove">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none"
                     stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          <div className="bp-action-row">
            <button className="bp-btn-primary">Save</button>
            <button className="bp-btn-ghost">Cancel</button>
          </div>
        </div>

        <div className="bp-footer-link">How Rally Works</div>
      </div>
    </PhoneFrame>
  )
}

/* ----------------------- exported registry ----------------------- */

export const PROFILE_SCREENS: ScreenDef[] = [
  { id: 'quick-play',           number: '12', label: 'Quick Play',                render: QuickPlayScreen },
  { id: 'profile',              number: '16', label: 'Profile',                   render: ProfileScreen },
  { id: 'availability-presets', number: '17', label: 'Availability — presets',    render: AvailabilityPresetsScreen },
  { id: 'availability-custom',  number: '18', label: 'Availability — custom',     render: AvailabilityCustomScreen },
]
