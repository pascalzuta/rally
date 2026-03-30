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
      { threshold: 0.3 }
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

  function handleLogin() {
    if (onLogin) onLogin()
    else onGetStarted()
  }

  return (
    <div className="dgh">
      {/* Nav */}
      <nav className="dgh-nav">
        <div className="dgh-nav-inner">
          <img className="rally-logo" height="38" src="/rally-logo.svg" alt="Rally" />
          <div className="dgh-nav-actions">
            <a href="/blog/" className="dgh-btn-link">The Baseline</a>
            <a href="/support/" className="dgh-btn-link">Help</a>
            <button className="dgh-btn-secondary" onClick={handleLogin}>Log in</button>
            <button className="dgh-btn-primary" onClick={onGetStarted}>Sign up free</button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="dgh-hero">
        <div className="dgh-hero-inner dgh-hero-centered">
          <div className="dgh-hero-text dgh-hero-text-centered">
            <h1 className="dgh-hero-title dgh-hero-title-centered">
              Stop texting.<br />Start playing.
            </h1>
            <p className="dgh-hero-subtitle dgh-hero-subtitle-centered">
              Rally auto-schedules local tennis matches based on your availability.
              No group chats, no back-and-forth — just show up and play.
            </p>
            <div className="dgh-hero-cta dgh-hero-cta-centered">
              <button className="dgh-btn-primary dgh-btn-large" onClick={onGetStarted}>
                Sign up free
              </button>
              <button className="dgh-btn-secondary dgh-btn-large" onClick={handleLogin}>
                Log in
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Story 1: The Problem */}
      <section className="dgh-section dgh-story">
        <div className="dgh-section-inner">
          <div className="dgh-story-block">
            <div className="dgh-story-text">
              <h2 className="dgh-story-heading">Scheduling tennis shouldn't take 20 messages</h2>
              <p className="dgh-story-desc">Rally handles the back-and-forth for you.</p>
            </div>
            <div className="dgh-story-visual">
              <div className="dgh-story-chat dgh-anim-chat" ref={chatRef}>
                <div className="dgh-story-bubble dgh-story-bubble-out">Can you play Tuesday?</div>
                <div className="dgh-story-bubble dgh-story-bubble-in">Maybe Wednesday?</div>
                <div className="dgh-story-bubble dgh-story-bubble-out">What about Saturday morning?</div>
                <div className="dgh-story-bubble dgh-story-bubble-in">Let me check with my wife...</div>
                <div className="dgh-story-bubble dgh-story-bubble-out">OK how about next week?</div>
                <div className="dgh-story-bubble dgh-story-bubble-in">I'll get back to you</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Story 2: The Solution */}
      <section className="dgh-section dgh-story dgh-story-alt">
        <div className="dgh-section-inner">
          <div className="dgh-story-block dgh-story-block-reverse">
            <div className="dgh-story-text">
              <h2 className="dgh-story-heading">Matches are scheduled automatically</h2>
              <p className="dgh-story-desc">Set your availability once. Rally finds overlapping times and confirms matches for you.</p>
            </div>
            <div className="dgh-story-visual">
              <div className="dgh-story-schedule dgh-anim-schedule" ref={scheduleRef}>
                <div className="dgh-story-schedule-row dgh-anim-row dgh-anim-row-1">
                  <span className="dgh-story-schedule-player">You</span>
                  <span className="dgh-story-schedule-time">Sat 9am</span>
                </div>
                <div className="dgh-story-schedule-row dgh-anim-row dgh-anim-row-2">
                  <span className="dgh-story-schedule-player">Opponent</span>
                  <span className="dgh-story-schedule-time">Sat 9am</span>
                </div>
                <div className="dgh-story-schedule-confirmed dgh-anim-confirmed">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="8" fill="var(--color-positive-primary)" />
                    <path d="M4.5 8L7 10.5L11.5 5.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>Match scheduled</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Story 3: Fair Matchmaking */}
      <section className="dgh-section dgh-story">
        <div className="dgh-section-inner">
          <div className="dgh-story-block">
            <div className="dgh-story-text">
              <h2 className="dgh-story-heading">Every match, a fair fight</h2>
              <p className="dgh-story-desc">Rally rates your real game — so every opponent is a genuine challenge.</p>
            </div>
            <div className="dgh-story-visual">
              <div className="dgh-story-matchup dgh-anim-matchup" ref={matchupRef}>
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
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="dgh-section dgh-final-cta">
        <div className="dgh-section-inner">
          <h2 className="dgh-cta-title">Ready to play?</h2>
          <p className="dgh-cta-subtitle">
            Join Rally today and never waste time scheduling again.
          </p>
          <div className="dgh-hero-cta dgh-hero-cta-centered">
            <button className="dgh-btn-primary dgh-btn-large" onClick={onGetStarted}>
              Sign up free
            </button>
            <button className="dgh-btn-secondary dgh-btn-large" onClick={handleLogin}>
              Log in
            </button>
          </div>
        </div>
      </section>

      {/* Blog Teaser */}
      <section className="dgh-blog-teaser">
        <div className="dgh-blog-teaser-inner">
          <div className="dgh-blog-teaser-header">
            <span className="dgh-blog-teaser-label">From the blog</span>
            <h2 className="dgh-blog-teaser-title">The Baseline</h2>
            <p className="dgh-blog-teaser-subtitle">Technique breakdowns, match analytics, and the science of winning.</p>
          </div>
          <div className="dgh-blog-teaser-grid">
            <a href="/blog/tennis-analytics-metrics-win-probability/" className="dgh-blog-teaser-card">
              <span className="dgh-blog-teaser-cat">Analytics</span>
              <span className="dgh-blog-teaser-card-title">Key Metrics That Predict Match Outcomes</span>
              <span className="dgh-blog-teaser-read">14 min read</span>
            </a>
            <a href="/blog/mastering-the-modern-tennis-serve/" className="dgh-blog-teaser-card">
              <span className="dgh-blog-teaser-cat">Technique</span>
              <span className="dgh-blog-teaser-card-title">Mastering the Modern Tennis Serve</span>
              <span className="dgh-blog-teaser-read">12 min read</span>
            </a>
            <a href="/blog/return-of-serve-strategy/" className="dgh-blog-teaser-card">
              <span className="dgh-blog-teaser-cat">Strategy</span>
              <span className="dgh-blog-teaser-card-title">Return of Serve: Reading, Positioning & Neutralizing</span>
              <span className="dgh-blog-teaser-read">9 min read</span>
            </a>
          </div>
          <a href="/blog/" className="dgh-blog-teaser-all">View all articles &rarr;</a>
        </div>
      </section>

      <Footer />
    </div>
  )
}
