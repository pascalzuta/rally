import { useNavigate } from 'react-router-dom'
import { signInWithGoogle } from '../supabase'

interface Props {
  onGetStarted: () => void
  onLogin?: () => void
}

export default function DesktopGuestHomepage({ onGetStarted, onLogin }: Props) {
  const navigate = useNavigate()

  function handleLogin() {
    if (onLogin) onLogin()
    else navigate('/login')
  }

  return (
    <div className="strava-home">
      {/* Nav */}
      <nav className="sh-nav">
        <div className="sh-nav-inner">
          <div className="sh-nav-left">
            <img className="rally-logo" height="36" src="/rally-logo.svg" alt="Rally" />
            <div className="sh-nav-links">
              <a href="#how-it-works" className="sh-nav-link">How It Works</a>
              <a href="#features" className="sh-nav-link">Features</a>
              <a href="/blog/" className="sh-nav-link">Blog</a>
              <a href="/support/" className="sh-nav-link">Help</a>
            </div>
          </div>
          <div className="sh-nav-right">
            <button className="sh-btn-text" onClick={handleLogin}>Log In</button>
            <button className="sh-btn-cta" onClick={onGetStarted}>Sign Up Free</button>
          </div>
        </div>
      </nav>

      {/* Hero — Strava pattern: headline + social proof + stacked CTAs + lifestyle image */}
      <section className="sh-hero">
        <div className="sh-hero-inner">
          <div className="sh-hero-content">
            <h1 className="sh-hero-title">Community-Powered<br />Competition</h1>
            <p className="sh-hero-subtitle">
              Find local opponents and let us handle the scheduling.<br className="sh-hide-mobile" />
              Join 2,400+ active players on Rally for free.
            </p>
            <div className="sh-hero-ctas">
              <button className="sh-btn-signup sh-btn-google" onClick={() => signInWithGoogle()}>
                <svg width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Sign Up with Google
              </button>
              <button className="sh-btn-signup sh-btn-email" onClick={onGetStarted}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/></svg>
                Sign Up with Email
              </button>
            </div>
            <p className="sh-hero-existing">
              Already a member? <button className="sh-link" onClick={handleLogin}>Log In</button>
            </p>
            <p className="sh-hero-legal">
              By signing up, you agree to Rally's <a href="/support/" className="sh-link-muted">Terms of Service</a> and <a href="/support/" className="sh-link-muted">Privacy Policy</a>.
            </p>
          </div>
          <div className="sh-hero-visual">
            <div className="sh-hero-image-wrapper">
              {/* Lifestyle tennis image — swap for Nano Banana photo */}
              <img
                src="https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=600&h=750&fit=crop&crop=center"
                alt="Tennis player on court"
                className="sh-hero-image"
                loading="eager"
              />
              <div className="sh-hero-overlay">
                <div className="sh-phone-mockup">
                  <div className="sh-phone-screen">
                    <div className="sh-mock-header">
                      <span className="sh-mock-dot sh-mock-dot-green" />
                      <span className="sh-mock-status">Auto-scheduled</span>
                      <span className="sh-mock-count">12 of 15</span>
                    </div>
                    <div className="sh-mock-match">
                      <div className="sh-mock-match-row">
                        <span>vs Sarah P.</span>
                        <span className="sh-mock-badge sh-mock-badge-green">Confirmed</span>
                      </div>
                      <span className="sh-mock-time">Sat, Apr 5 · 9:00 AM</span>
                    </div>
                    <div className="sh-mock-match">
                      <div className="sh-mock-match-row">
                        <span>vs James K.</span>
                        <span className="sh-mock-badge sh-mock-badge-green">Confirmed</span>
                      </div>
                      <span className="sh-mock-time">Sun, Apr 6 · 10:30 AM</span>
                    </div>
                    <div className="sh-mock-match">
                      <div className="sh-mock-match-row">
                        <span>vs Mike R.</span>
                        <span className="sh-mock-badge sh-mock-badge-blue">Proposed</span>
                      </div>
                      <span className="sh-mock-time">Tue, Apr 8 · 6:00 PM</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Identity statement — Strava: "If you're active, Strava was made for you" */}
      <section className="sh-section sh-identity">
        <div className="sh-section-inner">
          <h2 className="sh-identity-headline">If you play tennis, Rally was made for you.</h2>
          <p className="sh-identity-copy">
            Our web app eliminates the scheduling headache and connects you with local players at your level.
            We're the competitive network for players who'd rather play than plan.
          </p>
        </div>
      </section>

      {/* Three pillars — Strava: Track/Connect/Compete */}
      <section className="sh-section sh-pillars" id="features">
        <div className="sh-section-inner">
          <h2 className="sh-section-title">What Rally does for you</h2>
          <div className="sh-pillars-grid">
            <div className="sh-pillar">
              <div className="sh-pillar-image-wrap">
                <img
                  src="https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=400&h=280&fit=crop&crop=center"
                  alt="Tennis scheduling"
                  className="sh-pillar-image"
                  loading="lazy"
                />
              </div>
              <h3 className="sh-pillar-title">Schedule & Play</h3>
              <p className="sh-pillar-desc">
                Set your availability once. Rally finds overlapping windows and auto-schedules your matches — 80% confirmed without a single message.
              </p>
            </div>
            <div className="sh-pillar">
              <div className="sh-pillar-image-wrap">
                <img
                  src="https://images.unsplash.com/photo-1551773188-d4f4823cf391?w=400&h=280&fit=crop&crop=center"
                  alt="Tennis rating and improvement"
                  className="sh-pillar-image"
                  loading="lazy"
                />
              </div>
              <h3 className="sh-pillar-title">Rate & Improve</h3>
              <p className="sh-pillar-desc">
                Your Rally Rating adjusts after every match based on real results, not self-assessment. Track your progress and see how you stack up.
              </p>
            </div>
            <div className="sh-pillar">
              <div className="sh-pillar-image-wrap">
                <img
                  src="https://images.unsplash.com/photo-1599586120429-48281b6f0ece?w=400&h=280&fit=crop&crop=center"
                  alt="Tennis community and competition"
                  className="sh-pillar-image"
                  loading="lazy"
                />
              </div>
              <h3 className="sh-pillar-title">Compete & Connect</h3>
              <p className="sh-pillar-desc">
                Join round-robin tournaments in your county. Fair opponents at your skill level, leaderboards, trophies, and a real local tennis scene.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Join for X, stay for Y — Strava pattern */}
      <section className="sh-section sh-benefits">
        <div className="sh-section-inner">
          <h2 className="sh-section-title">Join for the scheduling, stay for the competition</h2>
          <div className="sh-benefits-grid">
            <div className="sh-benefit-card">
              <div className="sh-benefit-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-positive-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                  <path d="M9 16l2 2 4-4"/>
                </svg>
              </div>
              <h3 className="sh-benefit-title">Set your times, we do the rest</h3>
              <p className="sh-benefit-desc">
                Tell Rally when you're free. We match you with available opponents and confirm the time automatically. Zero back-and-forth.
              </p>
            </div>
            <div className="sh-benefit-card">
              <div className="sh-benefit-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-positive-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <h3 className="sh-benefit-title">A real tennis network</h3>
              <p className="sh-benefit-desc">
                No group chat spam, no ghosting. Rally connects serious players in your area who actually show up and compete.
              </p>
            </div>
            <div className="sh-benefit-card">
              <div className="sh-benefit-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-positive-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="7"/>
                  <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>
                </svg>
              </div>
              <h3 className="sh-benefit-title">Your local competitive scene</h3>
              <p className="sh-benefit-desc">
                Round-robin tournaments by county. Earn your rating, climb the leaderboard, and win trophies — all organized automatically.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works — clean 3-step */}
      <section className="sh-section sh-how" id="how-it-works">
        <div className="sh-section-inner">
          <h2 className="sh-section-title">How Rally works</h2>
          <p className="sh-section-subtitle">Three steps. Zero scheduling headaches.</p>
          <div className="sh-how-grid">
            <div className="sh-how-step">
              <div className="sh-how-number">1</div>
              <h3 className="sh-how-title">Join your county</h3>
              <p className="sh-how-desc">
                Sign up and join the tennis community in your county. When enough players join, a tournament kicks off automatically.
              </p>
            </div>
            <div className="sh-how-step">
              <div className="sh-how-number">2</div>
              <h3 className="sh-how-title">Set your availability</h3>
              <p className="sh-how-desc">
                Tell Rally when you're free — weekday evenings, weekend mornings, whatever works. We match you with players who share your windows.
              </p>
            </div>
            <div className="sh-how-step">
              <div className="sh-how-number">3</div>
              <h3 className="sh-how-title">Show up and play</h3>
              <p className="sh-how-desc">
                Rally auto-schedules your matches, tracks scores, and adjusts your rating after every game. Fair opponents, every time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Value prop box — Strava: "Free to join, millions of athletes..." */}
      <section className="sh-section sh-value-box">
        <div className="sh-section-inner">
          <div className="sh-value-card">
            <div className="sh-value-grid">
              <div className="sh-value-item">
                <span className="sh-value-check">&#10003;</span>
                <span>Free to join, free to play</span>
              </div>
              <div className="sh-value-item">
                <span className="sh-value-check">&#10003;</span>
                <span>2,400+ active players</span>
              </div>
              <div className="sh-value-item">
                <span className="sh-value-check">&#10003;</span>
                <span>Works on any device</span>
              </div>
              <div className="sh-value-item">
                <span className="sh-value-check">&#10003;</span>
                <span>180+ counties across the US</span>
              </div>
            </div>
            <button className="sh-btn-cta sh-btn-cta-large" onClick={onGetStarted}>
              Join Rally — It's Free
            </button>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="sh-section sh-stats">
        <div className="sh-section-inner">
          <div className="sh-stats-grid">
            <div className="sh-stat">
              <span className="sh-stat-number">2,400+</span>
              <span className="sh-stat-label">Active players</span>
            </div>
            <div className="sh-stat">
              <span className="sh-stat-number">180+</span>
              <span className="sh-stat-label">Counties</span>
            </div>
            <div className="sh-stat">
              <span className="sh-stat-number">12,000+</span>
              <span className="sh-stat-label">Matches played</span>
            </div>
            <div className="sh-stat">
              <span className="sh-stat-number">80%</span>
              <span className="sh-stat-label">Auto-scheduled</span>
            </div>
          </div>
        </div>
      </section>

      {/* Problem/Solution */}
      <section className="sh-section sh-problem">
        <div className="sh-section-inner">
          <h2 className="sh-section-title">The scheduling problem, solved</h2>
          <div className="sh-problem-grid">
            <div className="sh-problem-card sh-problem-before">
              <div className="sh-problem-label">Without Rally</div>
              <div className="sh-chat-demo">
                <div className="sh-chat-bubble sh-chat-out">Can you play Tuesday?</div>
                <div className="sh-chat-bubble sh-chat-in">Maybe Wednesday?</div>
                <div className="sh-chat-bubble sh-chat-out">What about Saturday morning?</div>
                <div className="sh-chat-bubble sh-chat-in">Let me check with my wife...</div>
                <div className="sh-chat-bubble sh-chat-out">OK how about next week?</div>
                <div className="sh-chat-bubble sh-chat-in">I'll get back to you</div>
              </div>
              <div className="sh-problem-stat">
                <span className="sh-problem-stat-number">20+</span>
                <span className="sh-problem-stat-label">messages to schedule one match</span>
              </div>
            </div>
            <div className="sh-problem-card sh-problem-after">
              <div className="sh-problem-label sh-problem-label-positive">With Rally</div>
              <div className="sh-solution-demo">
                <div className="sh-solution-step">
                  <div className="sh-solution-icon">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <rect x="2" y="3" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                      <line x1="2" y1="8" x2="18" y2="8" stroke="currentColor" strokeWidth="1.5"/>
                      <line x1="7" y1="3" x2="7" y2="1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      <line x1="13" y1="3" x2="13" y2="1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <span>Set your availability once</span>
                </div>
                <div className="sh-solution-arrow">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 3v10M8 13l3-3M8 13l-3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="sh-solution-step">
                  <div className="sh-solution-icon sh-solution-icon-accent">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M13 2L3 14h9l-1 4 10-12h-9l1-4z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <span>Rally finds overlapping times</span>
                </div>
                <div className="sh-solution-arrow">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 3v10M8 13l3-3M8 13l-3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="sh-solution-step">
                  <div className="sh-solution-icon sh-solution-icon-positive">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M6 10l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <span>Matches are auto-confirmed</span>
                </div>
              </div>
              <div className="sh-problem-stat sh-problem-stat-positive">
                <span className="sh-problem-stat-number">0</span>
                <span className="sh-problem-stat-label">messages needed</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Multi-sport statement adapted — Strava: "You don't have to run or ride..." */}
      <section className="sh-section sh-multi">
        <div className="sh-section-inner sh-multi-inner">
          <h2 className="sh-multi-title">Singles, doubles, or just hitting around</h2>
          <p className="sh-multi-copy">
            Rally works for competitive players, weekend warriors, and everyone in between.
            Whether you're a beginner looking for your first match or an advanced player chasing
            leaderboard rankings — Rally organizes it all.
          </p>
        </div>
      </section>

      {/* Final CTA — Strava pattern: big centered CTA */}
      <section className="sh-section sh-final-cta">
        <div className="sh-section-inner">
          <h2 className="sh-cta-title">Ready to play?</h2>
          <p className="sh-cta-subtitle">
            Join Rally today and never waste time scheduling again.
          </p>
          <div className="sh-hero-ctas" style={{ maxWidth: 360, margin: '0 auto' }}>
            <button className="sh-btn-signup sh-btn-google" onClick={() => signInWithGoogle()}>
              <svg width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Sign Up with Google
            </button>
            <button className="sh-btn-signup sh-btn-email" onClick={onGetStarted}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/></svg>
              Sign Up with Email
            </button>
          </div>
        </div>
      </section>

      {/* Blog teaser */}
      <section className="sh-blog-teaser">
        <div className="sh-blog-teaser-inner">
          <div className="sh-blog-teaser-header">
            <span className="sh-blog-teaser-label">From the blog</span>
            <h2 className="sh-blog-teaser-title">The Baseline</h2>
            <p className="sh-blog-teaser-subtitle">Technique breakdowns, match analytics, and the science of winning.</p>
          </div>
          <div className="sh-blog-teaser-grid">
            <a href="/blog/tennis-analytics-metrics-win-probability/" className="sh-blog-teaser-card">
              <span className="sh-blog-teaser-cat">Analytics</span>
              <span className="sh-blog-teaser-card-title">Key Metrics That Predict Match Outcomes</span>
              <span className="sh-blog-teaser-read">14 min read</span>
            </a>
            <a href="/blog/mastering-the-modern-tennis-serve/" className="sh-blog-teaser-card">
              <span className="sh-blog-teaser-cat">Technique</span>
              <span className="sh-blog-teaser-card-title">Mastering the Modern Tennis Serve</span>
              <span className="sh-blog-teaser-read">12 min read</span>
            </a>
            <a href="/blog/return-of-serve-strategy/" className="sh-blog-teaser-card">
              <span className="sh-blog-teaser-cat">Strategy</span>
              <span className="sh-blog-teaser-card-title">Return of Serve: Reading, Positioning & Neutralizing</span>
              <span className="sh-blog-teaser-read">9 min read</span>
            </a>
          </div>
          <a href="/blog/" className="sh-blog-teaser-all">View all articles &rarr;</a>
        </div>
      </section>

      {/* Footer — Strava pattern: 4-column links + social */}
      <footer className="sh-footer">
        <div className="sh-footer-inner">
          <div className="sh-footer-top">
            <div className="sh-footer-brand">
              <img height="28" src="/rally-logo.svg" alt="Rally" />
              <span className="sh-footer-tagline">Play tennis. Skip the texting.</span>
            </div>
            <div className="sh-footer-columns">
              <div className="sh-footer-col">
                <h4 className="sh-footer-col-title">Product</h4>
                <a href="#how-it-works">How It Works</a>
                <a href="#features">Features</a>
              </div>
              <div className="sh-footer-col">
                <h4 className="sh-footer-col-title">Community</h4>
                <a href="/blog/">The Baseline Blog</a>
                <a href="https://www.instagram.com/playrally_us/" target="_blank" rel="noopener noreferrer">Instagram</a>
                <a href="https://www.facebook.com/people/Rally-Tournaments/61577494419031/" target="_blank" rel="noopener noreferrer">Facebook</a>
              </div>
              <div className="sh-footer-col">
                <h4 className="sh-footer-col-title">Support</h4>
                <a href="/support/">Help Center</a>
                <a href="mailto:hello@play-rally.com">Contact Us</a>
              </div>
              <div className="sh-footer-col">
                <h4 className="sh-footer-col-title">Legal</h4>
                <a href="/support/">Privacy Policy</a>
                <a href="/support/">Terms of Service</a>
              </div>
            </div>
          </div>
          <div className="sh-footer-bottom">
            <span>&copy; {new Date().getFullYear()} Rally Tennis. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
