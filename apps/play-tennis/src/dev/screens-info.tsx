/**
 * /dev/screens — info & marketing screens (05, 26, 27).
 *
 * These are the Baseline-reskinned static / informational surfaces:
 *   05 — Home / How it works (the WelcomeCard expanded HIW state)
 *   26 — Blog landing ("The Baseline")
 *   27 — Help Center
 *
 * Exported as INFO_SCREENS so MockScreens.tsx can register them
 * alongside the other screen batches once integration lands.
 */

import { lazy, Suspense } from 'react'
import './css/baseline-info.css'

const WelcomeCard = lazy(() => import('../components/WelcomeCard'))
const Help = lazy(() => import('../components/Help'))

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

const ALL_DONE = [
  { label: 'Set up your profile', completed: true },
  { label: 'Join the Mineral County, CO lobby', completed: true },
  { label: 'Set your availability', completed: true },
  { label: 'Play your first match', completed: false },
]

export const INFO_SCREENS: ScreenDef[] = [
  {
    id: 'home-how-it-works',
    number: '05',
    label: 'Home — How it works',
    render: () => (
      <PhoneFrame>
        {/* Mimic the App.tsx top bar */}
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

        <div className="screen bi-hiw-only" style={{ paddingBottom: 24 }}>
          <Suspense fallback={null}>
            <WelcomeCard
              activationSteps={ALL_DONE}
              county="mineral county, co"
              onJoinLobby={() => {}}
              onSetAvailability={() => {}}
              onFindMatch={() => {}}
              hideAction
              initialHiwExpanded
            />
          </Suspense>
        </div>
      </PhoneFrame>
    ),
  },

  {
    id: 'blog-landing',
    number: '26',
    label: 'Blog — The Baseline',
    render: () => (
      <PhoneFrame>
        <div className="b-page bi-blog-page">
          <nav className="b-page-nav bi-marketing-nav" aria-label="Main">
            <div className="bi-marketing-nav-left">
              <span className="bi-marketing-logo">Rally</span>
              <span className="bi-marketing-nav-tag">The<br />Baseline</span>
              <a href="#" className="bi-marketing-nav-link" style={{ marginLeft: 6 }}>Articles</a>
            </div>
            <div className="bi-marketing-nav-right">
              <button className="bi-marketing-cta" type="button">Play Rally</button>
            </div>
          </nav>

          <div className="b-page-content bi-blog-content">
            <header className="bi-blog-hero">
              <h1 className="bi-blog-title">
                The <em className="bg-em">Baseline.</em>
              </h1>
              <p className="bi-blog-sub">
                Technique breakdowns, match analytics, and the science of winning tennis.
              </p>
            </header>

            <span className="bi-blog-section-eyebrow">Analytics &amp; Metrics</span>

            <a href="#" className="bi-blog-card">
              <span className="bi-blog-card-cat">Analytics</span>
              <h2 className="bi-blog-card-title">
                Tennis Analytics: Key Metrics That Predict Match Outcomes
              </h2>
              <p className="bi-blog-card-excerpt">
                From first-serve percentage to return points won — the established metrics
                that drive win probability models in modern tennis.
              </p>
            </a>

            <a href="#" className="bi-blog-card">
              <span className="bi-blog-card-cat">Strategy</span>
              <h2 className="bi-blog-card-title">
                Return of Serve: Reading, Positioning &amp; Neutralizing
              </h2>
              <p className="bi-blog-card-excerpt">
                A field guide to neutralizing big servers — split-step timing, depth,
                and the two-shot patterns the pros use to swing momentum.
              </p>
            </a>
          </div>
        </div>
      </PhoneFrame>
    ),
  },

  {
    id: 'help-center',
    number: '27',
    label: 'Help Center',
    render: () => (
      <PhoneFrame>
        <Suspense fallback={null}>
          <Help onBack={() => {}} />
        </Suspense>
      </PhoneFrame>
    ),
  },
]

export default INFO_SCREENS
