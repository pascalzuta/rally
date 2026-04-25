import { useState } from 'react'
import '../dev/css/baseline-info.css'

/**
 * Help Center (Baseline reskin — screen 27).
 *
 * Marketing-style top nav + "How can we help?" headline + four contact cards
 * + Frequently Asked Questions block. Mirrors the design handoff at
 *   handoff 3/screenshots/27-Help-Center.png
 */

interface FaqItem { q: string; a: string }

const FAQS: FaqItem[] = [
  { q: 'How do I join a tournament?', a: 'From the Home tab, tap "Join Lobby" to enter the player pool for your county. Once 6+ players join, a tournament is automatically created.' },
  { q: 'What tournament formats are available?', a: 'Rally currently runs round-robin tournaments — everyone plays everyone. The top players advance to single-elimination playoffs.' },
  { q: 'How are matches scheduled?', a: 'Rally finds overlapping availability and proposes match times automatically. You can also use Play Now to broadcast availability for an immediate match.' },
  { q: 'Can I play someone from a different county?', a: 'Tournaments are organized by county to keep matches local. You can only join the lobby for your registered county.' },
  { q: 'How do I change my availability?', a: 'Go to the Availability tab and tap "Edit". Choose quick presets or set specific time slots.' },
  { q: 'What happens if I can\'t make a match?', a: 'You\'ll get reminders before the deadline. If neither player responds, the match is recorded as a mutual no-show.' },
]

export default function Help({ onBack }: { onBack: () => void }) {
  return (
    <div className="b-page bi-help-page">
      <nav className="b-page-nav bi-marketing-nav" aria-label="Main">
        <div className="bi-marketing-nav-left">
          <span className="bi-marketing-logo">Rally</span>
          <span className="bi-marketing-nav-tag">Help</span>
        </div>
        <div className="bi-marketing-nav-right">
          <a href="/blog/" className="bi-marketing-nav-link">Blog</a>
          <button className="bi-marketing-cta" onClick={onBack}>Play Rally</button>
        </div>
      </nav>

      <div className="b-page-content bi-help-content">
        <header className="bi-help-hero">
          <h1 className="bi-help-title">
            How can we <em className="bg-em">help?</em>
          </h1>
          <p className="bi-help-sub">
            Find answers below or send us a message — we'll get back within 24 hours.
          </p>
        </header>

        <div className="bi-help-list">
          <HelpLink
            href="#faq"
            label="Common questions"
            icon={<HelpIcon />}
          />
          <HelpLink
            href="mailto:hello@play-rally.com"
            label="Contact support"
            icon={<MailIcon />}
          />
          <HelpLink
            href="https://instagram.com/playrally"
            label="DM us on Instagram"
            icon={<InstagramIcon />}
          />
          <HelpLink
            href="https://facebook.com/playrally"
            label="Message on Facebook"
            icon={<FacebookIcon />}
          />
        </div>

        <section className="bi-help-faq" id="faq">
          <h2 className="bi-help-faq-title">
            Frequently Asked <em className="bg-em">Questions.</em>
          </h2>
          <FaqList items={FAQS} />
        </section>
      </div>
    </div>
  )
}

function HelpLink({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <a href={href} className="bi-help-link b-card">
      <span className="bi-help-link-icon">{icon}</span>
      <span className="bi-help-link-label">{label}</span>
    </a>
  )
}

function FaqList({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<Set<number>>(new Set())
  function toggle(i: number) {
    const next = new Set(open)
    if (next.has(i)) next.delete(i)
    else next.add(i)
    setOpen(next)
  }
  return (
    <div className="bi-faq-list">
      {items.map((item, i) => {
        const isOpen = open.has(i)
        return (
          <div key={i} className={`bi-faq-item ${isOpen ? 'bi-faq-item--open' : ''}`}>
            <button className="bi-faq-q" onClick={() => toggle(i)} aria-expanded={isOpen}>
              <span>{item.q}</span>
              <span className="bi-faq-chev" aria-hidden="true">{isOpen ? '–' : '+'}</span>
            </button>
            {isOpen && <div className="bi-faq-a">{item.a}</div>}
          </div>
        )
      })}
    </div>
  )
}

function HelpIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.5V14" />
      <circle cx="12" cy="17" r="0.6" fill="currentColor" />
    </svg>
  )
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  )
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 4h-2.5A3.5 3.5 0 0 0 8 7.5V10H6v3h2v8h3v-8h2.4l.6-3H11V7.5A.5.5 0 0 1 11.5 7H14V4z" />
    </svg>
  )
}
