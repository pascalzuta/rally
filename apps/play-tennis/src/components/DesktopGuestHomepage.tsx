interface Props {
  onGetStarted: () => void
}

export default function DesktopGuestHomepage({ onGetStarted }: Props) {
  return (
    <div className="dgh">
      {/* Nav */}
      <nav className="dgh-nav">
        <div className="dgh-nav-inner">
          <span className="rally-mark" style={{ fontSize: 30 }}>rally.</span>
          <div className="dgh-nav-actions">
            <a href="/blog/" className="dgh-btn-link">The Baseline</a>
            <a href="/support/" className="dgh-btn-link">Help</a>
            <button className="dgh-btn-secondary" onClick={onGetStarted}>Log in</button>
            <button className="dgh-btn-primary" onClick={onGetStarted}>Sign up free</button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="dgh-hero">
        <div className="dgh-hero-inner">
          <div className="dgh-hero-text">
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
              <span className="dgh-hero-hint">Join 2,400+ players across the US</span>
            </div>
          </div>
          <div className="dgh-hero-visual">
            <div className="dgh-phone-mockup">
              <div className="dgh-phone-screen">
                <div className="dgh-mock-header">
                  <div className="dgh-mock-status">
                    <span className="dgh-mock-dot dgh-mock-dot-green" />
                    Auto-scheduled
                  </div>
                  <span className="dgh-mock-count">12 of 15 matches</span>
                </div>
                <div className="dgh-mock-matches">
                  <div className="dgh-mock-match dgh-mock-match-confirmed">
                    <div className="dgh-mock-match-top">
                      <span className="dgh-mock-opponent">vs Sarah P.</span>
                      <span className="dgh-mock-badge dgh-mock-badge-green">Confirmed</span>
                    </div>
                    <div className="dgh-mock-match-time">Sat, Apr 5 · 9:00 AM</div>
                  </div>
                  <div className="dgh-mock-match dgh-mock-match-confirmed">
                    <div className="dgh-mock-match-top">
                      <span className="dgh-mock-opponent">vs James K.</span>
                      <span className="dgh-mock-badge dgh-mock-badge-green">Confirmed</span>
                    </div>
                    <div className="dgh-mock-match-time">Sun, Apr 6 · 10:30 AM</div>
                  </div>
                  <div className="dgh-mock-match dgh-mock-match-proposed">
                    <div className="dgh-mock-match-top">
                      <span className="dgh-mock-opponent">vs Mike R.</span>
                      <span className="dgh-mock-badge dgh-mock-badge-blue">Proposed</span>
                    </div>
                    <div className="dgh-mock-match-time">Tue, Apr 8 · 6:00 PM</div>
                  </div>
                  <div className="dgh-mock-match dgh-mock-match-confirmed">
                    <div className="dgh-mock-match-top">
                      <span className="dgh-mock-opponent">vs Dana L.</span>
                      <span className="dgh-mock-badge dgh-mock-badge-green">Confirmed</span>
                    </div>
                    <div className="dgh-mock-match-time">Thu, Apr 10 · 7:00 PM</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem/Solution */}
      <section className="dgh-section dgh-problem">
        <div className="dgh-section-inner">
          <div className="dgh-problem-grid">
            <div className="dgh-problem-card dgh-problem-before">
              <div className="dgh-problem-label">Without Rally</div>
              <div className="dgh-chat-demo">
                <div className="dgh-chat-bubble dgh-chat-out">Can you play Tuesday?</div>
                <div className="dgh-chat-bubble dgh-chat-in">Maybe Wednesday?</div>
                <div className="dgh-chat-bubble dgh-chat-out">What about Saturday morning?</div>
                <div className="dgh-chat-bubble dgh-chat-in">Let me check with my wife...</div>
                <div className="dgh-chat-bubble dgh-chat-out">OK how about next week?</div>
                <div className="dgh-chat-bubble dgh-chat-in">I'll get back to you</div>
              </div>
              <div className="dgh-problem-stat">
                <span className="dgh-problem-stat-number">20+</span>
                <span className="dgh-problem-stat-label">messages to schedule one match</span>
              </div>
            </div>
            <div className="dgh-problem-card dgh-problem-after">
              <div className="dgh-problem-label dgh-problem-label-positive">With Rally</div>
              <div className="dgh-solution-demo">
                <div className="dgh-solution-step">
                  <div className="dgh-solution-icon">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <rect x="2" y="3" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                      <line x1="2" y1="8" x2="18" y2="8" stroke="currentColor" strokeWidth="1.5"/>
                      <line x1="7" y1="3" x2="7" y2="1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      <line x1="13" y1="3" x2="13" y2="1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <span>Set your availability once</span>
                </div>
                <div className="dgh-solution-arrow">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 3v10M8 13l3-3M8 13l-3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="dgh-solution-step">
                  <div className="dgh-solution-icon dgh-solution-icon-accent">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M13 2L3 14h9l-1 4 10-12h-9l1-4z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <span>Rally finds overlapping times</span>
                </div>
                <div className="dgh-solution-arrow">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 3v10M8 13l3-3M8 13l-3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="dgh-solution-step">
                  <div className="dgh-solution-icon dgh-solution-icon-positive">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M6 10l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <span>Matches are auto-confirmed</span>
                </div>
              </div>
              <div className="dgh-problem-stat dgh-problem-stat-positive">
                <span className="dgh-problem-stat-number">0</span>
                <span className="dgh-problem-stat-label">messages needed</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="dgh-section dgh-how">
        <div className="dgh-section-inner">
          <h2 className="dgh-section-title">How Rally works</h2>
          <p className="dgh-section-subtitle">Three steps. Zero scheduling headaches.</p>
          <div className="dgh-how-grid">
            <div className="dgh-how-step">
              <div className="dgh-how-number">1</div>
              <h3 className="dgh-how-title">Join your county</h3>
              <p className="dgh-how-desc">
                Sign up and join the tennis community in your county. When enough players join, a tournament kicks off automatically.
              </p>
            </div>
            <div className="dgh-how-step">
              <div className="dgh-how-number">2</div>
              <h3 className="dgh-how-title">Set your availability</h3>
              <p className="dgh-how-desc">
                Tell Rally when you're free — weekday evenings, weekend mornings, whatever works. We match you with players who share your windows.
              </p>
            </div>
            <div className="dgh-how-step">
              <div className="dgh-how-number">3</div>
              <h3 className="dgh-how-title">Show up and play</h3>
              <p className="dgh-how-desc">
                Rally auto-schedules your matches, tracks scores, and adjusts your rating after every game. Fair opponents, every time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="dgh-section dgh-features">
        <div className="dgh-section-inner">
          <h2 className="dgh-section-title">Built for players who'd rather play than plan</h2>
          <div className="dgh-features-grid">
            <div className="dgh-feature-card">
              <div className="dgh-feature-icon dgh-feature-icon-green">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                  <path d="M9 16l2 2 4-4"/>
                </svg>
              </div>
              <h3 className="dgh-feature-title">Auto-scheduling</h3>
              <p className="dgh-feature-desc">
                Matches scheduled instantly based on overlapping availability. 80% of matches are confirmed without a single message.
              </p>
            </div>
            <div className="dgh-feature-card">
              <div className="dgh-feature-icon dgh-feature-icon-blue">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L15 8.5L22 9.5L17 14.5L18 21.5L12 18.5L6 21.5L7 14.5L2 9.5L9 8.5L12 2Z"/>
                </svg>
              </div>
              <h3 className="dgh-feature-title">Fair matchmaking</h3>
              <p className="dgh-feature-desc">
                Rally rates your real game — not your self-assessment. Every opponent is a genuine challenge, matched by skill.
              </p>
            </div>
            <div className="dgh-feature-card">
              <div className="dgh-feature-icon dgh-feature-icon-purple">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <h3 className="dgh-feature-title">Local community</h3>
              <p className="dgh-feature-desc">
                Play people near you. Rally organizes round-robin tournaments by county — real competition with neighbors, not strangers.
              </p>
            </div>
            <div className="dgh-feature-card">
              <div className="dgh-feature-icon dgh-feature-icon-orange">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="7"/>
                  <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>
                </svg>
              </div>
              <h3 className="dgh-feature-title">Earn your rating</h3>
              <p className="dgh-feature-desc">
                Your Rally Rating adjusts after every match. Climb the leaderboard, earn trophies, and track your progress over time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="dgh-section dgh-stats">
        <div className="dgh-section-inner">
          <div className="dgh-stats-grid">
            <div className="dgh-stat">
              <span className="dgh-stat-number">2,400+</span>
              <span className="dgh-stat-label">Active players</span>
            </div>
            <div className="dgh-stat">
              <span className="dgh-stat-number">180+</span>
              <span className="dgh-stat-label">Counties</span>
            </div>
            <div className="dgh-stat">
              <span className="dgh-stat-number">12,000+</span>
              <span className="dgh-stat-label">Matches played</span>
            </div>
            <div className="dgh-stat">
              <span className="dgh-stat-number">80%</span>
              <span className="dgh-stat-label">Auto-scheduled</span>
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
          <button className="dgh-btn-primary dgh-btn-large" onClick={onGetStarted}>
            Get started — it's free
          </button>
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

      {/* Footer */}
      <footer className="dgh-footer">
        <div className="dgh-footer-inner">
          <div className="dgh-footer-brand">
            <img height="28" src="/rally-logo.svg" alt="Rally" />
            <span className="dgh-footer-tagline">Play tennis. Skip the texting.</span>
          </div>
          <div className="dgh-footer-links">
            <a href="/blog/">The Baseline Blog</a>
            <span className="dgh-footer-sep">·</span>
            <a href="/support/">Help</a>
            <span className="dgh-footer-sep">·</span>
            <div className="dgh-footer-social">
              <a href="https://www.instagram.com/playrally_us/" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
              </a>
              <a href="https://www.facebook.com/people/Rally-Tournaments/61577494419031/" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
              </a>
            </div>
          </div>
          <div className="dgh-footer-copy">
            &copy; {new Date().getFullYear()} Rally Tennis
          </div>
        </div>
      </footer>
    </div>
  )
}
