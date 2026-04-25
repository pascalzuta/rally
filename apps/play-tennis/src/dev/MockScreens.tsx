/**
 * /dev/screens — design preview index for the Rally reskin work.
 *
 * Renders real Rally components inside MockProviders so design fidelity
 * iteration doesn't require a live login. Visit:
 *   /dev/screens                 → index of all screens
 *   /dev/screens/home-welcome    → individual screen
 *
 * Production-stripped via the dev-only route guard in main.tsx — only
 * mounted on import.meta.env.DEV or the reskin-staging Vercel preview.
 */

import { lazy, Suspense } from 'react'
import { MockProviders } from './MockProviders'
import { MOCK_PROFILE, MOCK_TOURNAMENT } from './mockData'
import WelcomeCard, { ActivationStep } from '../components/WelcomeCard'

const ACTIVATION_DONE: ActivationStep[] = [
  { label: 'Set up your profile', completed: true },
  { label: 'Join the Mineral County, CO lobby', completed: true },
  { label: 'Set your availability', completed: true },
  { label: 'Play your first match', completed: false },
]

// Batch-2 screen registries — each module side-effect imports its own
// dev/css/baseline-*.css, so we just import the array and spread it.
import { CARDS_SCREENS } from './screens-cards'
import { RATING_SCREENS } from './screens-rating'
import { MESSAGES_SCREENS } from './screens-messages'
import { TOURNAMENT_SCREENS } from './screens-tournament'
import { PROFILE_SCREENS } from './screens-profile'
import { INFO_SCREENS } from './screens-info'

// Lazy-load larger surfaces so the dev page itself stays light.
const HomeHeroCard = lazy(() => import('../components/HomeHeroCard'))

interface ScreenDef {
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
    }}>
      {children}
    </div>
  )
}

const SCREENS: ScreenDef[] = [
  {
    id: 'home-welcome',
    number: '04',
    label: 'Home — Welcome',
    render: () => (
      <PhoneFrame>
        {/* Top bar (mimics App.tsx) */}
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

        {/* Tournament card via real component */}
        <div className="screen" style={{ paddingBottom: 24 }}>
          <Suspense fallback={null}>
            <HomeHeroCard
              profile={MOCK_PROFILE}
              tournaments={[MOCK_TOURNAMENT]}
              actionCardCount={1}
              onTournamentCreated={() => {}}
              onSetAvailability={() => {}}
              onJoinLobby={() => {}}
              onFindMatch={() => {}}
              hideOnboarding
            />
          </Suspense>

          {/* Welcome card via real component — sibling card per target screenshot */}
          <WelcomeCard
            activationSteps={ACTIVATION_DONE}
            county="mineral county, co"
            onJoinLobby={() => {}}
            onSetAvailability={() => {}}
            onFindMatch={() => {}}
            hideAction
          />
        </div>
      </PhoneFrame>
    ),
  },
  ...CARDS_SCREENS,
  ...RATING_SCREENS,
  ...MESSAGES_SCREENS,
  ...TOURNAMENT_SCREENS,
  ...PROFILE_SCREENS,
  ...INFO_SCREENS,
]

export default function MockScreens() {
  const path = window.location.pathname
  // /dev/screens/<id>
  const m = path.match(/^\/dev\/screens\/([^/]+)/)
  const targetId = m?.[1]
  const screen = SCREENS.find(s => s.id === targetId)

  // Index page
  if (!screen) {
    return (
      <MockProviders>
        <div style={{
          maxWidth: 800, margin: '0 auto', padding: 24,
          fontFamily: 'Inter, system-ui, sans-serif', color: 'var(--ink)',
        }}>
          <header style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.025em', margin: '0 0 6px' }}>
              Rally <em className="bg-em">design preview</em>
            </h1>
            <p style={{ color: 'var(--ink-2)', fontSize: 14, margin: 0 }}>
              Renders real components against seeded mock data — for design fidelity work only.
              Available in dev + on the reskin-staging preview. Stripped from production.
            </p>
          </header>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
            {SCREENS.map(s => (
              <li key={s.id}>
                <a
                  href={`/dev/screens/${s.id}`}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px 16px', background: 'var(--bg)',
                    border: '1px solid var(--line)', borderRadius: 12,
                    color: 'var(--ink)', textDecoration: 'none', fontSize: 14, fontWeight: 500,
                  }}
                >
                  <span>
                    <span style={{ color: 'var(--ink-2)', marginRight: 10 }}>{s.number}</span>
                    {s.label}
                  </span>
                  <span style={{ color: 'var(--blue)' }}>→</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </MockProviders>
    )
  }

  // Single screen page
  return (
    <MockProviders>
      <div style={{ minHeight: '100vh', background: '#e8e8e8', padding: '32px 16px' }}>
        <a
          href="/dev/screens"
          style={{
            display: 'inline-block', marginBottom: 18,
            color: 'var(--ink)', textDecoration: 'none',
            fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 500,
          }}
        >
          ← All screens
        </a>
        <div style={{ marginBottom: 12, fontFamily: 'Inter, sans-serif', fontSize: 12, color: 'var(--ink-2)', textAlign: 'center' }}>
          {screen.number} — {screen.label}
        </div>
        {screen.render()}
      </div>
    </MockProviders>
  )
}
