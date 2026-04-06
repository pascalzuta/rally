import { useEffect, useRef } from 'react'
import Footer from './Footer'

interface Props {
  onGetStarted: () => void
  onLogin?: () => void
}

/** Adds 'dgh-visible' class when element scrolls into view */
function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('dgh-visible')
          observer.disconnect()
        }
      },
      { threshold: 0.15 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return ref
}

export default function DesktopGuestHomepage({ onGetStarted, onLogin }: Props) {
  const chatRef = useScrollReveal()
  const scheduleRef = useScrollReveal()
  const matchupRef = useScrollReveal()
  const ctaRef = useScrollReveal()
  const blogRef = useScrollReveal()

  function handleLogin() {
    if (onLogin) onLogin()
    else onGetStarted()
  }

  return (
    <div className="dgh">
      {/* Nav */}
      <nav className="dgh-nav" aria-label="Main navigation">
        <div className="dgh-nav-inner">
          <span className="rally-mark" style={{ fontSize: 30 }}>rally.</span>
          <div className="dgh-nav-actions">
            <a href="/blog/" className="dgh-btn-link">Blog</a>
            <a href="/support/" className="dgh-btn-link">Help</a>
            <button className="dgh-btn-text" onClick={handleLogin}>Log in</button>
            <button className="dgh-btn-primary" onClick={onGetStarted}>Sign up free</button>
          </div>
        </div>
      </nav>

      {/* Hero — left-aligned, asymmetric */}
      <section className="dgh-hero">
        <div className="dgh-hero-inner">
          <div className="dgh-hero-content">
            <p className="dgh-hero-eyebrow">Local tennis, zero hassle</p>
            <h1 className="dgh-hero-title">
              Stop texting.<br />Start playing.
            </h1>
            <p className="dgh-hero-subtitle">
              Rally auto-schedules local tennis matches based on your availability.
              No group chats, no back-and-forth — just show up and play.
            </p>
            <div className="dgh-hero-cta">
              <button className="dgh-btn-primary dgh-btn-large" onClick={onGetStarted}>
                Get started — it's free
              </button>
              <button className="dgh-btn-text dgh-btn-large" onClick={handleLogin}>
                I already have an account
              </button>
            </div>
          </div>
          <div className="dgh-hero-aside">
            <div className="dgh-hero-stat">
              <span className="dgh-hero-stat-number">2,400+</span>
              <span className="dgh-hero-stat-label">players on Rally</span>
            </div>
            <div className="dgh-hero-stat">
              <span className="dgh-hero-stat-number">50</span>
              <span className="dgh-hero-stat-label">states covered</span>
            </div>
            <div className="dgh-hero-stat">
              <span className="dgh-hero-stat-number">100%</span>
              <span className="dgh-hero-stat-label">free to play</span>
            </div>
          </div>
        </div>
      </section>

      {/* Problem — full-width, no card wrapper */}
      <section className="dgh-problem" ref={chatRef}>
        <div className="dgh-problem-inner">
          <div className="dgh-problem-text">
            <span className="dgh-section-number">01</span>
            <h2 className="dgh-section-heading">Scheduling tennis shouldn't take 20 messages</h2>
            <p className="dgh-section-desc">You want to play. Not manage calendars. Rally eliminates the back-and-forth.</p>
          </div>
          <div className="dgh-problem-chat dgh-anim-chat">
            <div className="dgh-story-bubble dgh-story-bubble-out" style={{'--i': 0} as React.CSSProperties}>Can you play Tuesday?</div>
            <div className="dgh-story-bubble dgh-story-bubble-in" style={{'--i': 1} as React.CSSProperties}>Maybe Wednesday?</div>
            <div className="dgh-story-bubble dgh-story-bubble-out" style={{'--i': 2} as React.CSSProperties}>What about Saturday morning?</div>
            <div className="dgh-story-bubble dgh-story-bubble-in" style={{'--i': 3} as React.CSSProperties}>Let me check with my wife...</div>
            <div className="dgh-story-bubble dgh-story-bubble-out" style={{'--i': 4} as React.CSSProperties}>OK how about next week?</div>
            <div className="dgh-story-bubble dgh-story-bubble-in" style={{'--i': 5} as React.CSSProperties}>I'll get back to you</div>
          </div>
        </div>
      </section>

      {/* Solution — asymmetric, visual-heavy */}
      <section className="dgh-solution" ref={scheduleRef}>
        <div className="dgh-solution-inner">
          <div className="dgh-solution-visual dgh-anim-schedule">
            <div className="dgh-story-schedule-header dgh-anim-row dgh-anim-row-1">
              <span className="dgh-story-schedule-label">Your availability</span>
            </div>
            <div className="dgh-story-schedule-slots">
              <div className="dgh-story-schedule-slot dgh-anim-row dgh-anim-row-1">
                <span className="dgh-story-schedule-day">Sat</span>
                <span className="dgh-story-schedule-window">9 – 11am</span>
              </div>
              <div className="dgh-story-schedule-slot dgh-anim-row dgh-anim-row-2">
                <span className="dgh-story-schedule-day">Sun</span>
                <span className="dgh-story-schedule-window">10am – 12pm</span>
              </div>
            </div>
            <div className="dgh-story-schedule-divider dgh-anim-row dgh-anim-row-2"></div>
            <div className="dgh-story-schedule-match dgh-anim-confirmed">
              <div className="dgh-story-schedule-match-header">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="8" fill="var(--color-positive-primary)" />
                  <path d="M4.5 8L7 10.5L11.5 5.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>Match confirmed</span>
              </div>
              <div className="dgh-story-schedule-match-detail">
                <span className="dgh-story-schedule-match-vs">You vs. Sarah P.</span>
                <span className="dgh-story-schedule-match-time">Sat 9am · Memorial Park</span>
              </div>
            </div>
          </div>
          <div className="dgh-solution-text">
            <span className="dgh-section-number">02</span>
            <h2 className="dgh-section-heading">Set your availability once.<br />Rally does the rest.</h2>
            <p className="dgh-section-desc">We find overlapping times, confirm matches, and tell you where to show up. You just play.</p>
          </div>
        </div>
      </section>

      {/* Matchmaking — centered break, full-width visual */}
      <section className="dgh-matchmaking" ref={matchupRef}>
        <div className="dgh-matchmaking-inner">
          <span className="dgh-section-number">03</span>
          <h2 className="dgh-section-heading dgh-section-heading--center">Every match, a fair fight</h2>
          <p className="dgh-section-desc dgh-section-desc--center">Rally rates your real game — so every opponent is a genuine challenge.</p>
          <div className="dgh-matchmaking-visual dgh-anim-matchup">
            <div className="dgh-story-matchup-player dgh-anim-player-left">
              <div className="dgh-story-matchup-avatar">You</div>
              <div className="dgh-story-matchup-rating">1520</div>
            </div>
            <div className="dgh-story-matchup-vs dgh-anim-vs">
              <span className="dgh-story-matchup-vs-label">vs</span>
              <div className="dgh-story-matchup-badge">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 1L7.5 4.5L11 5L8.5 7.5L9 11L6 9.5L3 11L3.5 7.5L1 5L4.5 4.5L6 1Z" fill="currentColor" />
                </svg>
                Close match
              </div>
            </div>
            <div className="dgh-story-matchup-player dgh-anim-player-right">
              <div className="dgh-story-matchup-avatar">SP</div>
              <div className="dgh-story-matchup-rating">1545</div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA — bold, full teal */}
      <section className="dgh-final-cta" ref={ctaRef}>
        <div className="dgh-final-cta-inner dgh-anim-cta">
          <h2 className="dgh-cta-title">Ready to play?</h2>
          <p className="dgh-cta-subtitle">
            Join Rally today and never waste time scheduling again.
          </p>
          <div className="dgh-cta-actions">
            <button className="dgh-cta-btn-primary" onClick={onGetStarted}>
              Get started — it's free
            </button>
            <button className="dgh-cta-btn-secondary" onClick={handleLogin}>
              Log in
            </button>
          </div>
        </div>
      </section>

      {/* Blog Teaser — left-aligned header, horizontal scroll on mobile */}
      <section className="dgh-blog-teaser dgh-anim-blog" ref={blogRef}>
        <div className="dgh-blog-teaser-inner">
          <div className="dgh-blog-teaser-header">
            <div>
              <span className="dgh-blog-teaser-label">From the blog</span>
              <h2 className="dgh-blog-teaser-title">The Baseline</h2>
            </div>
            <a href="/blog/" className="dgh-blog-teaser-all">View all &rarr;</a>
          </div>
          <div className="dgh-blog-teaser-grid">
            <a href="/blog/tennis-analytics-metrics-win-probability/" className="dgh-blog-teaser-card" style={{'--i': 0} as React.CSSProperties}>
              <span className="dgh-blog-teaser-cat">Analytics</span>
              <span className="dgh-blog-teaser-card-title">Key Metrics That Predict Match Outcomes</span>
              <span className="dgh-blog-teaser-read">14 min read</span>
            </a>
            <a href="/blog/mastering-the-modern-tennis-serve/" className="dgh-blog-teaser-card" style={{'--i': 1} as React.CSSProperties}>
              <span className="dgh-blog-teaser-cat">Technique</span>
              <span className="dgh-blog-teaser-card-title">Mastering the Modern Tennis Serve</span>
              <span className="dgh-blog-teaser-read">12 min read</span>
            </a>
            <a href="/blog/return-of-serve-strategy/" className="dgh-blog-teaser-card" style={{'--i': 2} as React.CSSProperties}>
              <span className="dgh-blog-teaser-cat">Strategy</span>
              <span className="dgh-blog-teaser-card-title">Return of Serve: Reading, Positioning & Neutralizing</span>
              <span className="dgh-blog-teaser-read">9 min read</span>
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
