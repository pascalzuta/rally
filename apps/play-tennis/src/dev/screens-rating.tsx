/**
 * Rating screens (13–15) for the /dev/screens preview registry.
 *
 * Exports `RATING_SCREENS` consumed by MockScreens.tsx. Each screen
 * renders a static Baseline composition matching the handoff target
 * screenshots — no contexts, no live data.
 *
 * Targets:
 *  - 13 Rating overview
 *  - 14 Rating trophies + chart
 *  - 15 How ratings work
 */

import './css/baseline-rating.css'

export interface ScreenDef {
  id: string
  label: string
  number: string
  render: () => JSX.Element
}

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

/* ---------- shared mock top nav ---------- */
function MockTopNav() {
  return (
    <nav className="b-mock-nav">
      <div className="b-mock-nav-logo">Rally<sup>*</sup></div>
      <div className="b-mock-nav-actions">
        <button className="b-mock-nav-icon" aria-label="Messages">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M22 7l-10 7L2 7" />
          </svg>
        </button>
        <button className="b-mock-nav-icon" aria-label="Notifications">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span className="b-mock-nav-badge">5</span>
        </button>
        <span className="b-mock-avatar" aria-label="Account">PR</span>
      </div>
    </nav>
  )
}

/* ---------- Screen 13: Rating overview ---------- */
function RatingOverviewScreen() {
  return (
    <PhoneFrame>
      <div className="b-rating">
        <MockTopNav />
        <div className="b-rating-body">
          <section className="b-rating-card" aria-label="Your current rating">
            <div className="b-rating-card-head">
              <div className="b-rating-card-eyebrow">Rally rating</div>
              <span className="b-rating-rank-pill">
                <span>Rank</span>
                <span>#12</span>
              </span>
            </div>

            <h2 className="b-rating-card-title">
              Your current <em className="bg-em">rating.</em>
            </h2>
            <p className="b-rating-card-supporting">
              Ratings adjust after each match and help keep matchups fair.
            </p>

            <div className="b-rating-hero">
              <span className="b-rating-hero-num">1000</span>
            </div>
            <div className="b-rating-hero-caption" style={{ textAlign: 'center' }}>
              YOUR RALLY RATING
            </div>

            <div className="b-rating-progress">
              <span className="b-rating-progress-fill" />
            </div>

            <p className="b-rating-rank-row">
              Rank <em>#12</em> in Mineral County, CO
            </p>
            <p className="b-rating-rank-blurb">
              Ratings adjust after each match — win against stronger players for a bigger boost.
            </p>

            <a className="b-rating-link" href="#">View Mineral County, CO rankings →</a>
          </section>
        </div>
      </div>
    </PhoneFrame>
  )
}

/* ---------- Screen 14: Trophies + chart ---------- */
function TrophyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 4h8v6a4 4 0 0 1-8 0V4z" />
      <path d="M8 6H5a2 2 0 0 0 0 4h3" />
      <path d="M16 6h3a2 2 0 0 1 0 4h-3" />
      <path d="M12 14v4" />
      <path d="M9 20h6" />
    </svg>
  )
}

function RatingChart() {
  // Two horizontal grid rows (1050, 1000) with a line dropping from 1050 to 1000.
  // SVG is overlaid on the grid; coords mapped so y=0 → 1050 row, y=64 → 1000 row.
  return (
    <div>
      <div className="b-chart-y-axis">
        <div className="b-chart-row">
          <span className="b-chart-y-label">1050</span>
          <span className="b-chart-line-cell" />
        </div>
        <div className="b-chart-row">
          <span className="b-chart-y-label">1000</span>
          <span className="b-chart-line-cell" />
        </div>
      </div>
      <div className="b-chart-svg-wrap" aria-hidden="true">
        <svg viewBox="0 0 260 96" preserveAspectRatio="none">
          {/* Line: starts ~1050 (y=8), gentle then drops to 1000 (y=64) */}
          <polyline
            points="0,8 60,12 120,18 180,40 240,64"
            fill="none"
            stroke="#2563ff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="240" cy="64" r="4.5" fill="#2563ff" />
        </svg>
      </div>
    </div>
  )
}

function RatingTrophiesScreen() {
  return (
    <PhoneFrame>
      <div className="b-rating">
        <MockTopNav />
        <div className="b-rating-body">
          <section className="b-trophies-card" aria-label="Trophies">
            <div className="b-status-row">
              <span className="b-status-row-dot" />
              <span className="b-status-row-label">Trophies</span>
            </div>
            <div className="b-trophies-empty">
              <div className="b-trophy-icon"><TrophyIcon /></div>
              <h3 className="b-trophies-title">No trophies yet</h3>
              <p className="b-trophies-body">
                Win tournaments to earn trophies and climb the leaderboard
              </p>
            </div>
          </section>

          <section className="b-chart-card" aria-label="Your rating over time">
            <div className="b-status-row">
              <span className="b-status-row-dot" />
              <span className="b-status-row-label">Your rating over time</span>
            </div>
            <RatingChart />
          </section>
        </div>
      </div>
    </PhoneFrame>
  )
}

/* ---------- Screen 15: How ratings work ---------- */
function HowRatingsWorkScreen() {
  return (
    <PhoneFrame>
      <div className="b-rating">
        <MockTopNav />
        <div className="b-rating-body">
          <section className="b-how-card" aria-label="How ratings work">
            <div className="b-how-head">
              <h3 className="b-how-title">How ratings work</h3>
              <button className="b-how-chevron" aria-label="Collapse">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            </div>

            <p className="b-how-body">
              Rally uses <strong>skill rating system</strong>, similar to chess rankings.
              Every player starts at <strong>1000</strong>.
            </p>
            <p className="b-how-body-muted">
              Beat a stronger opponent for a bigger boost. Lose to a weaker one and you drop more.
              The system finds your <em>true level</em> over time.
            </p>

            <div className="b-tier-table">
              <div className="b-tier-row">
                <span className="b-tier-rail b-tier-rail--pro" />
                <span className="b-tier-range">2200+</span>
                <span className="b-tier-name">Pro</span>
              </div>
              <div className="b-tier-row">
                <span className="b-tier-rail b-tier-rail--semi" />
                <span className="b-tier-range">2000–2199</span>
                <span className="b-tier-name">Semi-Pro</span>
              </div>
              <div className="b-tier-row">
                <span className="b-tier-rail b-tier-rail--elite" />
                <span className="b-tier-range">1800–1999</span>
                <span className="b-tier-name">Elite</span>
              </div>
              <div className="b-tier-row">
                <span className="b-tier-rail b-tier-rail--strong" />
                <span className="b-tier-range">1600–1799</span>
                <span className="b-tier-name">Strong</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </PhoneFrame>
  )
}

export const RATING_SCREENS: ScreenDef[] = [
  {
    id: 'rating-overview',
    number: '13',
    label: 'Rating — Overview',
    render: RatingOverviewScreen,
  },
  {
    id: 'rating-trophies',
    number: '14',
    label: 'Rating — Trophies',
    render: RatingTrophiesScreen,
  },
  {
    id: 'how-ratings-work',
    number: '15',
    label: 'How ratings work',
    render: HowRatingsWorkScreen,
  },
]
