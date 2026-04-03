import { signInWithGoogle } from '../supabase'

interface Props {
  onSignUp: () => void
}

/**
 * Ad-optimized landing page for paid traffic (Meta/Google ads).
 * Strava pattern: minimal, no nav distractions, single CTA focus.
 * Route: /join
 */
export default function JoinLanding({ onSignUp }: Props) {
  return (
    <div className="join-page" style={{ background: '#FAF5ED' }}>
      <div className="join-inner">
        {/* Logo */}
        <div className="join-logo">
          <span style={{ fontFamily: "'Playfair Display', 'DM Serif Display', Georgia, serif", fontSize: 32, fontWeight: 700, color: '#1B2B4B', letterSpacing: '-0.01em' }}>rally.</span>
        </div>

        {/* Hero */}
        <div className="join-hero">
          <h1 className="join-title" style={{ fontFamily: "'Playfair Display', 'DM Serif Display', Georgia, serif", color: '#1B2B4B' }}>Stop texting.<br />Start playing.</h1>
          <p className="join-subtitle" style={{ color: '#4A5568' }}>
            Rally auto-schedules local tennis matches based on your availability.
            Join 2,400+ players for free.
          </p>
        </div>

        {/* CTAs — Strava pattern: social first */}
        <div className="join-ctas">
          <button
            type="button"
            className="sh-btn-signup sh-btn-google"
            onClick={() => signInWithGoogle()}
            style={{ borderRadius: 999 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Sign Up with Google
          </button>
          <button className="sh-btn-signup sh-btn-email" onClick={onSignUp} style={{ borderRadius: 999 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/></svg>
            Sign Up with Email
          </button>
        </div>

        <p className="join-legal">
          By signing up, you agree to Rally's <a href="/support/">Terms</a> and <a href="/support/">Privacy Policy</a>.
        </p>

        {/* How it works — compact 3-step */}
        <div className="join-steps">
          <div className="join-step">
            <div className="join-step-num" style={{ background: '#1B2B4B', color: '#fff' }}>1</div>
            <div>
              <strong>Join your county</strong>
              <p>Sign up and join your local tennis community.</p>
            </div>
          </div>
          <div className="join-step">
            <div className="join-step-num" style={{ background: '#1B2B4B', color: '#fff' }}>2</div>
            <div>
              <strong>Set your availability</strong>
              <p>Tell us when you're free to play.</p>
            </div>
          </div>
          <div className="join-step">
            <div className="join-step-num" style={{ background: '#1B2B4B', color: '#fff' }}>3</div>
            <div>
              <strong>Show up and play</strong>
              <p>We auto-schedule your matches. 80% confirmed instantly.</p>
            </div>
          </div>
        </div>

        {/* Social proof */}
        <div className="join-stats" style={{ background: '#1B2B4B', borderRadius: 12, overflow: 'hidden', display: 'flex', gap: 0 }}>
          {[
            { num: '2,400+', label: 'Players' },
            { num: '180+', label: 'Counties' },
            { num: '80%', label: 'Auto-scheduled' },
          ].map((s, i) => (
            <div key={i} className="join-stat" style={{ flex: 1, background: 'transparent', padding: '16px 0', textAlign: 'center' as const, borderRight: i < 2 ? '1px solid rgba(255,255,255,0.12)' : 'none' }}>
              <span className="join-stat-num" style={{ color: '#fff', fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' }}>{s.num}</span>
              <span className="join-stat-label" style={{ color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase' as const, fontSize: 11, letterSpacing: '0.06em' }}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <button className="sh-btn-cta sh-btn-cta-large join-bottom-cta" onClick={onSignUp} style={{ background: '#C9A84C', color: '#fff', border: 'none', borderRadius: 999, fontWeight: 600 }}>
          Join Rally — It's Free
        </button>

        <p className="auth-switch" style={{ marginTop: 16 }}>
          Already a member? <a href="/login" className="sh-link">Log In</a>
        </p>
      </div>
    </div>
  )
}
